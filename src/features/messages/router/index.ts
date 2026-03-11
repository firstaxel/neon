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
		return { windowOpen: false, windowExpiresAt: null, windowSecondsLeft: 0 };
	}
	const expiresAt = new Date(lastInboundAt.getTime() + WA_SERVICE_WINDOW_MS);
	const secondsLeft = Math.max(
		0,
		Math.floor((expiresAt.getTime() - Date.now()) / 1000)
	);
	return {
		windowOpen: secondsLeft > 0,
		windowExpiresAt: expiresAt.toISOString(),
		windowSecondsLeft: secondsLeft,
	};
}

async function resolveOwnerId(
	db: PrismaClient,
	userId: string
): Promise<string> {
	const membership = await db.orgMember.findFirst({
		where: { userId },
		select: { ownerId: true },
	});
	return membership?.ownerId ?? userId;
}

// ─── listConversations ────────────────────────────────────────────────────────

export const listConversations = protectedProcedure
	.input(
		z.object({
			filter: z.enum(["all", "unread", "keyword"]).default("all"),
			channel: z.enum(["all", "whatsapp", "sms"]).default("all"),
			limit: z.number().int().min(1).max(100).default(50),
			cursor: z.string().optional(),
		})
	)
	.handler(
		withCache("inbox.list", 10_000, async ({ input, context }) => {
			const userId = context.session?.user.id ?? "";
			const ownerId = await resolveOwnerId(context.db, userId);
			const channelFilter =
				input.channel !== "all"
					? (input.channel as "whatsapp" | "sms")
					: undefined;

			// ── Inbound threads ──────────────────────────────────────────────────
			const inboundThreads = await context.db.inboundMessage.groupBy({
				by: ["phone", "channel"],
				where: {
					userId: ownerId,
					...(channelFilter && { channel: channelFilter }),
					...(input.filter === "unread" && {
						replied: false,
						isKeyword: false,
					}),
					...(input.filter === "keyword" && { isKeyword: true }),
				},
				_max: { receivedAt: true },
				_count: { id: true },
				orderBy: { _max: { receivedAt: "desc" } },
				take: input.limit,
			});

			// ── Outbound-only threads ────────────────────────────────────────────
			let outboundOnlyPhones: Array<{ phone: string; channel: string }> = [];
			if (input.filter === "all") {
				const inboundPhoneSet = new Set(
					inboundThreads.map((t) => `${t.phone}:${t.channel}`)
				);
				const recentOutbound = await context.db.message.groupBy({
					by: ["phone", "channel"],
					where: {
						campaign: { userId: ownerId },
						status: { in: ["sent", "delivered", "read"] },
						...(channelFilter && { channel: channelFilter }),
					},
					_max: { sentAt: true },
					orderBy: { _max: { sentAt: "desc" } },
					take: input.limit,
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
							where: { userId: ownerId, phone: { in: inboundPhones } },
							orderBy: { receivedAt: "desc" },
						})
					: Promise.resolve([]),
				inboundPhones.length > 0
					? context.db.inboundMessage.groupBy({
							by: ["phone", "channel"],
							where: {
								userId: ownerId,
								phone: { in: inboundPhones },
								replied: false,
								isKeyword: false,
							},
							_count: { id: true },
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
						phone: t.phone,
						channel: t.channel,
						contactName: latest.contactName,
						contactId: latest.contactId,
						lastMessage: latest.body,
						lastMessageAt: latest.receivedAt.toISOString(),
						hasInbound: true,
						unreadCount: unreadCountMap.get(key) ?? 0,
						replied: latest.replied,
						...window,
					};
				})
				.filter(Boolean);

			// ── BATCHED outbound load (was N+1: findFirst per thread) ─────────────
			const outboundPhoneList = outboundOnlyPhones.map((p) => p.phone);
			const latestOutboundRows =
				outboundPhoneList.length > 0
					? await context.db.message.findMany({
							where: {
								phone: { in: outboundPhoneList },
								campaign: { userId: ownerId },
								status: { in: ["sent", "delivered", "read"] },
							},
							orderBy: { sentAt: "desc" },
							select: {
								phone: true,
								channel: true,
								message: true,
								sentAt: true,
								createdAt: true,
								contactName: true,
								contactId: true,
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
						phone: t.phone,
						channel: t.channel as "whatsapp" | "sms",
						contactName: latest.contactName,
						contactId: latest.contactId,
						lastMessage: latest.message,
						lastMessageAt: (latest.sentAt ?? latest.createdAt).toISOString(),
						hasInbound: false,
						unreadCount: 0,
						replied: false,
						windowOpen: false,
						windowExpiresAt: null,
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
			phone: z.string(),
			channel: z.enum(["whatsapp", "sms"]),
			limit: z.number().int().min(1).max(200).default(50),
		})
	)
	.handler(
		withCache("inbox.getThread", 10_000, async ({ input, context }) => {
			const userId = context.session?.user.id ?? "";
			const ownerId = await resolveOwnerId(context.db, userId);

			const inbound = await context.db.inboundMessage.findMany({
				where: { userId: ownerId, phone: input.phone, channel: input.channel },
				orderBy: { receivedAt: "asc" },
				take: input.limit,
			});

			const outbound = await context.db.message.findMany({
				where: {
					phone: { in: [input.phone, `+${input.phone}`] },
					channel: input.channel,
					campaign: { userId: ownerId },
				},
				orderBy: { createdAt: "asc" },
				take: input.limit,
				select: {
					id: true,
					message: true,
					status: true,
					sentAt: true,
					createdAt: true,
					channel: true,
					contactName: true,
					campaignId: true,
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
					direction: "in" as const,
					id: m.id,
					body: m.body,
					at: m.receivedAt.toISOString(),
					isKeyword: m.isKeyword,
					replied: m.replied,
					source: "inbound" as const,
				})),
				...outbound.map((m) => ({
					direction: "out" as const,
					id: m.id,
					body: m.message,
					at: (m.sentAt ?? m.createdAt).toISOString(),
					status: m.status,
					campaignId: m.campaignId,
					source:
						m.campaignId && inboxReplyCampaignIds.has(m.campaignId)
							? ("inbox_reply" as const)
							: ("campaign_send" as const),
				})),
			].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

			const lastInbound = inbound.at(-1);
			const window = lastInbound
				? getServiceWindow(lastInbound.receivedAt, input.channel)
				: { windowOpen: false, windowExpiresAt: null, windowSecondsLeft: 0 };

			return {
				phone: input.phone,
				channel: input.channel,
				contactName: lastInbound?.contactName ?? null,
				contactId: lastInbound?.contactId ?? null,
				timeline,
				...window,
			};
		})
	);

// ─── replyToConversation ──────────────────────────────────────────────────────

export const replyToConversation = protectedProcedure
	.input(
		z.object({
			phone: z.string().min(7),
			channel: z.enum(["whatsapp", "sms"]),
			body: z.string().min(1).max(4096),
			inboundId: z.string().uuid().optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// FIX: Resolve owner so member users bill the org wallet, not their own empty wallet.
		const ownerId = await resolveOwnerId(context.db, userId);

		if (input.channel === "whatsapp") {
			const lastInbound = await context.db.inboundMessage.findFirst({
				where: { userId: ownerId, phone: input.phone, channel: "whatsapp" },
				orderBy: { receivedAt: "desc" },
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
			userId: ownerId, // FIX: bill owner, not caller
			messageType,
			campaignId: `inbox_reply_${ownerId}`,
			messageId,
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
				userId: ownerId,
				messageType,
				campaignId: `inbox_reply_${ownerId}`,
				messageId,
				reason: result.error ?? "send failed",
			});
			throw new Error(`Failed to send: ${result.error}`);
		}

		await context.db.inboundMessage.updateMany({
			where: {
				userId: ownerId,
				phone: input.phone,
				channel: input.channel,
				replied: false,
			},
			data: { replied: true, repliedAt: new Date() },
		});

		const contact = await context.db.contact.findFirst({
			where: {
				uploadedBy: ownerId,
				phone: { in: [input.phone, `+${input.phone}`] },
			},
			select: { id: true, name: true },
		});

		const anchorCampaign = await context.db.campaign.findFirst({
			where: { userId: ownerId },
			orderBy: { createdAt: "desc" },
			select: { id: true },
		});

		if (!anchorCampaign) {
			throw new Error(
				"Cannot record reply — no campaigns found for this account."
			);
		}

		await context.db.message.create({
			data: {
				id: messageId,
				campaignId: anchorCampaign.id,
				contactId: contact?.id ?? undefined,
				contactName: contact?.name ?? input.phone,
				phone: input.phone,
				channel: input.channel,
				message: input.body,
				status: "sent",
				metaMessageId: result.messageId ?? null,
				sentAt: new Date(),
			},
		});

		// Invalidate inbox cache so the reply shows up immediately
		invalidate(ownerId, "inbox.list");
		invalidate(ownerId, "inbox.getThread");

		return { success: true, messageId: result.messageId, billed: messageType };
	});

// ─── markThreadReplied ────────────────────────────────────────────────────────

export const markThreadReplied = protectedProcedure
	.input(z.object({ phone: z.string(), channel: z.enum(["whatsapp", "sms"]) }))
	.handler(async ({ input, context }) => {
		const ownerId = await resolveOwnerId(context.db, context.session.user.id);
		await context.db.inboundMessage.updateMany({
			where: {
				userId: ownerId,
				phone: input.phone,
				channel: input.channel,
				replied: false,
			},
			data: { replied: true, repliedAt: new Date() },
		});
		invalidate(ownerId, "inbox.list");
		invalidate(ownerId, "inbox.getThread");
		return { success: true };
	});
