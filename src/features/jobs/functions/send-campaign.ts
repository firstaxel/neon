/**
 * src/inngest/send-campaign.ts
 *
 * Campaign fan-out orchestrator + per-message worker.
 *
 * Sending stack (no Twilio):
 *   WhatsApp → Meta Cloud API  (lib/meta-send.ts)
 *   SMS      → Termii          (lib/termii.ts)
 *
 * Features:
 *  - Opt-out guard: contacts marked optedOut are skipped before fan-out
 *  - AI pre-send content check: Gemini scans message body, blocks harmful content
 *  - Billing debit before send, refund on failure
 *  - Delivery status tracked via metaMessageId (updated by webhook)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import LowBalanceEmail from "emails/low-balance-email";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import { env } from "#/env";
import {
	debitForMessage,
	type MessageType,
	refundForMessage,
	resolveMessageType,
} from "#/features/billing/utils";
import { sendMail } from "#/features/email/lib/sender";
import { personalizeMessage } from "#/features/miscellaneous/scenario";
import { inngest } from "#/lib/inngest/client";
import { sendWhatsAppMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";

// ─── AI content filter ────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

interface ContentCheckResult {
	reason?: string;
	safe: boolean;
}

async function checkContent(
	message: string,
	channel: "whatsapp" | "sms"
): Promise<ContentCheckResult> {
	try {
		const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
		const prompt = `You are a messaging compliance checker for a Nigerian church/NGO messaging platform.
Analyze this ${channel.toUpperCase()} message for compliance. Normal church/NGO outreach is SAFE.
Mark UNSAFE only for: spam/phishing/scam, illegal threats, sexual content, financial fraud, hate speech.

Message: """
${message.slice(0, 800)}
"""

Reply with ONLY this JSON (no markdown):
{"safe": true, "reason": null}`;

		const result = await model.generateContent(prompt);
		const text = result.response
			.text()
			.trim()
			.replace(/```json\n?|```\n?/g, "");
		const parsed = JSON.parse(text) as ContentCheckResult;
		return { safe: parsed.safe ?? true, reason: parsed.reason };
	} catch {
		return { safe: true }; // fail open — don't block on AI unavailability
	}
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const sendCampaign = inngest.createFunction(
	{
		id: "send-campaign",
		name: "Send Campaign Messages (Orchestrator)",
		retries: 1,
		timeouts: { finish: "10m" },
	},
	{ event: "neon/campaign.send" },

	async ({ event, step, logger }) => {
		const {
			campaignId,
			contacts,
			whatsappTemplate,
			smsTemplate,
			scenario,
			userId,
		} = event.data as {
			campaignId: string;
			contacts: Array<{
				id: string;
				name: string;
				phone: string;
				channel: "whatsapp" | "sms";
			}>;
			whatsappTemplate: string;
			smsTemplate: string;
			scenario: string;
			userId: string;
		};

		logger.info(
			`[Campaign] Starting campaignId=${campaignId} userId=${userId} contacts=${contacts.length}`
		);

		// ── Step 1: Mark processing ──────────────────────────────────────────────
		await step.run("mark-processing", async () => {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { status: "processing", startedAt: new Date() },
			});
		});

		// ── Step 2: Filter opted-out contacts ────────────────────────────────────
		const eligibleContacts = await step.run("filter-opted-out", async () => {
			const phones = contacts.map((c) => c.phone);
			const optedOut = await prisma.contact.findMany({
				where: { phone: { in: phones }, optedOut: true },
				select: { phone: true },
			});
			const optedOutSet = new Set(optedOut.map((c) => c.phone));
			const eligible = contacts.filter((c) => !optedOutSet.has(c.phone));
			if (contacts.length - eligible.length > 0) {
				logger.info(
					`[Campaign] Skipping ${contacts.length - eligible.length} opted-out contacts`
				);
			}
			return eligible;
		});

		if (eligibleContacts.length === 0) {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					status: "completed",
					completedAt: new Date(),
					totalMessages: 0,
				},
			});
			return {
				campaignId,
				scenario,
				totalQueued: 0,
				skippedOptedOut: contacts.length,
			};
		}

		// ── Step 3: Build personalised message rows ──────────────────────────────
		const messageRows = await step.run("insert-messages", async () => {
			const rows = eligibleContacts.map((c) => {
				const template =
					c.channel === "whatsapp" ? whatsappTemplate : smsTemplate;
				return {
					id: uuidv4(),
					campaignId,
					contactId: c.id,
					contactName: c.name,
					phone: c.phone,
					channel: c.channel as "whatsapp" | "sms",
					message: personalizeMessage(template, c.name),
					status: "queued" as const,
				};
			});

			await prisma.message.createMany({ data: rows });
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { totalMessages: rows.length },
			});

			logger.info(`[Campaign] Inserted ${rows.length} message rows`);
			return rows;
		});

		// ── Step 4: Fan out ──────────────────────────────────────────────────────
		await step.run("fan-out", async () => {
			// Thread deliveryMode so each worker charges the correct rate.
			// Note: by this point, sms_fallback contacts already have channel="sms"
			// (remapped in campaign.router.ts), so workers just need the mode for
			// the resolveMessageType call.
			const campaignDeliveryMode =
				(
					await prisma.campaign.findUnique({
						where: { id: campaignId },
						select: { deliveryMode: true },
					})
				)?.deliveryMode ?? "marketing";

			const events = messageRows.map((m) => ({
				name: "neon/campaign.send-single" as const,
				data: {
					campaignId,
					userId,
					messageId: m.id,
					contactName: m.contactName,
					phone: m.phone,
					channel: m.channel,
					deliveryMode: campaignDeliveryMode as
						| "marketing"
						| "utility_prescreen"
						| "sms_fallback",

					message: m.message,
					messageType: resolveMessageType(m.channel, campaignDeliveryMode),
				},
			}));
			await inngest.send(events);
			logger.info(`[Campaign] Fanned out ${events.length} send events`);
		});

		return {
			campaignId,
			scenario,
			totalQueued: messageRows.length,
			whatsapp: messageRows.filter((m) => m.channel === "whatsapp").length,
			sms: messageRows.filter((m) => m.channel === "sms").length,
		};
	}
);

// ─── Worker ───────────────────────────────────────────────────────────────────

export const sendSingleMessage = inngest.createFunction(
	{
		id: "send-single-message",
		name: "Send Single Message (Worker)",
		retries: 3,
		rateLimit: {
			limit: 10,
			period: "1s",
			key: "event.data.channel",
		},
		concurrency: {
			limit: 5,
			key: "event.data.campaignId",
		},
		timeouts: { finish: "30s" },
		// Fires when all retries are exhausted without a successful send.
		// We already issued a refund inside persist-result on the first failure,
		// but if Inngest itself crashes mid-step the debit may have landed without
		// the refund. The onFailure guard ensures money is always returned.
		onFailure: async ({ event, error, logger: log }) => {
			const d = event.data.event?.data;
			if (!(d?.userId && d?.messageType)) {
				return;
			}

			// Check if a refund transaction already exists for this message
			const alreadyRefunded = await prisma.transaction.findFirst({
				where: { reference: `refund_${d.messageId}` },
			});
			if (alreadyRefunded) {
				log.info(
					`[onFailure] Refund already issued for messageId=${d.messageId}, skipping`
				);
				return;
			}

			log.warn(
				`[onFailure] All retries exhausted for messageId=${d.messageId} — issuing refund`
			);
			try {
				await refundForMessage({
					userId: d.userId,
					messageType: d.messageType as MessageType,
					campaignId: d.campaignId,
					messageId: d.messageId,
					reason: `all retries exhausted: ${error.message}`,
				});
				log.info(`[onFailure] Refund issued for messageId=${d.messageId}`);
			} catch (e) {
				log.error(
					`[onFailure] REFUND FAILED for messageId=${d.messageId}: ${e}`
				);
			}
		},
	},
	{ event: "neon/campaign.send-single" },

	async ({ event, step, logger }) => {
		const {
			campaignId,
			userId,
			messageId,
			contactName,
			phone,
			channel,
			deliveryMode,
			message,
			messageType,
		} = event.data;

		// ── Step 1: AI content safety check ─────────────────────────────────────
		const contentCheck = await step.run("ai-content-check", () => {
			return checkContent(message, channel);
		});

		if (!contentCheck.safe) {
			await step.run("block-unsafe", async () => {
				logger.warn(
					`[AI Filter] Blocking message to ${contactName}: ${contentCheck.reason}`
				);
				await prisma.message.update({
					where: { id: messageId },
					data: {
						status: "failed",
						errorMessage: `Blocked by safety filter: ${contentCheck.reason}`,
					},
				});
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { failedMessages: { increment: 1 } },
				});
			});
			return { messageId, success: false, reason: "ai_content_blocked" };
		}

		// ── Step 2: Billing debit ────────────────────────────────────────────────
		const billing = await step.run("billing-debit", () => {
			const messageType = resolveMessageType(channel, deliveryMode);
			return debitForMessage({ userId, messageType, campaignId, messageId });
		});

		if (!billing.success) {
			await step.run("pause-campaign", async () => {
				logger.warn(
					`[Campaign] Pausing ${campaignId} — wallet empty for ${userId}`
				);
				await prisma.message.update({
					where: { id: messageId },
					data: {
						status: "failed",
						errorMessage: "Insufficient wallet balance",
					},
				});
				await prisma.campaign.update({
					where: { id: campaignId },
					data: {
						status: "failed",
						failedMessages: { increment: 1 },
						completedAt: new Date(),
					},
				});
				await inngest.send({
					name: "neon/campaign.paused-low-balance",
					data: {
						campaignId,
						userId,
						remainingBalanceKobo: billing.balanceKobo,
					},
				});
			});
			return { messageId, success: false, reason: "insufficient_balance" };
		}

		// ── Step 3: Mark sending ─────────────────────────────────────────────────
		await step.run("mark-sending", async () => {
			await prisma.message.update({
				where: { id: messageId },
				data: { status: "sending" },
			});
		});

		// ── Step 4: Send via Meta (WA) or Termii (SMS) ───────────────────────────
		const result = await step.run("send-message", async () => {
			if (channel === "whatsapp") {
				const r = await sendWhatsAppMessage(phone, message);
				return { success: r.success, externalId: r.messageId, error: r.error };
			}
			const r = await sendSmsMessage(phone, message);
			return { success: r.success, externalId: r.messageId, error: r.error };
		});

		// ── Step 5: Persist result ───────────────────────────────────────────────
		await step.run("persist-result", async () => {
			if (result.success) {
				await prisma.message.update({
					where: { id: messageId },
					data: {
						status: "sent",
						metaMessageId: result.externalId ?? null,
						sentAt: new Date(),
					},
				});
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { sentMessages: { increment: 1 } },
				});
				logger.info(
					`[Send] ✅ ${contactName} via ${channel} — ID: ${result.externalId}`
				);
			} else {
				// Refund the debit — message was charged but never delivered
				await refundForMessage({
					userId,
					messageType,
					campaignId,
					messageId,
					reason: result.error ?? "send failed",
				});
				await prisma.message.update({
					where: { id: messageId },
					data: { status: "failed", errorMessage: result.error },
				});
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { failedMessages: { increment: 1 } },
				});
				logger.error(
					`[Send] ❌ ${contactName}: ${result.error} — refunded ${messageType}`
				);
				throw new Error(`Send failed: ${result.error}`);
			}
		});

		// ── Step 6: Check campaign completion ────────────────────────────────────
		await step.run("check-complete", async () => {
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: {
					totalMessages: true,
					sentMessages: true,
					failedMessages: true,
					status: true,
				},
			});
			if (!campaign || campaign.status !== "processing") {
				return;
			}
			const done = campaign.sentMessages + campaign.failedMessages;
			if (done >= campaign.totalMessages) {
				const finalStatus =
					campaign.failedMessages === campaign.totalMessages
						? "failed"
						: "completed";
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { status: finalStatus, completedAt: new Date() },
				});
				logger.info(`[Campaign] ${campaignId} → ${finalStatus}`);
			}
		});

		return {
			messageId,
			success: result.success,
			externalId: result.externalId,
		};
	}
);

// ─── Low-balance notification ─────────────────────────────────────────────────

export const handleLowBalancePause = inngest.createFunction(
	{
		id: "campaign-paused-low-balance",
		name: "Notify User: Campaign Paused (Low Balance)",
	},
	{ event: "neon/campaign.paused-low-balance" },

	async ({ event, step, logger }) => {
		const { campaignId, userId, remainingBalanceKobo } = event.data as {
			campaignId: string;
			userId: string;
			remainingBalanceKobo: number;
		};

		await step.run("notify-user", async () => {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { email: true, name: true },
			});
			if (!user) {
				return;
			}

			logger.info(
				`[Billing] Campaign ${campaignId} paused for ${user.email} — balance: ${remainingBalanceKobo} kobo`
			);

			await sendMail({
				to: user.email,
				subject: "Your neon campaign was paused — low balance",
				template: LowBalanceEmail({
					name: user.name ?? "",
					campaignId,
					remainingBalanceKobo,
				}),
			});
		});
	}
);
