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

import { NonRetriableError } from "inngest";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import { debitForMessage, refundForMessage } from "#/features/billing/utils";
import { getUtilityTemplate } from "#/features/miscellaneous/meta-templates";
import { personalizeMessage } from "#/features/miscellaneous/scenario";
import { checkContent } from "#/lib/content-check";
import {
	campaignPendingReplyYesEvent,
	campaignPrescreenEvent,
	campaignPrescreenSingleEvent,
	inngest,
} from "#/lib/inngest/client";
import { sendTemplateMessage, sendTextMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";

const PRESCREEN_TEMPLATE =
	process.env.PRESCREEN_TEMPLATE_NAME ?? "Velocast_consent_v1";
const PRESCREEN_LANGUAGE = process.env.PRESCREEN_TEMPLATE_LANG ?? "en";
const PENDING_TTL_HOURS = 48;
const FAN_OUT_BATCH_SIZE = 100;

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const sendCampaignPrescreen = inngest.createFunction(
	{
		id: "send-campaign-prescreen",
		name: "Send Campaign — Utility Pre-Screen (Orchestrator)",
		retries: 1,
		timeouts: { finish: "15m" },
		triggers: [campaignPrescreenEvent],
	},
	async ({ event, step, logger }) => {
		const {
			campaignId,
			contactIds,
			realWhatsappMessage,
			realSmsMessage,
			userId,
			orgName,
			templateVars,
			scenario,
		} = event.data;

		logger.info(
			`[Prescreen] campaignId=${campaignId} contactIds=${contactIds.length}`
		);

		await step.run("mark-processing", async () => {
			await prisma.campaign.update({
				data: { startedAt: new Date(), status: "processing" },
				where: { id: campaignId },
			});
		});

		// Fetch orgType for per-scenario utility template selection
		const orgType = await step.run("fetch-org-type", async () => {
			const profile = await prisma.userProfile.findUnique({
				select: { orgType: true },
				where: { userId },
			});
			return profile?.orgType ?? "other";
		});

		// Fetch full contact data from DB — event only contains IDs
		const contacts = await step.run("fetch-contacts", async () => {
			const rows = await prisma.contact.findMany({
				select: { channel: true, id: true, name: true, phone: true },
				where: { id: { in: contactIds }, uploadedBy: userId },
			});
			return rows as Array<{
				id: string;
				name: string;
				phone: string;
				channel: "whatsapp" | "sms";
			}>;
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
					data: {
						completedAt: new Date(),
						failedMessages: contacts.length,
						status: "failed",
						totalMessages: contacts.length,
					},
					where: { id: campaignId },
				});
			});
			return { blocked: true, campaignId, reason: contentCheck.reason };
		}

		// Filter opted-out contacts
		const eligible = await step.run("filter-opted-out", async () => {
			const phones = contacts.map((c) => c.phone);
			const optedOut = await prisma.contact.findMany({
				select: { phone: true },
				where: { optedOut: true, phone: { in: phones } },
			});
			const set = new Set(optedOut.map((c) => c.phone));
			return contacts.filter((c) => !set.has(c.phone));
		});

		if (eligible.length === 0) {
			await prisma.campaign.update({
				data: {
					completedAt: new Date(),
					status: "completed",
					totalMessages: 0,
				},
				where: { id: campaignId },
			});
			return { campaignId, totalQueued: 0 };
		}

		await step.run("update-total", async () => {
			await prisma.campaign.update({
				data: { totalMessages: eligible.length },
				where: { id: campaignId },
			});
		});

		// Batched fan-out — stagger to avoid free-plan cancellations
		const batches = Array.from(
			{ length: Math.ceil(eligible.length / FAN_OUT_BATCH_SIZE) },
			(_, batchIndex) => {
				const i = batchIndex * FAN_OUT_BATCH_SIZE;
				const batch = eligible.slice(i, i + FAN_OUT_BATCH_SIZE);
				return {
					events: batch.map((c) => ({
						data: {
							campaignId,
							channel: c.channel,
							contactId: c.id,
							contactName: c.name,
							orgName,
							orgType,
							phone: c.phone,
							realMessage:
								c.channel === "whatsapp"
									? personalizeMessage(
											realWhatsappMessage,
											c.name,
											templateVars
										)
									: personalizeMessage(realSmsMessage, c.name, templateVars),
							scenario,
							userId,
						},
						name: "Velocast/campaign.prescreen-single" as const,
					})),
					i,
				};
			}
		);

		await batches.reduce(
			(chain, { i, events }, batchIndex) =>
				chain
					.then(() => step.sendEvent(`fan-out-batch-${i}`, events))
					.then(() =>
						batchIndex < batches.length - 1
							? step.sleep(`fan-out-delay-${i}`, "3s")
							: undefined
					),
			Promise.resolve()
		);

		logger.info(
			`[Prescreen] Fanned out ${eligible.length} events in ${Math.ceil(eligible.length / FAN_OUT_BATCH_SIZE)} batch(es)`
		);

		return { campaignId, totalQueued: eligible.length };
	}
);

// ─── Per-contact worker ───────────────────────────────────────────────────────

const phoneRegex = /^\+/;
export const sendPrescreenSingle = inngest.createFunction(
	{
		id: "send-prescreen-single",
		name: "Send Pre-Screen Consent Message (Worker)",
		retries: 0,

		timeouts: { finish: "30s" },
		triggers: [campaignPrescreenSingleEvent],
	},
	async ({ event, step, logger }) => {
		const {
			campaignId,
			userId,
			orgName,
			orgType,
			scenario,
			contactId,
			contactName,
			phone,
			channel,
			realMessage,
		} = event.data as {
			campaignId: string;
			userId: string;
			orgName: string;
			orgType: string;
			scenario: string;
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
					return { balanceKobo: 0, success: true };
				}
				return debitForMessage({
					campaignId,
					messageId: smsBillingId,
					messageType: "sms",
					userId,
				});
			});

			if (!billing.success) {
				logger.warn(`[Prescreen/SMS] Wallet empty for userId=${userId}`);
				return { reason: "insufficient_balance", success: false };
			}

			const result = await step.run("send-sms", async () =>
				sendSmsMessage(phone, realMessage)
			);

			if (result.success) {
				await prisma.$transaction(async (tx) => {
					await tx.campaign.update({
						data: { sentMessages: { increment: 1 } },
						where: { id: campaignId },
					});
					const camp = await tx.campaign.findUnique({
						select: {
							failedMessages: true,
							sentMessages: true,
							totalMessages: true,
						},
						where: { id: campaignId },
					});
					if (
						camp &&
						camp.sentMessages + camp.failedMessages >= camp.totalMessages
					) {
						await tx.campaign.update({
							data: {
								completedAt: new Date(),
								status:
									camp.failedMessages >= camp.totalMessages
										? "failed"
										: "completed",
							},
							where: { id: campaignId },
						});
					}
				});
				logger.info(`[Prescreen/SMS] ✅ SMS sent to ${contactName}`);
			} else {
				// Refund guard
				const alreadyRefunded = await prisma.transaction.findFirst({
					where: { reference: `refund_${smsBillingId}` },
				});
				if (!alreadyRefunded) {
					await refundForMessage({
						campaignId,
						messageId: smsBillingId,
						messageType: "sms",
						reason: result.error ?? "SMS send failed",
						userId,
					});
				}
				await prisma.$transaction(async (tx) => {
					await tx.campaign.update({
						data: { failedMessages: { increment: 1 } },
						where: { id: campaignId },
					});
					const camp = await tx.campaign.findUnique({
						select: {
							failedMessages: true,
							sentMessages: true,
							totalMessages: true,
						},
						where: { id: campaignId },
					});
					if (
						camp &&
						camp.sentMessages + camp.failedMessages >= camp.totalMessages
					) {
						await tx.campaign.update({
							data: {
								completedAt: new Date(),
								status:
									camp.failedMessages >= camp.totalMessages
										? "failed"
										: "completed",
							},
							where: { id: campaignId },
						});
					}
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
				return { balanceKobo: 0, success: true };
			}
			return debitForMessage({
				campaignId,
				messageId: prescreenBillingId,
				messageType: "whatsapp_utility",
				userId,
			});
		});

		if (!billing.success) {
			logger.warn(`[Prescreen] Wallet empty for userId=${userId}`);
			await inngest.send({
				data: { campaignId, remainingBalanceKobo: billing.balanceKobo, userId },
				name: "Velocast/campaign.paused-low-balance",
			});
			return { reason: "insufficient_balance", success: false };
		}

		const result = await step.run("send-consent-template", () => {
			// Resolve the warm, scenario-specific utility template for this org type.
			// Falls back to the generic consent template if no match.
			const utilityTpl = getUtilityTemplate(
				orgType,
				scenario as Parameters<typeof getUtilityTemplate>[1]
			);
			const templateName = utilityTpl?.name ?? PRESCREEN_TEMPLATE;
			logger.info(
				`[Prescreen] Using utility template: ${templateName} (org=${orgType}, scenario=${scenario})`
			);
			return sendTemplateMessage(phone, templateName, PRESCREEN_LANGUAGE, [
				contactName,
				orgName,
			]);
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
					campaignId,
					messageId: prescreenBillingId,
					messageType: "whatsapp_utility",
					reason: result.error ?? "consent send failed",
					userId,
				});

				logger.error(
					`[Prescreen] ❌ Consent failed for ${phone}: ${result.error}`
				);
			});

			await step.run("throw-sending error", async () => {
				await prisma.message.update({
					data: { errorMessage: result.error, status: "failed" },
					where: { id: prescreenBillingId },
				});

				await prisma.$transaction(async (tx) => {
					const campaignDetails = await tx.campaign.findUnique({
						select: {
							failedMessages: true,
							totalMessages: true,
						},
						where: {
							id: campaignId,
						},
					});

					if (
						campaignDetails?.totalMessages === campaignDetails?.failedMessages
					) {
						await prisma.campaign.update({
							data: { status: "failed" },
							where: { id: campaignId },
						});
					}
				});
			});
			throw new NonRetriableError(
				result.error ?? "Error sending the messages to the contact"
			);
		}

		await step.run("insert-pending-delivery", async () => {
			const expiresAt = new Date(
				Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000
			);
			await prisma.pendingDelivery.upsert({
				create: {
					campaignId,
					contactId: contactId || null,
					contactName,
					expiresAt,
					id: `pd_${campaignId}_${phone.replace(/\D/g, "")}`,
					phone: phone.replace(phoneRegex, ""),
					prescreenMsgId: result.messageId ?? null,
					realMessage,
				},
				update: {
					expiresAt,
					// Idempotent: if consent was re-sent (e.g. step retried), refresh expiry
					prescreenMsgId: result.messageId ?? null,
					replied: false,
				},
				where: { id: `pd_${campaignId}_${phone.replace(/\D/g, "")}` },
			});
		});

		await prisma.campaign.update({
			data: { sentMessages: { increment: 1 } },
			where: { id: campaignId },
		});

		logger.info(
			`[Prescreen] ✅ Consent sent to ${contactName} — pending YES reply`
		);
		return { pendingPhone: phone, success: true };
	}
);

// ─── Send real message after YES reply ───────────────────────────────────────

export const sendPendingMessage = inngest.createFunction(
	{
		id: "send-pending-message",
		name: "Send Real Message After YES Reply",
		retries: 2,
		timeouts: { finish: "30s" },
		triggers: [campaignPendingReplyYesEvent],
	},
	async ({ event, step, logger }) => {
		const { pendingDeliveryId, phone } = event.data as {
			pendingDeliveryId: string;
			phone: string;
		};

		const pending = await step.run("load-pending", () =>
			prisma.pendingDelivery.findUnique({
				include: { campaign: { select: { id: true, userId: true } } },
				where: { id: pendingDeliveryId },
			})
		);

		if (!pending) {
			logger.warn(`[PendingDelivery] ${pendingDeliveryId} not found`);
			return { reason: "not_found", success: false };
		}
		if (pending.replied) {
			logger.info(
				`[PendingDelivery] Already replied — skipping ${pendingDeliveryId}`
			);
			return { reason: "already_replied", success: false };
		}
		if (new Date(pending.expiresAt) < new Date()) {
			logger.info(`[PendingDelivery] Expired — skipping ${pendingDeliveryId}`);
			return { reason: "expired", success: false };
		}

		const { userId } = pending.campaign;

		// Billing debit — idempotent
		const billing = await step.run("billing-debit-real", async () => {
			const existing = await prisma.transaction.findFirst({
				where: { reference: `msg_${pendingDeliveryId}` },
			});
			if (existing) {
				logger.info(
					`[PendingDelivery] Already debited ${pendingDeliveryId} — skipping`
				);
				return { balanceKobo: 0, success: true };
			}
			return debitForMessage({
				campaignId: pending.campaignId,
				messageId: pendingDeliveryId,
				messageType: "whatsapp_service",
				userId,
			});
		});

		if (!billing.success) {
			logger.warn(`[PendingDelivery] Wallet empty for userId=${userId}`);
			await inngest.send({
				data: {
					campaignId: pending.campaignId,
					remainingBalanceKobo: billing.balanceKobo,
					userId,
				},
				name: "Velocast/campaign.paused-low-balance",
			});
			return { reason: "insufficient_balance", success: false };
		}

		const result = await step.run("send-real-message", () =>
			sendTextMessage(phone, pending.realMessage)
		);

		await step.run("finalize", async () => {
			if (!result.success) {
				// Refund guard
				const alreadyRefunded = await prisma.transaction.findFirst({
					where: { reference: `refund_${pendingDeliveryId}` },
				});
				if (!alreadyRefunded) {
					await refundForMessage({
						campaignId: pending.campaignId,
						messageId: pendingDeliveryId,
						messageType: "whatsapp_service",
						reason: result.error ?? "real message send failed",
						userId,
					});
				}
				logger.warn(
					`[PendingDelivery] Refunded service debit for ${pendingDeliveryId}`
				);
			}

			await prisma.$transaction([
				prisma.pendingDelivery.update({
					data: { replied: true, repliedAt: new Date() },
					where: { id: pendingDeliveryId },
				}),
				prisma.message.create({
					data: {
						campaignId: pending.campaignId,
						channel: "whatsapp",
						contactId: pending.contactId ?? undefined,
						contactName: pending.contactName,
						errorMessage: result.error ?? null,
						id: uuidv4(),
						message: pending.realMessage,
						metaMessageId: result.messageId ?? null,
						phone,
						sentAt: result.success ? new Date() : null,
						status: result.success ? "sent" : "failed",
					},
				}),
			]);
		});

		logger.info(
			`[PendingDelivery] ${result.success ? "✅ Real message sent" : "❌ Send failed, refunded"} — ${pending.contactName}`
		);
		return { messageId: result.messageId, success: result.success };
	}
);

// ─── Helper: direct SMS send ──────────────────────────────────────────────────
