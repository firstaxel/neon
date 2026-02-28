import { v4 as uuidv4 } from "uuid";
import { prisma } from "#/db";
import { inngest } from "#/lib/inngest/client";
import { personalizeMessage } from "#/lib/scenarios";

/**
 * Orchestrator: Fan out one campaign into N individual per-message Inngest jobs.
 *
 * Steps:
 *  1. Mark Campaign as "processing" in Postgres
 *  2. Build personalised messages for every contact
 *  3. createMany Message rows in Postgres (status = "queued")
 *  4. Send one Inngest event per message → triggers sendSingleMessage workers
 *
 * The fan-out pattern means:
 *  - No HTTP request hangs waiting for 100+ sends
 *  - Each message is independently retried on failure
 *  - Twilio rate limits are respected via Inngest rateLimit config
 *  - Full per-message observability in the Inngest dashboard
 */
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
			createdBy,
		} = event.data;

		logger.info(
			`[Campaign] Starting campaignId=${campaignId} with ${contacts.length} contacts`
		);

		// ── Step 1: Mark campaign as processing ───────────────────────────────────
		await step.run("mark-processing", async () => {
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { status: "processing", startedAt: new Date() },
			});
		});

		// ── Step 2: Build personalised message rows ───────────────────────────────
		const messageRows = await step.run("insert-messages", async () => {
			const rows = contacts.map((c) => {
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
					sentBy: createdBy,
				};
			});

			// Insert all message rows in one Prisma createMany call
			await prisma.message.createMany({ data: rows });

			// Sync totalMessages count (should already match, but keep consistent)
			await prisma.campaign.update({
				where: { id: campaignId },
				data: { totalMessages: rows.length },
			});

			logger.info(`[Campaign] Inserted ${rows.length} Message rows`);
			return rows;
		});

		// ── Step 3: Fan out — one Inngest event per message ───────────────────────
		await step.run("fan-out", async () => {
			const events = messageRows.map((m) => ({
				name: "neon/campaign.send-single" as const,
				data: {
					campaignId,
					messageId: m.id,
					contactName: m.contactName,
					phone: m.phone,
					channel: m.channel,
					message: m.message,
					sentBy: createdBy,
				},
			}));

			// Batch send all events to Inngest in one API call
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

/**
 * Worker: Send one message via Twilio + update Postgres Message row.
 *
 * Each message is an independent Inngest job with:
 *  - 3 retries (Inngest handles backoff automatically)
 *  - Rate limit: max 10 sends/second per channel (whatsapp vs sms separately)
 *  - Concurrency: max 5 in-flight per campaign at once
 */
export const sendSingleMessage = inngest.createFunction(
	{
		id: "send-single-message",
		name: "Send Single Message (Worker)",
		retries: 3,
		rateLimit: {
			limit: 10,
			period: "1s",
			key: "event.data.channel", // separate limits for whatsapp vs sms
		},
		concurrency: {
			limit: 5,
			key: "event.data.campaignId", // per-campaign cap
		},
		timeouts: { finish: "30s" },
	},
	{ event: "neon/campaign.send-single" },

	async ({ event, step, logger }) => {
		const { campaignId, messageId, contactName, phone, channel, message } =
			event.data;

		// ── Step 1: Mark Message as "sending" ─────────────────────────────────────
		await step.run("mark-sending", async () => {
			await prisma.message.update({
				where: { id: messageId },
				data: { status: "sending" },
			});
		});

		// // ── Step 2: Send via Twilio ───────────────────────────────────────────────
		// const result = await step.run("twilio-send", () => {
		// 	return sendMessage(channel as "whatsapp" | "sms", phone, message);
		// });

		// // ── Step 3: Persist result + update Campaign counters ─────────────────────
		// await step.run("persist-result", async () => {
		// 	if (result.success) {
		// 		// Update message row
		// 		await prisma.message.update({
		// 			where: { id: messageId },
		// 			data: { status: "sent", twilioSid: result.sid, sentAt: new Date() },
		// 		});

		// 		// Increment sentMessages counter atomically
		// 		await prisma.campaign.update({
		// 			where: { id: campaignId },
		// 			data: { sentMessages: { increment: 1 } },
		// 		});

		// 		logger.info(`[Send] ✅ ${contactName} — Twilio SID: ${result.sid}`);
		// 	} else {
		// 		await prisma.message.update({
		// 			where: { id: messageId },
		// 			data: { status: "failed", errorMessage: result.error },
		// 		});

		// 		await prisma.campaign.update({
		// 			where: { id: campaignId },
		// 			data: { failedMessages: { increment: 1 } },
		// 		});

		// 		logger.error(`[Send] ❌ ${contactName}: ${result.error}`);
		// 		// Re-throw so Inngest retries this step up to 3 times
		// 		throw new Error(`Twilio send failed: ${result.error}`);
		// 	}
		// });

		// ── Step 4: Check if entire campaign is now complete ──────────────────────
		await step.run("check-campaign-complete", async () => {
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: {
					totalMessages: true,
					sentMessages: true,
					failedMessages: true,
				},
			});

			if (!campaign) {
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

		// return { messageId, success: result.success, sid: result.sid };
	}
);
