/**
 * src/features/messages/router/index.ts
 *
 * Inbox — received messages + reply actions.
 *
 * Optimisations (v2):
 *   - N+1 eliminated in listConversations: all per-thread DB calls replaced with
 *     two batched queries (findMany + groupBy) and in-memory Map lookups.
 *     For 50 threads: 100 queries → 2 queries.
 *   - replyToConversation now resolves the org ownerId before billing, so member
 *     users correctly debit the owner wallet (not their own empty wallet).
 *   - console.log replaced with thrown errors for proper observability.
 *   - getThread and markThreadReplied also resolve ownerId for org consistency.
 */

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { debitForMessage, refundForMessage } from "#/features/billing/utils";
import type { PrismaClient } from "#/generated/prisma/client";
import { invalidate, withCache } from "#/lib/cache";
import { sendTextMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";
import { protectedProcedure } from "#/orpc";

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getServiceWindow(lastInboundAt: Date, channel: string) {
	if (channel !== "whatsapp") {
		return { windowExpiresAt: null, windowOpen: false, windowSecondsLeft: 0 };
	}
	const expiresAt = new Date(lastInboundAt.getTime() + WA_SERVICE_WINDOW_MS);
	const secondsLeft = Math.max(
		0,
		Math.floor((expiresAt.getTime() - Date.now()) / 1000)
	);
	return {
		windowExpiresAt: expiresAt.toISOString(),
		windowOpen: secondsLeft > 0,
		windowSecondsLeft: secondsLeft,
	};
}

async function resolveOwnerId(
	db: PrismaClient,
	userId: string
): Promise<string> {
	const membership = await db.orgMember.findFirst({
		select: { ownerId: true },
		where: { userId },
	});
	return membership?.ownerId ?? userId;
}

// ─── listConversations ────────────────────────────────────────────────────────

export const listConversations = protectedProcedure
	.input(
		z.object({
			channel: z.enum(["all", "whatsapp", "sms"]).default("all"),
			cursor: z.string().optional(),
			filter: z.enum(["all", "unread", "keyword"]).default("all"),
			limit: z.number().int().min(1).max(100).default(50),
		})
	)
	.handler(
		withCache("inbox.list", 10_000, async ({ input, context }) => {
			const userId = context.session?.user.id ?? "";
			const ownerId = await resolveOwnerId(context.db, userId);
			const channelFilter =
				input.channel === "all"
					? undefined
					: (input.channel as "whatsapp" | "sms");

			// ── Inbound threads ──────────────────────────────────────────────────
			const inboundThreads = await context.db.inboundMessage.groupBy({
				_count: { id: true },
				_max: { receivedAt: true },
				by: ["phone", "channel"],
				orderBy: { _max: { receivedAt: "desc" } },
				take: input.limit,
				where: {
					userId: ownerId,
					...(channelFilter && { channel: channelFilter }),
					...(input.filter === "unread" && {
						isKeyword: false,
						replied: false,
					}),
					...(input.filter === "keyword" && { isKeyword: true }),
				},
			});

			// ── Outbound-only threads ────────────────────────────────────────────
			let outboundOnlyPhones: Array<{ phone: string; channel: string }> = [];
			if (input.filter === "all") {
				const inboundPhoneSet = new Set(
					inboundThreads.map((t) => `${t.phone}:${t.channel}`)
				);
				const recentOutbound = await context.db.message.groupBy({
					_max: { sentAt: true },
					by: ["phone", "channel"],
					orderBy: { _max: { sentAt: "desc" } },
					take: input.limit,
					where: {
						campaign: { userId: ownerId },
						status: { in: ["sent", "delivered", "read"] },
						...(channelFilter && { channel: channelFilter }),
					},
				});
				outboundOnlyPhones = recentOutbound
					.filter((r) => !inboundPhoneSet.has(`${r.phone}:${r.channel}`))
					.slice(0, input.limit - inboundThreads.length);
			}

			// ── BATCHED inbound load (was N+1: findFirst + count per thread) ─────
			const inboundPhones = inboundThreads.map((t) => t.phone);
			const [latestInboundRows, unreadCountRows] = await Promise.all([
				inboundPhones.length > 0
					? context.db.inboundMessage.findMany({
							orderBy: { receivedAt: "desc" },
							where: { phone: { in: inboundPhones }, userId: ownerId },
						})
					: Promise.resolve([]),
				inboundPhones.length > 0
					? context.db.inboundMessage.groupBy({
							_count: { id: true },
							by: ["phone", "channel"],
							where: {
								isKeyword: false,
								phone: { in: inboundPhones },
								replied: false,
								userId: ownerId,
							},
						})
					: Promise.resolve([]),
			]);

			// O(1) lookup maps
			const latestInboundMap = new Map<string, (typeof latestInboundRows)[0]>();
			for (const msg of latestInboundRows) {
				const key = `${msg.phone}:${msg.channel}`;
				if (!latestInboundMap.has(key)) {
					latestInboundMap.set(key, msg); // first = latest (desc ordered)
				}
			}
			const unreadCountMap = new Map<string, number>();
			for (const row of unreadCountRows) {
				unreadCountMap.set(`${row.phone}:${row.channel}`, row._count.id);
			}

			const inboundConvs = inboundThreads
				.map((t) => {
					const key = `${t.phone}:${t.channel}`;
					const latest = latestInboundMap.get(key);
					if (!latest) {
						return null;
					}
					const window = getServiceWindow(latest.receivedAt, latest.channel);
					return {
						channel: t.channel,
						contactId: latest.contactId,
						contactName: latest.contactName,
						hasInbound: true,
						lastMessage: latest.body,
						lastMessageAt: latest.receivedAt.toISOString(),
						phone: t.phone,
						replied: latest.replied,
						unreadCount: unreadCountMap.get(key) ?? 0,
						...window,
					};
				})
				.filter(Boolean);

			// ── BATCHED outbound load (was N+1: findFirst per thread) ─────────────
			const outboundPhoneList = outboundOnlyPhones.map((p) => p.phone);
			const latestOutboundRows =
				outboundPhoneList.length > 0
					? await context.db.message.findMany({
							orderBy: { sentAt: "desc" },
							select: {
								channel: true,
								contactId: true,
								contactName: true,
								createdAt: true,
								message: true,
								phone: true,
								sentAt: true,
							},
							where: {
								campaign: { userId: ownerId },
								phone: { in: outboundPhoneList },
								status: { in: ["sent", "delivered", "read"] },
							},
						})
					: [];

			const latestOutboundMap = new Map<
				string,
				(typeof latestOutboundRows)[0]
			>();
			for (const msg of latestOutboundRows) {
				const key = `${msg.phone}:${msg.channel}`;
				if (!latestOutboundMap.has(key)) {
					latestOutboundMap.set(key, msg);
				}
			}

			const outboundConvs = outboundOnlyPhones
				.map((t) => {
					const latest = latestOutboundMap.get(`${t.phone}:${t.channel}`);
					if (!latest) {
						return null;
					}
					return {
						channel: t.channel as "whatsapp" | "sms",
						contactId: latest.contactId,
						contactName: latest.contactName,
						hasInbound: false,
						lastMessage: latest.message,
						lastMessageAt: (latest.sentAt ?? latest.createdAt).toISOString(),
						phone: t.phone,
						replied: false,
						unreadCount: 0,
						windowExpiresAt: null,
						windowOpen: false,
						windowSecondsLeft: 0,
					};
				})
				.filter(Boolean);

			return [...inboundConvs, ...outboundConvs]
				.sort(
					(a, b) =>
						new Date(b?.lastMessageAt ?? "").getTime() -
						new Date(a?.lastMessageAt ?? "").getTime()
				)
				.slice(0, input.limit);
		})
	);

// ─── getThread ────────────────────────────────────────────────────────────────

export const getThread = protectedProcedure
	.input(
		z.object({
			channel: z.enum(["whatsapp", "sms"]),
			limit: z.number().int().min(1).max(200).default(50),
			phone: z.string(),
		})
	)
	.handler(
		withCache("inbox.getThread", 10_000, async ({ input, context }) => {
			const userId = context.session?.user.id ?? "";
			const ownerId = await resolveOwnerId(context.db, userId);

			const inbound = await context.db.inboundMessage.findMany({
				orderBy: { receivedAt: "asc" },
				take: input.limit,
				where: { channel: input.channel, phone: input.phone, userId: ownerId },
			});

			const outbound = await context.db.message.findMany({
				orderBy: { createdAt: "asc" },
				select: {
					campaignId: true,
					channel: true,
					contactName: true,
					createdAt: true,
					id: true,
					message: true,
					sentAt: true,
					status: true,
				},
				take: input.limit,
				where: {
					campaign: { userId: ownerId },
					channel: input.channel,
					phone: { in: [input.phone, `+${input.phone}`] },
				},
			});

			type TimelineEvent =
				| {
						direction: "in";
						id: string;
						body: string;
						at: string;
						isKeyword: boolean;
						replied: boolean;
						source: "inbound";
				  }
				| {
						direction: "out";
						id: string;
						body: string;
						at: string;
						status: string;
						campaignId: string | null;
						source: "inbox_reply" | "campaign_send";
				  };

			const inboxReplyCampaignIds = new Set(
				outbound
					.filter((m) => m.campaignId?.startsWith("inbox_reply_"))
					.map((m) => m.campaignId)
			);

			const timeline: TimelineEvent[] = [
				...inbound.map((m) => ({
					at: m.receivedAt.toISOString(),
					body: m.body,
					direction: "in" as const,
					id: m.id,
					isKeyword: m.isKeyword,
					replied: m.replied,
					source: "inbound" as const,
				})),
				...outbound.map((m) => ({
					at: (m.sentAt ?? m.createdAt).toISOString(),
					body: m.message,
					campaignId: m.campaignId,
					direction: "out" as const,
					id: m.id,
					source:
						m.campaignId && inboxReplyCampaignIds.has(m.campaignId)
							? ("inbox_reply" as const)
							: ("campaign_send" as const),
					status: m.status,
				})),
			].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

			const lastInbound = inbound.at(-1);
			const window = lastInbound
				? getServiceWindow(lastInbound.receivedAt, input.channel)
				: { windowExpiresAt: null, windowOpen: false, windowSecondsLeft: 0 };

			return {
				channel: input.channel,
				contactId: lastInbound?.contactId ?? null,
				contactName: lastInbound?.contactName ?? null,
				phone: input.phone,
				timeline,
				...window,
			};
		})
	);

// ─── replyToConversation ──────────────────────────────────────────────────────

export const replyToConversation = protectedProcedure
	.input(
		z.object({
			body: z.string().min(1).max(4096),
			channel: z.enum(["whatsapp", "sms"]),
			inboundId: z.string().uuid().optional(),
			phone: z.string().min(7),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// FIX: Resolve owner so member users bill the org wallet, not their own empty wallet.
		const ownerId = await resolveOwnerId(context.db, userId);

		if (input.channel === "whatsapp") {
			const lastInbound = await context.db.inboundMessage.findFirst({
				orderBy: { receivedAt: "desc" },
				where: { channel: "whatsapp", phone: input.phone, userId: ownerId },
			});
			if (!lastInbound) {
				throw new Error(
					"No inbound message found for this conversation. You can only reply within 24h of receiving a message."
				);
			}
			const { windowOpen } = getServiceWindow(
				lastInbound.receivedAt,
				"whatsapp"
			);
			if (!windowOpen) {
				throw new Error(
					"The 24-hour service window has closed. Send a WhatsApp template message to re-open the conversation."
				);
			}
		}

		const messageType =
			input.channel === "whatsapp" ? "whatsapp_service" : "sms";
		const messageId = uuidv4();

		const billing = await debitForMessage({
			campaignId: `inbox_reply_${ownerId}`,
			messageId,
			messageType,
			userId: ownerId, // FIX: bill owner, not caller
		});

		if (!billing.success) {
			throw new Error(
				"Insufficient wallet balance. Please top up to send replies."
			);
		}

		let result: { success: boolean; messageId?: string; error?: string };
		if (input.channel === "whatsapp") {
			result = await sendTextMessage(`+${input.phone}`, input.body);
		} else {
			result = await sendSmsMessage(`+${input.phone}`, input.body);
		}

		if (!result.success) {
			await refundForMessage({
				campaignId: `inbox_reply_${ownerId}`,
				messageId,
				messageType,
				reason: result.error ?? "send failed",
				userId: ownerId,
			});
			throw new Error(`Failed to send: ${result.error}`);
		}

		await context.db.inboundMessage.updateMany({
			data: { replied: true, repliedAt: new Date() },
			where: {
				channel: input.channel,
				phone: input.phone,
				replied: false,
				userId: ownerId,
			},
		});

		const contact = await context.db.contact.findFirst({
			select: { id: true, name: true },
			where: {
				phone: { in: [input.phone, `+${input.phone}`] },
				uploadedBy: ownerId,
			},
		});

		const anchorCampaign = await context.db.campaign.findFirst({
			orderBy: { createdAt: "desc" },
			select: { id: true },
			where: { userId: ownerId },
		});

		if (!anchorCampaign) {
			throw new Error(
				"Cannot record reply — no campaigns found for this account."
			);
		}

		await context.db.message.create({
			data: {
				campaignId: anchorCampaign.id,
				channel: input.channel,
				contactId: contact?.id ?? undefined,
				contactName: contact?.name ?? input.phone,
				id: messageId,
				message: input.body,
				metaMessageId: result.messageId ?? null,
				phone: input.phone,
				sentAt: new Date(),
				status: "sent",
			},
		});

		// Invalidate inbox cache so the reply shows up immediately
		invalidate(ownerId, "inbox.list");
		invalidate(ownerId, "inbox.getThread");

		return { billed: messageType, messageId: result.messageId, success: true };
	});

// ─── markThreadReplied ────────────────────────────────────────────────────────

export const markThreadReplied = protectedProcedure
	.input(z.object({ channel: z.enum(["whatsapp", "sms"]), phone: z.string() }))
	.handler(async ({ input, context }) => {
		const ownerId = await resolveOwnerId(context.db, context.session.user.id);
		await context.db.inboundMessage.updateMany({
			data: { replied: true, repliedAt: new Date() },
			where: {
				channel: input.channel,
				phone: input.phone,
				replied: false,
				userId: ownerId,
			},
		});
		invalidate(ownerId, "inbox.list");
		invalidate(ownerId, "inbox.getThread");
		return { success: true };
	});
