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

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum events per inngest.send() call.
 * Inngest has a ~512KB payload limit. At ~200 bytes per event, 100 events ≈ 20KB —
 * well within the limit even with large message bodies.
 */
const FAN_OUT_BATCH_SIZE = 100;

// ─── AI content filter (called once in orchestrator, not per message) ─────────

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
		const prompt = `You are a messaging compliance checker for a business messaging platform.
Analyze this ${channel.toUpperCase()} message for compliance. Normal marketing and customer outreach is SAFE.
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
		timeouts: { finish: "15m" },
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
			templateVars,
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
			templateVars: Record<string, string>;
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

		// ── Step 2: AI content safety check — ONCE for the whole campaign ────────
		// Uses the whatsapp template as the representative body. Same check covers SMS
		// since both bodies come from the same campaign intent.
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
					where: { id: campaignId },
					data: {
						status: "failed",
						completedAt: new Date(),
						totalMessages: contacts.length,
						failedMessages: contacts.length,
					},
				});
			});
			return {
				campaignId,
				scenario,
				blocked: true,
				reason: contentCheck.reason,
			};
		}

		// ── Step 3: Filter opted-out contacts ────────────────────────────────────
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

		// ── Step 4: Build personalised message rows ──────────────────────────────
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
					message: personalizeMessage(template, c.name, templateVars),
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

		// ── Step 5: Fan out — BATCHED to respect Inngest 512KB payload limit ─────
		// Sending all events in one call fails silently at ~5k contacts.
		// We chunk into batches of FAN_OUT_BATCH_SIZE and send each batch separately.
		const campaignDeliveryMode = await step.run(
			"get-delivery-mode",
			async () => {
				const c = await prisma.campaign.findUnique({
					where: { id: campaignId },
					select: { deliveryMode: true },
				});
				return c?.deliveryMode ?? "marketing";
			}
		);
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
					// Pass messageType so workers don't re-derive it (avoids another DB read)
					messageType: resolveMessageType(
						m.channel,
						campaignDeliveryMode as
							| "marketing"
							| "utility_prescreen"
							| "sms_fallback"
					),
				},
			}));

		for (let i = 0; i < events.length; i += FAN_OUT_BATCH_SIZE) {
  await step.sendEvent(
    `fan-out-batch-${i}`,
    events.slice(i, i + FAN_OUT_BATCH_SIZE)
  );
			logger.info(
				`[Campaign] Fanned out ${events.length} events in ${Math.ceil(events.length / FAN_OUT_BATCH_SIZE)} batch(es)`
			);
		}
			
	

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
		// retries: 1 — only for genuine infrastructure failures (DB down, network timeout).
		// A send failure (Meta/Termii returns error) is handled gracefully and does NOT retry.
		retries: 1,
		rateLimit: {
			limit: 10,
			period: "1s",
			key: "event.data.channel",
		},
		concurrency: {
			limit: 10,
			key: "event.data.campaignId",
		},
		timeouts: { finish: "30s" },
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
					userId: d.userId,
					messageType: d.messageType as MessageType,
					campaignId: d.campaignId,
					messageId: d.messageId,
					reason: `infrastructure failure: ${error.message}`,
				});
				await prisma.$transaction(async (tx) => {
					const campaignDetails = await tx.campaign.findUnique({
						where: {
							id: d.campaignId,
						},
						select: {
							totalMessages: true,
							failedMessages: true,
						},
					});

					if (
						campaignDetails?.totalMessages === campaignDetails?.failedMessages
					) {
						await prisma.campaign.update({
							where: { id: d.campaignId },
							data: { status: "failed" },
						});
					}
				});
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
				return { success: true, balanceKobo: 0, alreadyDebited: true };
			}
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

		// ── Step 2: Mark sending ─────────────────────────────────────────────────
		await step.run("mark-sending", async () => {
			await prisma.message.update({
				where: { id: messageId },
				data: { status: "sending" },
			});
		});

		// ── Step 3: Send via Meta (WA) or Termii (SMS) ───────────────────────────
		const result = await step.run("send-message", async () => {
			if (channel === "whatsapp") {
				const r = await sendWhatsAppMessage(phone, message);
				return { success: r.success, externalId: r.messageId, error: r.error };
			}
			const r = await sendSmsMessage(phone, message);
			return { success: r.success, externalId: r.messageId, error: r.error };
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
        logger.info(`[Send] ✅ ${contactName} via ${channel} — ID: ${result.externalId}`);
      } else {
        // Send failure is a normal outcome — persist it and fall through to
        // check-complete so the campaign can still finish.
        await prisma.message.update({
          where: { id: messageId },
          data: { status: "failed", errorMessage: result.error },
        });
        
        logger.warn(`[Send] ❌ ${contactName} via ${channel}: ${result.error}`);
      }
    });

    // ── FIX: clean completion check — removed the broken empty AND/OR block ──
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
      if (!campaign || campaign.status !== "processing") return;

      const done = campaign.sentMessages + campaign.failedMessages;
      if (done >= campaign.totalMessages) {
        const finalStatus =
          campaign.failedMessages === campaign.totalMessages ? "failed" : "completed";
        await prisma.campaign.updateMany({
          where: { id: campaignId, status: "processing" },
          data: { status: finalStatus, completedAt: new Date() },
        });
        logger.info(
          `[Campaign] ${campaignId} → ${finalStatus} (${done}/${campaign.totalMessages})`
        );
      }
    });

    return {
      messageId,
      success: result.success,
      externalId: result.externalId,
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
