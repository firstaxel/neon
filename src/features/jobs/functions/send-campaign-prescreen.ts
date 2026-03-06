/**
 * src/inngest/send-campaign-prescreen.ts
 *
 * Utility Pre-Screen delivery mode.
 *
 * ── Bug fixes (v2) ──────────────────────────────────────────────────────────
 *
 * Same class of bugs as send-campaign.ts:
 *  - Removed throw after send failure (was causing failedMessages double-increment)
 *  - Added idempotency guard on billing-debit-consent step
 *  - Batched fan-out in chunks of FAN_OUT_BATCH_SIZE
 *  - Moved AI check to orchestrator level (was missing in prescreen path entirely)
 *
 * Flow:
 *   1. Orchestrator AI-checks the real message template body once
 *   2. Fans out one prescreen event per contact (batched)
 *   3. Worker sends cheap UTILITY consent template per contact
 *   4. Inserts PendingDelivery row with 48h expiry
 *   5. When contact replies YES → sendPendingMessage fires
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import { env } from "#/env";
import { debitForMessage, refundForMessage } from "#/features/billing/utils";
import { personalizeMessage } from "#/features/miscellaneous/scenario";
import { inngest } from "#/lib/inngest/client";
import { sendTemplateMessage, sendTextMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";

const PRESCREEN_TEMPLATE =
	process.env.PRESCREEN_TEMPLATE_NAME ?? "neon_consent_v1";
const PRESCREEN_LANGUAGE = process.env.PRESCREEN_TEMPLATE_LANG ?? "en";
const PENDING_TTL_HOURS = 48;
const FAN_OUT_BATCH_SIZE = 100;

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

async function checkContent(
	message: string
): Promise<{ safe: boolean; reason?: string }> {
	try {
		const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
		const prompt = `You are a messaging compliance checker. Normal marketing outreach is SAFE.
Mark UNSAFE only for: spam, threats, sexual content, fraud, hate speech.
Message: """${message.slice(0, 800)}"""
Reply ONLY with JSON (no markdown): {"safe": true, "reason": null}`;
		const result = await model.generateContent(prompt);
		const text = result.response
			.text()
			.trim()
			.replace(/```json\n?|```\n?/g, "");
		return JSON.parse(text) as { safe: boolean; reason?: string };
	} catch {
		return { safe: true };
	}
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const sendCampaignPrescreen = inngest.createFunction(
	{
		id: "send-campaign-prescreen",
		name: "Send Campaign — Utility Pre-Screen (Orchestrator)",
		retries: 1,
		timeouts: { finish: "15m" },
	},
	{ event: "neon/campaign.prescreen" },

	async ({ event, step, logger }) => {
		const {
			campaignId,
			contacts,
			realWhatsappMessage,
			realSmsMessage,
			userId,
			orgName,
			templateVars,
		} = event.data;

		logger.info(
			`[Prescreen] campaignId=${campaignId} contacts=${contacts.length}`
		);

		await step.run("mark-processing", async () => {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { status: "processing", startedAt: new Date() },
			});
		});

		// AI check once — on the real message body that will eventually be delivered
		const contentCheck = await step.run("ai-content-check", () => {
			const waContacts = contacts.filter((c) => c.channel === "whatsapp");
			const body = waContacts.length > 0 ? realWhatsappMessage : realSmsMessage;
			return checkContent(body);
		});

		if (!contentCheck.safe) {
			await step.run("block-unsafe-campaign", async () => {
				logger.warn(
					`[AI Filter] Blocking prescreen campaign ${campaignId}: ${contentCheck.reason}`
				);
				await prisma.campaign.update({
					where: { id: campaignId },
					data: {
						status: "failed",
						completedAt: new Date(),
						totalMessages: contacts.length,
						failedMessages: contacts.length,
					},
				});
			});
			return { campaignId, blocked: true, reason: contentCheck.reason };
		}

		// Filter opted-out contacts
		const eligible = await step.run("filter-opted-out", async () => {
			const phones = contacts.map((c) => c.phone);
			const optedOut = await prisma.contact.findMany({
				where: { phone: { in: phones }, optedOut: true },
				select: { phone: true },
			});
			const set = new Set(optedOut.map((c) => c.phone));
			return contacts.filter((c) => !set.has(c.phone));
		});

		if (eligible.length === 0) {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					status: "completed",
					completedAt: new Date(),
					totalMessages: 0,
				},
			});
			return { campaignId, totalQueued: 0 };
		}

		await step.run("update-total", async () => {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { totalMessages: eligible.length },
			});
		});

		// Batched fan-out
		await step.run("fan-out", async () => {
			const events = eligible.map((c) => ({
				name: "neon/campaign.prescreen-single" as const,
				data: {
					campaignId,
					userId,
					orgName,
					contactId: c.id,
					contactName: c.name,
					phone: c.phone,
					channel: c.channel,
					realMessage:
						c.channel === "whatsapp"
							? personalizeMessage(realWhatsappMessage, c.name, templateVars)
							: personalizeMessage(realSmsMessage, c.name, templateVars),
				},
			}));

			for (let i = 0; i < events.length; i += FAN_OUT_BATCH_SIZE) {
				await inngest.send(events.slice(i, i + FAN_OUT_BATCH_SIZE));
			}
			logger.info(
				`[Prescreen] Fanned out ${events.length} events in ${Math.ceil(events.length / FAN_OUT_BATCH_SIZE)} batch(es)`
			);
		});

		return { campaignId, totalQueued: eligible.length };
	}
);

// ─── Per-contact worker ───────────────────────────────────────────────────────

const phoneRegex = /^\+/;
export const sendPrescreenSingle = inngest.createFunction(
	{
		id: "send-prescreen-single",
		name: "Send Pre-Screen Consent Message (Worker)",
		retries: 2,
		rateLimit: { limit: 10, period: "1s", key: "event.data.channel" },
		concurrency: { limit: 5, key: "event.data.campaignId" },
		timeouts: { finish: "30s" },
	},
	{ event: "neon/campaign.prescreen-single" },

	async ({ event, step, logger }) => {
		const {
			campaignId,
			userId,
			orgName,
			contactId,
			contactName,
			phone,
			channel,
			realMessage,
		} = event.data as {
			campaignId: string;
			userId: string;
			orgName: string;
			contactId: string;
			contactName: string;
			phone: string;
			channel: "whatsapp" | "sms";
			realMessage: string;
		};

		// SMS contacts in prescreen mode — send directly (no consent gate needed)
		if (channel === "sms") {
			const smsBillingId = `sms_${campaignId}_${phone.replace(/\D/g, "")}`;

			const billing = await step.run("billing-debit-sms", async () => {
				const existing = await prisma.transaction.findFirst({
					where: { reference: `msg_${smsBillingId}` },
				});
				if (existing) {
					return { success: true, balanceKobo: 0 };
				}
				return debitForMessage({
					userId,
					messageType: "sms",
					campaignId,
					messageId: smsBillingId,
				});
			});

			if (!billing.success) {
				logger.warn(`[Prescreen/SMS] Wallet empty for userId=${userId}`);
				return { success: false, reason: "insufficient_balance" };
			}

			const result = await step.run("send-sms", async () =>
				sendSmsMessage(phone, realMessage)
			);

			if (result.success) {
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { sentMessages: { increment: 1 } },
				});
				logger.info(`[Prescreen/SMS] ✅ SMS sent to ${contactName}`);
			} else {
				// Refund guard
				const alreadyRefunded = await prisma.transaction.findFirst({
					where: { reference: `refund_${smsBillingId}` },
				});
				if (!alreadyRefunded) {
					await refundForMessage({
						userId,
						messageType: "sms",
						campaignId,
						messageId: smsBillingId,
						reason: result.error ?? "SMS send failed",
					});
				}
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { failedMessages: { increment: 1 } },
				});
				logger.error(
					`[Prescreen/SMS] ❌ SMS failed for ${contactName}: ${result.error}`
				);
				// ✅ No throw — failure is terminal
			}

			return { success: result.success };
		}

		// Stable billing key for this consent send (not a message row ID)
		const prescreenBillingId = `prescreen_${campaignId}_${phone.replace(/\D/g, "")}`;

		// ── Billing debit — IDEMPOTENT ───────────────────────────────────────────
		const billing = await step.run("billing-debit-consent", async () => {
			// Idempotency: if we already debited for this consent send, skip
			const existing = await prisma.transaction.findFirst({
				where: { reference: `msg_${prescreenBillingId}` },
			});
			if (existing) {
				logger.info(
					`[Prescreen] Already debited consent for ${phone} — skipping`
				);
				return { success: true, balanceKobo: 0 };
			}
			return debitForMessage({
				userId,
				messageType: "whatsapp_utility",
				campaignId,
				messageId: prescreenBillingId,
			});
		});

		if (!billing.success) {
			logger.warn(`[Prescreen] Wallet empty for userId=${userId}`);
			await inngest.send({
				name: "neon/campaign.paused-low-balance",
				data: { campaignId, userId, remainingBalanceKobo: billing.balanceKobo },
			});
			return { success: false, reason: "insufficient_balance" };
		}

		const result = await step.run("send-consent-template", () => {
			return sendTemplateMessage(
				phone,
				PRESCREEN_TEMPLATE,
				PRESCREEN_LANGUAGE,
				[contactName, orgName]
			);
		});

		if (!result.success) {
			// Refund guard — don't double-refund
			await step.run("refund-consent", async () => {
				const alreadyRefunded = await prisma.transaction.findFirst({
					where: { reference: `refund_${prescreenBillingId}` },
				});
				if (alreadyRefunded) {
					return;
				}
				await refundForMessage({
					userId,
					messageType: "whatsapp_utility",
					campaignId,
					messageId: prescreenBillingId,
					reason: result.error ?? "consent send failed",
				});
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { failedMessages: { increment: 1 } },
				});
				logger.error(
					`[Prescreen] ❌ Consent failed for ${phone}: ${result.error}`
				);
			});
			// ✅ Return without throwing — failure is terminal, not retryable
			return { success: false, error: result.error };
		}

		await step.run("insert-pending-delivery", async () => {
			const expiresAt = new Date(
				Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000
			);
			await prisma.pendingDelivery.upsert({
				where: { id: `pd_${campaignId}_${phone.replace(/\D/g, "")}` },
				create: {
					id: `pd_${campaignId}_${phone.replace(/\D/g, "")}`,
					campaignId,
					contactId: contactId || null,
					contactName,
					phone: phone.replace(phoneRegex, ""),
					realMessage,
					prescreenMsgId: result.messageId ?? null,
					expiresAt,
				},
				update: {
					// Idempotent: if consent was re-sent (e.g. step retried), refresh expiry
					prescreenMsgId: result.messageId ?? null,
					expiresAt,
					replied: false,
				},
			});
		});

		await prisma.campaign.update({
			where: { id: campaignId },
			data: { sentMessages: { increment: 1 } },
		});

		logger.info(
			`[Prescreen] ✅ Consent sent to ${contactName} — pending YES reply`
		);
		return { success: true, pendingPhone: phone };
	}
);

// ─── Send real message after YES reply ───────────────────────────────────────

export const sendPendingMessage = inngest.createFunction(
	{
		id: "send-pending-message",
		name: "Send Real Message After YES Reply",
		retries: 2,
		timeouts: { finish: "30s" },
	},
	{ event: "neon/campaign.pending-reply-yes" },

	async ({ event, step, logger }) => {
		const { pendingDeliveryId, phone } = event.data as {
			pendingDeliveryId: string;
			phone: string;
		};

		const pending = await step.run("load-pending", () => {
			return prisma.pendingDelivery.findUnique({
				where: { id: pendingDeliveryId },
				include: { campaign: { select: { userId: true, id: true } } },
			});
		});

		if (!pending) {
			logger.warn(`[PendingDelivery] ${pendingDeliveryId} not found`);
			return { success: false, reason: "not_found" };
		}
		if (pending.replied) {
			logger.info(
				`[PendingDelivery] Already replied — skipping ${pendingDeliveryId}`
			);
			return { success: false, reason: "already_replied" };
		}
		if (new Date(pending.expiresAt) < new Date()) {
			logger.info(`[PendingDelivery] Expired — skipping ${pendingDeliveryId}`);
			return { success: false, reason: "expired" };
		}

		const userId = pending.campaign.userId;

		// Billing debit — idempotent
		const billing = await step.run("billing-debit-real", async () => {
			const existing = await prisma.transaction.findFirst({
				where: { reference: `msg_${pendingDeliveryId}` },
			});
			if (existing) {
				logger.info(
					`[PendingDelivery] Already debited ${pendingDeliveryId} — skipping`
				);
				return { success: true, balanceKobo: 0 };
			}
			return debitForMessage({
				userId,
				messageType: "whatsapp_service",
				campaignId: pending.campaignId,
				messageId: pendingDeliveryId,
			});
		});

		if (!billing.success) {
			logger.warn(`[PendingDelivery] Wallet empty for userId=${userId}`);
			await inngest.send({
				name: "neon/campaign.paused-low-balance",
				data: {
					campaignId: pending.campaignId,
					userId,
					remainingBalanceKobo: billing.balanceKobo,
				},
			});
			return { success: false, reason: "insufficient_balance" };
		}

		const result = await step.run("send-real-message", () => {
			return sendTextMessage(phone, pending.realMessage);
		});

		await step.run("finalize", async () => {
			if (!result.success) {
				// Refund guard
				const alreadyRefunded = await prisma.transaction.findFirst({
					where: { reference: `refund_${pendingDeliveryId}` },
				});
				if (!alreadyRefunded) {
					await refundForMessage({
						userId,
						messageType: "whatsapp_service",
						campaignId: pending.campaignId,
						messageId: pendingDeliveryId,
						reason: result.error ?? "real message send failed",
					});
				}
				logger.warn(
					`[PendingDelivery] Refunded service debit for ${pendingDeliveryId}`
				);
			}

			await prisma.$transaction([
				prisma.pendingDelivery.update({
					where: { id: pendingDeliveryId },
					data: { replied: true, repliedAt: new Date() },
				}),
				prisma.message.create({
					data: {
						id: uuidv4(),
						campaignId: pending.campaignId,
						contactId: pending.contactId ?? undefined,
						contactName: pending.contactName,
						phone,
						channel: "whatsapp",
						message: pending.realMessage,
						status: result.success ? "sent" : "failed",
						metaMessageId: result.messageId ?? null,
						errorMessage: result.error ?? null,
						sentAt: result.success ? new Date() : null,
					},
				}),
			]);
		});

		logger.info(
			`[PendingDelivery] ${result.success ? "✅ Real message sent" : "❌ Send failed, refunded"} — ${pending.contactName}`
		);
		return { success: result.success, messageId: result.messageId };
	}
);

// ─── Helper: direct SMS send ──────────────────────────────────────────────────
