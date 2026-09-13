/**
 * src/features/jobs/functions/send-campaign.ts
 *
 * Campaign fan out orchestrator + per message worker.
 * Supports two phase wallet holds, scheduled broadcasts via Inngest sleepUntil,
 * cancellation race condition protection, batched fan out, and Termii SMS dispatch.
 */

import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import {
	commitCampaignDeduction,
	debitForMessage,
	refundForMessage,
	releaseCampaignHold,
} from "#/features/billing/utils";
import {
	type MessageType,
	resolveMessageType,
} from "#/features/billing/utils/format";
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
import { calculateSmsSegments } from "#/lib/sms";
import { sendSmsMessage } from "#/lib/termii";
import LowBalanceEmail from "../../../../emails/low-balance-email";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum events per inngest.send() call.
 * Inngest has a ~512KB payload limit. 100 events ≈ 20KB.
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
			scheduledAt,
		} = event.data as {
			campaignId: string;
			contactIds: string[];
			forceSmsChannel?: boolean;
			whatsappTemplate: string;
			smsTemplate: string;
			scenario: string;
			userId: string;
			templateVars: Record<string, string>;
			scheduledAt?: string;
		};

		logger.info(
			`[Campaign] Starting orchestrator campaignId=${campaignId} userId=${userId} contacts=${contactIds.length} scheduledAt=${scheduledAt ?? "immediate"}`
		);

		// ── Step 0: Sleep until scheduled execution if specified ─────────────────
		if (scheduledAt) {
			const targetDate = new Date(scheduledAt);
			if (targetDate.getTime() > Date.now()) {
				logger.info(
					`[Campaign] Waiting until scheduled timestamp: ${scheduledAt}`
				);
				await step.sleepUntil("wait-for-schedule", targetDate);
			}
		}

		// ── Step 1: Claim dispatching state atomically ───────────────────────────
		// If user cancelled while sleeping or if another worker claimed it, abort safely
		const claim = await step.run("claim-dispatching-state", async () => {
			const result = await prisma.campaign.updateMany({
				data: { startedAt: new Date(), status: "dispatching" },
				where: { id: campaignId, status: "pending" },
			});
			return { claimed: result.count > 0 };
		});

		if (!claim.claimed) {
			logger.warn(
				`[Campaign] Campaign ${campaignId} is no longer pending (cancelled or already dispatching) — aborting.`
			);
			return {
				aborted: true,
				campaignId,
				reason: "cancelled_or_already_dispatching",
			};
		}

		// ── Step 2: Fetch contacts from DB ───────────────────────────────────────
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

		// ── Step 3: AI content safety check ──────────────────────────────────────
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
				await releaseCampaignHold({
					campaignId,
					reason: `AI content safety violation: ${contentCheck.reason}`,
					userId,
				});
			});
			return {
				blocked: true,
				campaignId,
				reason: contentCheck.reason,
				scenario,
			};
		}

		// ── Step 4: Filter opted out contacts ────────────────────────────────────
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
					`[Campaign] Skipping ${contacts.length - eligible.length} opted out contacts`
				);
			}
			return eligible;
		});

		if (eligibleContacts.length === 0) {
			await step.run("handle-empty-audience", async () => {
				await prisma.campaign.update({
					data: {
						completedAt: new Date(),
						status: "completed",
						totalMessages: 0,
					},
					where: { id: campaignId },
				});
				await releaseCampaignHold({
					campaignId,
					reason: "All recipients opted out",
					userId,
				});
			});
			return {
				campaignId,
				scenario,
				skippedOptedOut: contacts.length,
				totalQueued: 0,
			};
		}

		// ── Step 5: Build personalised message rows with segment calculations ────
		const messageRows = await step.run("insert-messages", async () => {
			const rows = eligibleContacts.map((c) => {
				const template =
					c.channel === "whatsapp" ? whatsappTemplate : smsTemplate;
				const personalized = personalizeMessage(template, c.name, templateVars);
				const smsCalc =
					c.channel === "sms" ? calculateSmsSegments(personalized, true) : null;

				return {
					campaignId,
					channel: c.channel as "whatsapp" | "sms",
					contactId: c.id,
					contactName: c.name,
					costKobo: smsCalc ? smsCalc.totalCostKobo : 9000,
					id: uuidv4(),
					message: personalized,
					phone: c.phone,
					segments: smsCalc ? smsCalc.segments : 1,
					status: "queued" as const,
				};
			});

			await prisma.message.createMany({ data: rows });
			await prisma.campaign.update({
				data: { totalMessages: rows.length },
				where: { id: campaignId },
			});

			logger.info(
				`[Campaign] Inserted ${rows.length} message rows for campaign ${campaignId}`
			);
			return rows;
		});

		// ── Step 6: Fan out in batches ───────────────────────────────────────────
		const campaignMeta = await step.run("get-campaign-metadata", async () => {
			const c = await prisma.campaign.findUnique({
				select: { deliveryMode: true, senderId: true },
				where: { id: campaignId },
			});
			return {
				deliveryMode: c?.deliveryMode ?? "marketing",
				senderId: c?.senderId ?? undefined,
			};
		});

		const events = messageRows.map((m) => ({
			data: {
				campaignId,
				channel: m.channel,
				contactName: m.contactName,
				costKobo: m.costKobo,
				deliveryMode: campaignMeta.deliveryMode as
					| "marketing"
					| "utility_prescreen"
					| "sms_fallback",
				message: m.message,
				messageId: m.id,
				messageType: resolveMessageType(
					m.channel,
					campaignMeta.deliveryMode as
						| "marketing"
						| "utility_prescreen"
						| "sms_fallback"
				),
				phone: m.phone,
				segments: m.segments,
				senderId: campaignMeta.senderId,
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
			`[Campaign] Fanned out ${events.length} events in ${batchStarts.length} batch(es)`
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

async function reconcileOnWorkerFailure({
	campaignId,
	userId,
	log,
}: {
	campaignId: string;
	userId: string;
	log: { info: (msg: string) => void };
}) {
	const campaign = await prisma.campaign.findUnique({
		select: {
			failedMessages: true,
			name: true,
			sentMessages: true,
			status: true,
			totalMessages: true,
		},
		where: { id: campaignId },
	});

	if (campaign?.status !== "dispatching") {
		return;
	}

	const done = campaign.sentMessages + campaign.failedMessages;
	if (done < campaign.totalMessages) {
		return;
	}

	const claimed = await prisma.campaign.updateMany({
		data: { status: "processing" },
		where: { id: campaignId, status: "dispatching" },
	});

	if (claimed.count === 0) {
		return;
	}

	const finalStatus =
		campaign.failedMessages === campaign.totalMessages ? "failed" : "completed";

	const sentMessages = await prisma.message.findMany({
		select: { costKobo: true },
		where: { campaignId, status: "sent" },
	});
	const actualCostKobo = sentMessages.reduce(
		(sum, m) => sum + (m.costKobo ?? 0),
		0
	);

	log.info(
		`[onFailure Reconciliation] Reconciling hold for campaign ${campaignId}. Actual cost: ${actualCostKobo} kobo.`
	);

	await commitCampaignDeduction({
		actualCostKobo,
		campaignId,
		description: `Campaign broadcast debit: ${campaign.name || campaignId}`,
		userId,
	});

	await prisma.campaign.update({
		data: { completedAt: new Date(), status: finalStatus },
		where: { id: campaignId },
	});
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const sendSingleMessage = inngest.createFunction(
	{
		concurrency: [{ limit: 10 }],
		id: "send-single-message",
		name: "Send Single Message (Worker)",
		onFailure: async ({ event, error, logger: log }) => {
			const d = event.data.event?.data as
				| {
						campaignId: string;
						messageId: string;
						messageType: MessageType;
						userId: string;
				  }
				| undefined;
			if (!(d?.userId && d?.messageType)) {
				return;
			}

			const updatedMsg = await prisma.message.updateMany({
				data: {
					errorMessage: `infrastructure failure: ${error.message}`,
					status: "failed",
				},
				where: { id: d.messageId, status: { in: ["pending", "sending"] } },
			});

			if (updatedMsg.count > 0) {
				await prisma.campaign.update({
					data: { failedMessages: { increment: 1 } },
					where: { id: d.campaignId },
				});
			}

			const hold = await prisma.transaction.findFirst({
				where: { campaignId: d.campaignId, type: "campaign_hold" },
			});

			if (hold) {
				await reconcileOnWorkerFailure({
					campaignId: d.campaignId,
					log,
					userId: d.userId,
				});
				return;
			}

			const alreadyRefunded = await prisma.transaction.findFirst({
				where: { reference: `refund_${d.messageId}` },
			});
			if (alreadyRefunded) {
				return;
			}

			log.warn(
				`[onFailure] Infrastructure failure for messageId=${d.messageId} — issuing legacy refund`
			);
			try {
				await refundForMessage({
					campaignId: d.campaignId,
					messageId: d.messageId,
					messageType: d.messageType,
					reason: `infrastructure failure: ${error.message}`,
					userId: d.userId,
				});
			} catch (e) {
				log.error(
					`[onFailure] Refund failed for messageId=${d.messageId}: ${e}`
				);
			}
		},
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
			senderId,
		} = event.data as {
			campaignId: string;
			userId: string;
			messageId: string;
			contactName: string;
			phone: string;
			channel: "whatsapp" | "sms";
			deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback";
			message: string;
			messageType?: MessageType;
			senderId?: string;
			segments?: number;
			costKobo?: number;
		};

		const messageType = resolveMessageType(channel, deliveryMode);

		// Check if this campaign has an upfront hold
		const hasHold = await step.run("check-campaign-hold", async () => {
			const holdTx = await prisma.transaction.findFirst({
				select: { id: true },
				where: { campaignId, type: "campaign_hold" },
			});
			return Boolean(holdTx);
		});

		// ── Step 1: Billing debit (only for legacy campaigns without upfront hold) ─
		if (!hasHold) {
			const billing = await step.run("billing-debit", async () => {
				const existing = await prisma.transaction.findFirst({
					where: { reference: `msg_${messageId}` },
				});
				if (existing) {
					return { alreadyDebited: true, balanceKobo: 0, success: true };
				}
				return debitForMessage({ campaignId, messageId, messageType, userId });
			});

			if (!billing.success) {
				await step.run("pause-campaign", async () => {
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
			const r = await sendSmsMessage(phone, message, { senderId });
			return { error: r.error, externalId: r.messageId, success: r.success };
		});

		// ── Step 4: Persist result ───────────────────────────────────────────────
		await step.run("persist-result", async () => {
			if (result.success) {
				await prisma.message.update({
					data: {
						metaMessageId: channel === "whatsapp" ? result.externalId : null,
						sentAt: new Date(),
						status: "sent",
						termiiMessageId: channel === "sms" ? result.externalId : null,
					},
					where: { id: messageId },
				});
				await prisma.campaign.update({
					data: { sentMessages: { increment: 1 } },
					where: { id: campaignId },
				});
				logger.info(
					`[Send] Completed for ${contactName} via ${channel} (ID: ${result.externalId})`
				);
			} else {
				await prisma.message.update({
					data: { errorMessage: result.error, status: "failed" },
					where: { id: messageId },
				});
				await prisma.campaign.update({
					data: { failedMessages: { increment: 1 } },
					where: { id: campaignId },
				});

				if (!hasHold) {
					await refundForMessage({
						campaignId,
						messageId,
						messageType,
						reason: `send failure: ${result.error}`,
						userId,
					});
				}

				logger.warn(
					`[Send] Failed for ${contactName} via ${channel}: ${result.error}`
				);
			}
		});

		// ── Step 5: Campaign completion and hold reconciliation ───────────────────
		await step.run("check-complete", async () => {
			const campaign = await prisma.campaign.findUnique({
				select: {
					failedMessages: true,
					name: true,
					sentMessages: true,
					status: true,
					totalMessages: true,
				},
				where: { id: campaignId },
			});

			if (campaign?.status !== "dispatching") {
				return;
			}

			const done = campaign.sentMessages + campaign.failedMessages;
			if (done >= campaign.totalMessages) {
				// Atomically transition from dispatching to processing to ensure one worker reconciles
				const claimed = await prisma.campaign.updateMany({
					data: { status: "processing" },
					where: { id: campaignId, status: "dispatching" },
				});

				if (claimed.count > 0) {
					const finalStatus =
						campaign.failedMessages === campaign.totalMessages
							? "failed"
							: "completed";

					if (hasHold) {
						// Query all sent messages to find exact billable cost
						const sentMessages = await prisma.message.findMany({
							select: { costKobo: true },
							where: { campaignId, status: "sent" },
						});
						const actualCostKobo = sentMessages.reduce(
							(sum, m) => sum + (m.costKobo ?? 0),
							0
						);

						logger.info(
							`[Reconciliation] Reconciling hold for campaign ${campaignId}. Actual cost: ${actualCostKobo} kobo.`
						);

						await commitCampaignDeduction({
							actualCostKobo,
							campaignId,
							description: `Campaign broadcast debit: ${campaign.name || campaignId}`,
							userId,
						});
					}

					await prisma.campaign.update({
						data: { completedAt: new Date(), status: finalStatus },
						where: { id: campaignId },
					});

					logger.info(
						`[Campaign] Completed campaign ${campaignId} with status ${finalStatus} (${done}/${campaign.totalMessages})`
					);
				}
			}
		});

		return {
			externalId: result.externalId,
			messageId,
			success: result.success,
		};
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
				`[Billing] Campaign ${campaignId} paused for ${user.email} (balance: ${remainingBalanceKobo} kobo)`
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
