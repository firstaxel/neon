/**
 * src/orpc/inbox.router.ts
 *
 * Inbox — received messages + reply actions.
 *
 * Key concept: WhatsApp Service Window
 *   When a contact messages you, Meta opens a free 24-hour service conversation.
 *   Within that window you can reply with plain text at the service rate (₦1).
 *   After the window closes, you must send a template message (₦9 marketing rate).
 *   We expose windowExpiresAt and windowOpen on every conversation so the UI
 *   can show a live countdown and warn before the billing rate changes.
 *
 * Future AI chatbot:
 *   The replyToConversation endpoint is the integration point. When AI is enabled,
 *   the handler will route through the AI rather than a manual reply. The schema
 *   already tracks `aiEnabled` per-user so the switch is a single flag check.
 */

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { debitForMessage, refundForMessage } from "#/features/billing/utils";
import { sendTextMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";
import { protectedProcedure } from "#/orpc";

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// ─── list ─────────────────────────────────────────────────────────────────────

export const listConversations = protectedProcedure
	.input(
		z.object({
			filter: z.enum(["all", "unread", "keyword"]).default("all"),
			channel: z.enum(["all", "whatsapp", "sms"]).default("all"),
			limit: z.number().int().min(1).max(100).default(50),
			cursor: z.string().optional(),
		})
	)
	.handler(async ({ input, context }) => {
		try {
			const userId = context.session.user.id;

			// Group by phone + channel to get one thread per conversation
			// Most recent inbound message per thread
			const threads = await context.db.inboundMessage.groupBy({
				by: ["phone", "channel"],
				where: {
					userId,
					...(input.channel !== "all" && {
						channel: input.channel as "whatsapp" | "sms",
					}),
					...(input.filter === "unread" && {
						replied: false,
						isKeyword: false,
					}),
					...(input.filter === "keyword" && {
						isKeyword: true,
					}),
				},
				_max: { receivedAt: true },
				_count: { id: true },
				orderBy: { _max: { receivedAt: "desc" } },
				take: input.limit,
			});

			// Fetch the latest inbound message for each thread
			const conversations = await Promise.all(
				threads.map(async (t) => {
					const latest = await context.db.inboundMessage.findFirst({
						where: {
							userId,
							phone: t.phone,
							channel: t.channel,
						},
						orderBy: { receivedAt: "desc" },
					});
					if (!latest) {
						return null;
					}

					// Count unread (non-keyword, unreplied) in this thread
					const unreadCount = await context.db.inboundMessage.count({
						where: {
							userId,
							phone: t.phone,
							channel: t.channel,
							replied: false,
							isKeyword: false,
						},
					});

					const window = getServiceWindow(latest.receivedAt, latest.channel);

					return {
						phone: t.phone,
						channel: t.channel,
						contactName: latest.contactName,
						contactId: latest.contactId,
						lastMessage: latest.body,
						lastMessageAt: latest.receivedAt.toISOString(),
						totalMessages: t._count.id,
						unreadCount,
						replied: latest.replied,
						...window,
					};
				})
			);

			return conversations.filter(Boolean);
		} catch (error) {
			console.log(error);
		}
	});

// ─── getThread ────────────────────────────────────────────────────────────────

export const getThread = protectedProcedure
	.input(
		z.object({
			phone: z.string(),
			channel: z.enum(["whatsapp", "sms"]),
			limit: z.number().int().min(1).max(200).default(50),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// All inbound messages for this thread
		const inbound = await context.db.inboundMessage.findMany({
			where: { userId, phone: input.phone, channel: input.channel },
			orderBy: { receivedAt: "asc" },
			take: input.limit,
		});

		// All outbound messages to this phone (from any campaign)
		const outbound = await context.db.message.findMany({
			where: {
				phone: { in: [input.phone, `+${input.phone}`] },
				channel: input.channel,
				campaign: { userId },
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

		// Merge into a unified timeline
		type TimelineEvent =
			| {
					direction: "in";
					id: string;
					body: string;
					at: string;
					isKeyword: boolean;
					replied: boolean;
			  }
			| {
					direction: "out";
					id: string;
					body: string;
					at: string;
					status: string;
					campaignId: string | null;
			  };

		const timeline: TimelineEvent[] = [
			...inbound.map((m) => ({
				direction: "in" as const,
				id: m.id,
				body: m.body,
				at: m.receivedAt.toISOString(),
				isKeyword: m.isKeyword,
				replied: m.replied,
			})),
			...outbound.map((m) => ({
				direction: "out" as const,
				id: m.id,
				body: m.message,
				at: (m.sentAt ?? m.createdAt).toISOString(),
				status: m.status,
				campaignId: m.campaignId,
			})),
		].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

		// Service window based on latest inbound
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
	});

// ─── replyToConversation ──────────────────────────────────────────────────────

export const replyToConversation = protectedProcedure
	.input(
		z.object({
			phone: z.string().min(7),
			channel: z.enum(["whatsapp", "sms"]),
			body: z.string().min(1).max(4096),
			/** ID of the inbound message this is a direct reply to (for marking replied) */
			inboundId: z.string().uuid().optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// For WhatsApp: confirm the service window is still open before sending.
		// If it's closed, the caller should be using a template (future feature).
		if (input.channel === "whatsapp") {
			const lastInbound = await context.db.inboundMessage.findFirst({
				where: { userId, phone: input.phone, channel: "whatsapp" },
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
					"The 24-hour service window has closed. You need to send a WhatsApp template message to re-open the conversation."
				);
			}
		}

		// Determine message type for billing
		const messageType =
			input.channel === "whatsapp" ? "whatsapp_service" : "sms";
		const messageId = uuidv4();

		// Debit wallet
		const billing = await debitForMessage({
			userId,
			messageType,
			campaignId: `inbox_reply_${userId}`, // virtual campaign ID for inbox replies
			messageId,
		});

		if (!billing.success) {
			throw new Error(
				"Insufficient wallet balance. Please top up to send replies."
			);
		}

		// Send via the appropriate channel
		let result: { success: boolean; messageId?: string; error?: string };
		if (input.channel === "whatsapp") {
			result = await sendTextMessage(`+${input.phone}`, input.body);
		} else {
			result = await sendSmsMessage(`+${input.phone}`, input.body);
		}

		if (!result.success) {
			// Refund on send failure
			await refundForMessage({
				userId,
				messageType,
				campaignId: `inbox_reply_${userId}`,
				messageId,
				reason: result.error ?? "send failed",
			});
			throw new Error(`Failed to send: ${result.error}`);
		}

		// Mark all unreplied inbound messages in this thread as replied
		await context.db.inboundMessage.updateMany({
			where: {
				userId,
				phone: input.phone,
				channel: input.channel,
				replied: false,
			},
			data: { replied: true, repliedAt: new Date() },
		});

		// Record the outbound reply as a Message row (attributed to a virtual campaign)
		// This makes it show up in the thread timeline
		const contact = await context.db.contact.findFirst({
			where: {
				uploadedBy: userId,
				phone: { in: [input.phone, `+${input.phone}`] },
			},
			select: { id: true, name: true },
		});

		await context.db.message.create({
			data: {
				id: messageId,
				campaignId:
					(
						await context.db.campaign.findFirst({
							where: { userId },
							orderBy: { createdAt: "desc" },
							select: { id: true },
						})
					)?.id ??
					(() => {
						throw new Error("No campaign found for this user");
					})(),
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

		return {
			success: true,
			messageId: result.messageId,
			billed: messageType,
		};
	});

// ─── markReplied ──────────────────────────────────────────────────────────────

export const markThreadReplied = protectedProcedure
	.input(
		z.object({
			phone: z.string(),
			channel: z.enum(["whatsapp", "sms"]),
		})
	)
	.handler(async ({ input, context }) => {
		await context.db.inboundMessage.updateMany({
			where: {
				userId: context.session.user.id,
				phone: input.phone,
				channel: input.channel,
				replied: false,
			},
			data: { replied: true, repliedAt: new Date() },
		});
		return { success: true };
	});
