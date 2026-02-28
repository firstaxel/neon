import { prisma } from "#/db";
import { parseContactImageFromR2 } from "#/lib/gemini";
import { inngest } from "#/lib/inngest/client";

/**
 * Background job: Parse a contact list image using Google Gemini AI.
 *
 * Flow:
 *  1. Image was already uploaded to Cloudflare R2 by the oRPC upload procedure
 *  2. This job downloads the image from R2 (keeps Inngest payload small)
 *  3. Sends to Gemini Vision API for structured contact extraction
 *  4. Saves extracted contacts to PostgreSQL via Prisma (Contact model)
 *  5. Updates ParseJob row with status + result metadata
 *
 * Frontend polls orpcClient.upload.getParseStatus({ jobId }) every ~1.5s.
 */
export const parseContactList = inngest.createFunction(
	{
		id: "parse-contact-list",
		name: "Parse Contact List Image (Gemini AI + R2)",
		retries: 2,
		concurrency: { limit: 3 },
		timeouts: { finish: "3m" },
	},
	{ event: "neon/contact-list.parse" },

	async ({ event, step, logger }) => {
		const { jobId, r2Key, mimeType, parsedBy } = event.data;

		logger.info(`[ParseJob] Starting jobId=${jobId} r2Key=${r2Key}`);

		// ── Step 1: Mark ParseJob as "parsing" ────────────────────────────────────
		await step.run("mark-parsing", async () => {
			await prisma.parseJob.update({
				where: { id: jobId },
				data: { status: "parsing", startedAt: new Date() },
			});
		});

		// ── Step 2: Download from R2 + call Gemini Vision ─────────────────────────
		const geminiResult = await step.run("gemini-parse", async () => {
			logger.info(`[ParseJob] Calling Gemini for jobId=${jobId}`);
			const result = await parseContactImageFromR2(r2Key, mimeType);
			logger.info(
				`[ParseJob] Extracted ${result.contacts.length} contacts, confidence=${result.confidence}`
			);
			return result;
		});

		// ── Step 3: Persist contacts + update ParseJob row ────────────────────────
		await step.run("persist-to-postgres", async () => {
			// Use a Prisma transaction so contacts + job update are atomic
			await prisma.$transaction([
				// Insert all contacts in one createMany call
				prisma.contact.createMany({
					data: geminiResult.contacts.map((c) => ({
						id: c.id,
						parseJobId: jobId,
						name: c.name,
						phone: c.phone,
						channel: c.channel,
						type: c.type,
						notes: c.notes ?? null,
						rawRow: c.rawRow ?? null,
						uploadedBy: parsedBy,
					})),
					skipDuplicates: true,
				}),
				// Mark job as done
				prisma.parseJob.update({
					where: { id: jobId },
					data: {
						status: "done",
						rawExtractedText: geminiResult.rawText,
						confidence: geminiResult.confidence,
						warnings: geminiResult.warnings,
						completedAt: new Date(),
					},
				}),
			]);

			logger.info(
				`[ParseJob] Saved ${geminiResult.contacts.length} contacts for jobId=${jobId}`
			);
		});

		return {
			jobId,
			contactsFound: geminiResult.contacts.length,
			confidence: geminiResult.confidence,
			warnings: geminiResult.warnings,
		};
	}
);

/**
 * Failure handler — marks ParseJob as "error" in Postgres when all retries fail.
 */
export const parseContactListOnFailure = inngest.createFunction(
	{
		id: "parse-contact-list-on-failure",
		name: "Parse Job Failure Handler",
	},
	{ event: "inngest/function.failed" },
	async ({ event, step }) => {
		if (event.data.function_id !== "neon-parse-contact-list") {
			return;
		}

		const jobId = (event.data.event?.data as { jobId?: string })?.jobId;
		if (!jobId) {
			return;
		}

		await step.run("mark-error", async () => {
			await prisma.parseJob.update({
				where: { id: jobId },
				data: {
					status: "error",
					errorMessage: event.data.error?.message ?? "Unknown Inngest error",
					completedAt: new Date(),
				},
			});
		});
	}
);
