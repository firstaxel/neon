/**
 * src/inngest/send-campaign-prescreen.ts
 *
 * Utility Pre-Screen delivery mode.
 *
 * Flow:
 *   1. Orchestrator fans out one "prescreen" event per contact
 *   2. Worker sends a cheap UTILITY consent template:
 *        "Hi {name}, {OrgName} wants to send you a message. Reply YES to receive it."
 *   3. Inserts a PendingDelivery row with the real message body + 48h expiry
 *   4. When the contact replies YES → webhook fires sendPendingMessage (below)
 *   5. sendPendingMessage bills + sends the real marketing message
 *
 * Cost saving:
 *   - Utility template ≈ ₦3–5 per contact
 *   - Marketing template ≈ ₦80–100 per contact (only sent to YES replies)
 *   - e.g. 200 contacts: ₦1,000 utility vs ₦20,000 if all get marketing
 *
 * Env requirements (same as send-campaign.ts):
 *   META_PHONE_NUMBER_ID, META_ACCESS_TOKEN, META_WABA_ID
 *   GEMINI_API_KEY (for AI content check before real send)
 *
 * The UTILITY consent template must be pre-approved on your Meta WABA.
 * Template name: configured via PRESCREEN_TEMPLATE_NAME env var
 * Default:       "neon_consent_v1"
 *
 * Example template body (submit to Meta as UTILITY):
 *   "Hi {{1}}, {{2}} wants to send you a message. Reply YES to receive it."
 *   variables: [contactName, orgName]
 */

import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import { debitForMessage, refundForMessage } from "#/features/billing/utils";
import { inngest } from "#/lib/inngest/client";
import { sendTemplateMessage, sendTextMessage } from "#/lib/meta-send";
import { personalizeMessage } from "#/lib/scenarios";
import { sendSmsMessage } from "#/lib/termii";

const PRESCREEN_TEMPLATE =
	process.env.PRESCREEN_TEMPLATE_NAME ?? "neon_consent_v1";
const PRESCREEN_LANGUAGE = process.env.PRESCREEN_TEMPLATE_LANG ?? "en";

// How long a pending delivery stays valid after the consent message is sent.
const PENDING_TTL_HOURS = 48;

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const sendCampaignPrescreen = inngest.createFunction(
	{
		id: "send-campaign-prescreen",
		name: "Send Campaign — Utility Pre-Screen (Orchestrator)",
		retries: 1,
		timeouts: { finish: "10m" },
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
		} = event.data as {
			campaignId: string;
			contacts: Array<{
				id: string;
				name: string;
				phone: string;
				channel: "whatsapp" | "sms";
			}>;
			realWhatsappMessage: string; // the actual body to deliver after YES
			realSmsMessage: string;
			userId: string;
			orgName: string; // shown in the consent message "X wants to send you..."
		};

		logger.info(
			`[Prescreen] campaignId=${campaignId} contacts=${contacts.length}`
		);

		await step.run("mark-processing", async () => {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { status: "processing", startedAt: new Date() },
			});
		});

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

		// Fan out one prescreen event per contact
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
							? personalizeMessage(realWhatsappMessage, c.name)
							: personalizeMessage(realSmsMessage, c.name),
				},
			}));
			await inngest.send(events);
			logger.info(`[Prescreen] fanned out ${events.length} prescreen events`);
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
		retries: 3,
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

		// For SMS channel in prescreen mode — send directly (SMS to WA number)
		// No consent gate needed since we're not using WhatsApp
		if (channel === "sms") {
			const billing = await step.run("billing-debit-sms", () => {
				return debitForMessage({
					userId,
					messageType: "sms",
					campaignId,
					messageId: `sms_${uuidv4()}`,
				});
			});

			if (!billing.success) {
				logger.warn(`[Prescreen/SMS] Wallet empty for userId=${userId}`);
				return { success: false, reason: "insufficient_balance" };
			}

			const result = await step.run("send-sms", () => {
				return sendSmsMessage(phone, realMessage);
			});

			if (result.success) {
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { sentMessages: { increment: 1 } },
				});
				logger.info(`[Prescreen/SMS] ✅ SMS sent to ${contactName}`);
			} else {
				// Refund the SMS debit — message never delivered
				await refundForMessage({
					userId,
					messageType: "sms",
					campaignId,
					messageId: `sms_${phone}`,
					reason: result.error ?? "SMS send failed",
				});
				await prisma.campaign.update({
					where: { id: campaignId },
					data: { failedMessages: { increment: 1 } },
				});
				logger.error(
					`[Prescreen/SMS] ❌ SMS failed for ${contactName}: ${result.error} — refunded`
				);
			}

			return { success: result.success };
		}

		// ── WhatsApp: send the cheap utility consent template ────────────────────
		// Consent message is always a cheap utility template
		const billing = await step.run("billing-debit-consent", () => {
			return debitForMessage({
				userId,
				messageType: "whatsapp_utility",
				campaignId,
				messageId: `prescreen_${uuidv4()}`,
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
				[contactName, orgName] // {{1}} = name, {{2}} = org name
			);
		});

		if (!result.success) {
			// Refund the utility debit — consent message never delivered
			logger.error(
				`[Prescreen] Consent send failed for ${phone}: ${result.error}`
			);
			await refundForMessage({
				userId,
				messageType: "whatsapp_utility",
				campaignId,
				messageId: `prescreen_${phone}`,
				reason: result.error ?? "consent send failed",
			});
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { failedMessages: { increment: 1 } },
			});
			return { success: false, error: result.error };
		}

		// Insert PendingDelivery so webhook can fire the real message on YES reply
		await step.run("insert-pending-delivery", async () => {
			const expiresAt = new Date(
				Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000
			);
			await prisma.pendingDelivery.create({
				data: {
					campaignId,
					contactId: contactId || null,
					contactName,
					phone: phone.replace(phoneRegex, ""), // strip + to match Meta webhook format
					realMessage,
					prescreenMsgId: result.messageId ?? null,
					expiresAt,
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
// Called by the WhatsApp webhook when a contact replies YES

export const sendPendingMessage = inngest.createFunction(
	{
		id: "send-pending-message",
		name: "Send Real Message After YES Reply",
		retries: 3,
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

		// Debit for the real marketing message
		// The real message is sent within 24h of the YES reply (service window),
		// so it costs less than a marketing template.
		const billing = await step.run("billing-debit-real", () => {
			return debitForMessage({
				userId,
				messageType: "whatsapp_service",
				campaignId: pending.campaignId,
				messageId: pending.id,
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

		// Send the real message as plain text (within 24h session window after their reply)
		const result = await step.run("send-real-message", () => {
			return sendTextMessage(phone, pending.realMessage);
		});

		// Mark as replied + create a Message record; refund if send failed
		await step.run("finalize", async () => {
			if (!result.success) {
				// Refund the service-window debit — real message never delivered
				await refundForMessage({
					userId,
					messageType: "whatsapp_service",
					campaignId: pending.campaignId,
					messageId: pending.id,
					reason: result.error ?? "real message send failed",
				});
				logger.warn(
					`[PendingDelivery] Refunded service debit for pendingId=${pendingDeliveryId}`
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
