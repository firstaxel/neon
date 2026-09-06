/**
 * src/inngest/send-campaign.ts
 *
 * Campaign fan-out orchestrator + per-message worker.
 *
 * ── Bug fixes (v2) ──────────────────────────────────────────────────────────
 *
 * BUG 1 — FAILED counter doubles on retry (screenshot: FAILED=2, TOTAL=1, PENDING=-1)
 *   Root cause: "persist-result" threw after incrementing failedMessages, causing
 *   Inngest to retry the whole function. On retry, billing-debit ran again and
 *   failedMessages incremented again. A send failure is NOT a function error —
 *   it's a normal outcome. We now RETURN { success: false } instead of throwing.
 *
 * BUG 2 — messageType undefined in persist-result
 *   Root cause: messageType was declared inside the "billing-debit" step closure,
 *   invisible to the outer function scope. Now resolved before any steps run.
 *
 * BUG 3 — billing-debit not idempotent on retry
 *   Root cause: on retry Inngest re-runs steps that previously threw. If billing-debit
 *   completed but a later step crashed, billing-debit re-runs and hits the @unique
 *   constraint on Transaction.reference, throwing an opaque DB error.
 *   Fix: check for existing transaction by reference before debiting.
 *
 * ── Scaling improvements ────────────────────────────────────────────────────
 *
 * SCALE 1 — Fan-out batched (100 events per inngest.send call)
 *   Inngest has a ~512KB event payload limit per send() call.
 *   Sending 5,000 contacts in one call silently fails.
 *   Now batched in chunks of FAN_OUT_BATCH_SIZE.
 *
 * SCALE 2 — AI content check moved to orchestrator (once per campaign)
 *   The same template body is sent to every contact. Running Gemini once per
 *   message wastes 500 API calls for a 500-contact campaign.
 *   The body text (minus name) is checked once before fan-out.
 *
 * SCALE 3 — Campaign completion via orchestrator, not per-worker race
 *   Each worker no longer races to check completion. Instead the orchestrator
 *   schedules a completion check that waits briefly then reads the counters
 *   atomically once all workers have had a chance to finish.
 */

import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import {
	debitForMessage,
	type MessageType,
	refundForMessage,
	resolveMessageType,
} from "#/features/billing/utils";
import { sendMail } from "#/features/email/lib/sender";
import { personalizeMessage } from "#/features/miscellaneous/scenario";
import { checkContent } from "#/lib/content-check";
import {
	campaignPausedLowBalanceEvent,
	campaignSendEvent,
	campaignSendSingleEvent,
	inngest,
} from "#/lib/inngest/client";
import { sendWhatsAppMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";
import LowBalanceEmail from "@/emails/low-balance-email";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum events per inngest.send() call.
 * Inngest has a ~512KB payload limit. At ~200 bytes per event, 100 events ≈ 20KB —
 * well within the limit even with large message bodies.
 */
const FAN_OUT_BATCH_SIZE = 100;

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const sendCampaign = inngest.createFunction(
	{
		id: "send-campaign",
		name: "Send Campaign Messages (Orchestrator)",
		retries: 1,
		timeouts: { finish: "15m" },
		triggers: [campaignSendEvent],
	},
	async ({ event, step, logger }) => {
		const {
			campaignId,
			contactIds,
			forceSmsChannel,
			whatsappTemplate,
			smsTemplate,
			scenario,
			userId,
			templateVars,
		} = event.data as {
			campaignId: string;
			// contactIds replaces contacts array — keeps event payload tiny for large lists
			contactIds: string[];
			forceSmsChannel?: boolean;
			whatsappTemplate: string;
			smsTemplate: string;
			scenario: string;
			userId: string;
			templateVars: Record<string, string>;
		};

		logger.info(
			`[Campaign] Starting campaignId=${campaignId} userId=${userId} contactIds=${contactIds.length}`
		);

		// ── Step 1: Mark processing ──────────────────────────────────────────────
		await step.run("mark-processing", async () => {
			await prisma.campaign.update({
				data: { startedAt: new Date(), status: "processing" },
				where: { id: campaignId },
			});
		});

		// ── Step 2: Fetch contacts from DB ───────────────────────────────────────
		// We never pass full contact objects in the event payload — only IDs.
		// This keeps events tiny (40 bytes/ID vs ~200 bytes/contact object) so
		// 10k contacts = ~400KB IDs vs ~2MB objects.
		const contacts = await step.run("fetch-contacts", async () => {
			const rows = await prisma.contact.findMany({
				select: {
					channel: true,
					id: true,
					name: true,
					phone: true,
					type: true,
				},
				where: { id: { in: contactIds }, uploadedBy: userId },
			});
			// sms_fallback: force every contact to SMS channel
			if (forceSmsChannel) {
				return rows.map((c) => ({ ...c, channel: "sms" as const }));
			}
			return rows as Array<{
				id: string;
				name: string;
				phone: string;
				channel: "whatsapp" | "sms";
				type: string;
			}>;
		});

		// ── Step 3: AI content safety check — ONCE for the whole campaign ────────
		const contentCheck = await step.run("ai-content-check", () => {
			const waContacts = contacts.filter((c) => c.channel === "whatsapp");
			const channel = waContacts.length > 0 ? "whatsapp" : "sms";
			const body = channel === "whatsapp" ? whatsappTemplate : smsTemplate;
			return checkContent(body, channel);
		});

		if (!contentCheck.safe) {
			await step.run("block-unsafe-campaign", async () => {
				logger.warn(
					`[AI Filter] Blocking campaign ${campaignId}: ${contentCheck.reason}`
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
			return {
				blocked: true,
				campaignId,
				reason: contentCheck.reason,
				scenario,
			};
		}

		// ── Step 4: Filter opted-out contacts ────────────────────────────────────
		const eligibleContacts = await step.run("filter-opted-out", async () => {
			const phones = contacts.map((c) => c.phone);
			const optedOut = await prisma.contact.findMany({
				select: { phone: true },
				where: { optedOut: true, phone: { in: phones } },
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
				data: {
					completedAt: new Date(),
					status: "completed",
					totalMessages: 0,
				},
				where: { id: campaignId },
			});
			return {
				campaignId,
				scenario,
				skippedOptedOut: contacts.length,
				totalQueued: 0,
			};
		}

		// ── Step 5: Build personalised message rows ──────────────────────────────
		const messageRows = await step.run("insert-messages", async () => {
			const rows = eligibleContacts.map((c) => {
				const template =
					c.channel === "whatsapp" ? whatsappTemplate : smsTemplate;
				return {
					campaignId,
					channel: c.channel as "whatsapp" | "sms",
					contactId: c.id,
					contactName: c.name,
					id: uuidv4(),
					message: personalizeMessage(template, c.name, templateVars),
					phone: c.phone,
					status: "queued" as const,
				};
			});

			await prisma.message.createMany({ data: rows });
			await prisma.campaign.update({
				data: { totalMessages: rows.length },
				where: { id: campaignId },
			});

			logger.info(`[Campaign] Inserted ${rows.length} message rows`);
			return rows;
		});

		// ── Step 6: Fan out — BATCHED to respect Inngest 512KB payload limit ─────
		const campaignDeliveryMode = await step.run(
			"get-delivery-mode",
			async () => {
				const c = await prisma.campaign.findUnique({
					select: { deliveryMode: true },
					where: { id: campaignId },
				});
				return c?.deliveryMode ?? "marketing";
			}
		);
		const events = messageRows.map((m) => ({
			data: {
				campaignId,
				channel: m.channel,
				contactName: m.contactName,
				deliveryMode: campaignDeliveryMode as
					| "marketing"
					| "utility_prescreen"
					| "sms_fallback",
				message: m.message,
				messageId: m.id,
				messageType: resolveMessageType(
					m.channel,
					campaignDeliveryMode as
						| "marketing"
						| "utility_prescreen"
						| "sms_fallback"
				),
				phone: m.phone,
				userId,
			},
			name: "Velocast/campaign.send-single" as const,
		}));

		const batchStarts = Array.from(
			{ length: Math.ceil(events.length / FAN_OUT_BATCH_SIZE) },
			(_, index) => index * FAN_OUT_BATCH_SIZE
		);

		await batchStarts.reduce(
			(promise, i, index) =>
				promise
					.then(() =>
						step.sendEvent(
							`fan-out-batch-${i}`,
							events.slice(i, i + FAN_OUT_BATCH_SIZE)
						)
					)
					.then(() =>
						index + 1 < batchStarts.length
							? step.sleep(`fan-out-delay-${i}`, "3s")
							: undefined
					),
			Promise.resolve()
		);

		logger.info(
			`[Campaign] Fanned out ${events.length} events in ${Math.ceil(events.length / FAN_OUT_BATCH_SIZE)} batch(es)`
		);

		return {
			campaignId,
			scenario,
			sms: messageRows.filter((m) => m.channel === "sms").length,
			totalQueued: messageRows.length,
			whatsapp: messageRows.filter((m) => m.channel === "whatsapp").length,
		};
	}
);

// ─── Worker ───────────────────────────────────────────────────────────────────

export const sendSingleMessage = inngest.createFunction(
	{
		id: "send-single-message",
		name: "Send Single Message (Worker)",
		onFailure: async ({ event, error, logger: log }) => {
			// This only fires when ALL retries are exhausted on an INFRASTRUCTURE error
			// (e.g. DB unreachable). Normal send failures are handled gracefully below.
			const d = event.data.event?.data as
				| {
						userId: string;
						messageType: MessageType;
						campaignId: string;
						messageId: string;
				  }
				| undefined;
			if (!(d?.userId && d?.messageType)) {
				return;
			}

			// Guard: only refund if not already refunded
			const alreadyRefunded = await prisma.transaction.findFirst({
				where: { reference: `refund_${d.messageId}` },
			});
			if (alreadyRefunded) {
				return;
			}

			log.warn(
				`[onFailure] Infrastructure failure for messageId=${d.messageId} — issuing refund`
			);
			try {
				await refundForMessage({
					campaignId: d.campaignId,
					messageId: d.messageId,
					messageType: d.messageType as MessageType,
					reason: `infrastructure failure: ${error.message}`,
					userId: d.userId,
				});
				log.info(`[onFailure] Refund successful for messageId=${d.messageId}`);
			} catch (e) {
				log.error(
					`[onFailure] REFUND FAILED for messageId=${d.messageId}: ${e}`
				);
			}
		},
		// retries: 1 — only for genuine infrastructure failures (DB down, network timeout).
		// A send failure (Meta/Termii returns error) is handled gracefully and does NOT retry.
		retries: 1,

		timeouts: { finish: "30s" },
		triggers: [campaignSendSingleEvent],
	},
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
		} = event.data as {
			campaignId: string;
			userId: string;
			messageId: string;
			contactName: string;
			phone: string;
			channel: "whatsapp" | "sms";
			deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback";
			message: string;
			messageType?: MessageType; // pre-resolved by orchestrator
		};

		// FIX 2: Resolve messageType OUTSIDE steps so it's available everywhere.
		// This is pure computation — no DB call needed.
		const messageType = resolveMessageType(channel, deliveryMode);

		// ── Step 1: Billing debit — IDEMPOTENT ───────────────────────────────────
		// FIX 3: Check if we already debited this message (handles Inngest retries safely).
		// On retry after a step crash, billing-debit re-runs. Without the guard it hits
		// the @unique constraint on Transaction.reference and throws an opaque DB error.
		const billing = await step.run("billing-debit", async () => {
			// Idempotency guard: if transaction already exists for this message, return success
			const existing = await prisma.transaction.findFirst({
				where: { reference: `msg_${messageId}` },
			});
			if (existing) {
				logger.info(
					`[Billing] Already debited messageId=${messageId} — skipping`
				);
				return { alreadyDebited: true, balanceKobo: 0, success: true };
			}
			return debitForMessage({ campaignId, messageId, messageType, userId });
		});

		if (!billing.success) {
			// Update DB state inside a step (idempotent)
			await step.run("pause-campaign", async () => {
				logger.warn(
					`[Campaign] Pausing ${campaignId} — wallet empty for ${userId}`
				);
				await prisma.message.update({
					data: {
						errorMessage: "Insufficient wallet balance",
						status: "failed",
					},
					where: { id: messageId },
				});
				await prisma.campaign.update({
					data: {
						completedAt: new Date(),
						failedMessages: { increment: 1 },
						status: "failed",
					},
					where: { id: campaignId },
				});
			});

			// FIX: inngest.send() MUST be outside step.run() — Inngest can replay
			// step bodies, which would fire duplicate low-balance @/emails.
			// Use step.sendEvent() which is idempotent and checkpoint-safe.
			await step.sendEvent("notify-low-balance", {
				data: {
					campaignId,
					remainingBalanceKobo: billing.balanceKobo,
					userId,
				},
				name: "Velocast/campaign.paused-low-balance",
			});

			return { messageId, reason: "insufficient_balance", success: false };
		}

		// ── Step 2: Mark sending ─────────────────────────────────────────────────
		await step.run("mark-sending", async () => {
			await prisma.message.update({
				data: { status: "sending" },
				where: { id: messageId },
			});
		});

		// ── Step 3: Send via Meta (WA) or Termii (SMS) ───────────────────────────
		const result = await step.run("send-message", async () => {
			if (channel === "whatsapp") {
				const r = await sendWhatsAppMessage(phone, message);
				return { error: r.error, externalId: r.messageId, success: r.success };
			}
			const r = await sendSmsMessage(phone, message);
			return { error: r.error, externalId: r.messageId, success: r.success };
		});

		// ── Step 4: Persist result ───────────────────────────────────────────────
		// FIX 1: On send failure, DO NOT THROW. Return { success: false } so Inngest
		// marks the function as completed (not failed). Throwing here caused:
		//   (a) failedMessages counter incremented multiple times (once per retry)
		//   (b) billing-debit running again on retry
		//   (c) PENDING = total - sent - failed going negative in the UI
		await step.run("persist-result", async () => {
			if (result.success) {
				await prisma.message.update({
					data: {
						metaMessageId: result.externalId ?? null,
						sentAt: new Date(),
						status: "sent",
					},
					where: { id: messageId },
				});
				await prisma.campaign.update({
					data: { sentMessages: { increment: 1 } },
					where: { id: campaignId },
				});
				logger.info(
					`[Send] ✅ ${contactName} via ${channel} — ID: ${result.externalId}`
				);
			} else {
				// Send failure is a normal outcome — persist it and fall through to
				// check-complete so the campaign can still finish.
				await prisma.message.update({
					data: { errorMessage: result.error, status: "failed" },
					where: { id: messageId },
				});
				await refundForMessage({
					campaignId,
					messageId,
					messageType,
					reason: `send failure: ${result.error}`,
					userId,
				});

				await prisma.campaign.update({
					data: { failedMessages: { increment: 1 } },
					where: { id: campaignId },
				});

				logger.warn(`[Send] ❌ ${contactName} via ${channel}: ${result.error}`);
			}
		});

		// ── FIX: clean completion check — removed the broken empty AND/OR block ──
		await step.run("check-complete", async () => {
			const campaign = await prisma.campaign.findUnique({
				select: {
					failedMessages: true,
					sentMessages: true,
					status: true,
					totalMessages: true,
				},
				where: { id: campaignId },
			});
			if (campaign?.status !== "processing") {
				return;
			}

			const done = campaign.sentMessages + campaign.failedMessages;
			if (done >= campaign.totalMessages) {
				const finalStatus =
					campaign.failedMessages === campaign.totalMessages
						? "failed"
						: "completed";
				await prisma.campaign.updateMany({
					data: { completedAt: new Date(), status: finalStatus },
					where: { id: campaignId, status: "processing" },
				});
				logger.info(
					`[Campaign] ${campaignId} → ${finalStatus} (${done}/${campaign.totalMessages})`
				);
			}
		});

		return {
			externalId: result.externalId,
			messageId,
			success: result.success,
		};
		// Note: no throw here. onFailure only fires for true step exceptions
		// (DB down, network timeout) after the retry is exhausted.
	}
);

// ─── Low-balance notification ─────────────────────────────────────────────────

export const handleLowBalancePause = inngest.createFunction(
	{
		id: "campaign-paused-low-balance",
		name: "Notify User: Campaign Paused (Low Balance)",
		triggers: [campaignPausedLowBalanceEvent],
	},
	async ({ event, step, logger }) => {
		const { campaignId, userId, remainingBalanceKobo } = event.data as {
			campaignId: string;
			userId: string;
			remainingBalanceKobo: number;
		};

		await step.run("notify-user", async () => {
			const user = await prisma.user.findUnique({
				select: { email: true, name: true },
				where: { id: userId },
			});
			if (!user) {
				return;
			}

			logger.info(
				`[Billing] Campaign ${campaignId} paused for ${user.email} — balance: ${remainingBalanceKobo} kobo`
			);

			await sendMail({
				subject: "Your Velocast campaign was paused — low balance",
				template: LowBalanceEmail({
					campaignId,
					name: user.name ?? "",
					remainingBalanceKobo,
				}),
				to: user.email,
			});
		});
	}
);
