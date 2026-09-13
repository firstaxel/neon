import { prisma } from "#/db";
import { parseContactImageFromR2 } from "#/lib/gemini";
import { contactListParseEvent, inngest } from "#/lib/inngest/client";

/**
 * Background job: Parse a contact list image using Google Gemini AI.
 *
 * Flow:
 *  1. Image was already uploaded to Cloudflare R2 by the oRPC upload procedure
 *  2. This job downloads the image from R2 (keeps Inngest payload small)
 *  3. Sends to Gemini Vision API for structured contact extraction
 *  4. Upserts contacts — if the same phone already exists for this user,
 *     the name/type/notes are updated rather than creating a duplicate row.
 *  5. Updates ParseJob row with status + result metadata
 *
 * Duplicate handling:
 *   Contact uniqueness is enforced by @@unique([userId, phone]) in the schema.
 *   On conflict we update name, type, notes, and parseJobId (attributing the
 *   contact to the most recent import) but preserve optedOut status.
 */
export const parseContactList = inngest.createFunction(
	{
		concurrency: { limit: 3 },
		id: "parse-contact-list",
		name: "Parse Contact List Image (Gemini AI + R2)",
		onFailure: async ({ event, step }) => {
			if (event.data.function_id !== "parse-contact-list") {
				return;
			}

			const { jobId } = event.data.event.data as { jobId?: string };
			if (!jobId) {
				return;
			}

			await step.run("mark-error", async () => {
				await prisma.parseJob.update({
					data: {
						completedAt: new Date(),
						errorMessage: event.data.error?.message ?? "Unknown Inngest error",
						status: "error",
					},
					where: { id: jobId },
				});
			});
		},
		retries: 2,
		timeouts: { finish: "3m" },
		triggers: [contactListParseEvent],
	},
	async ({ event, step, logger }) => {
		const { jobId, r2Key, mimeType } = event.data;

		logger.info(`[ParseJob] Starting jobId=${jobId} r2Key=${r2Key}`);

		// ── Step 1: Mark ParseJob as "parsing" ────────────────────────────────────
		await step.run("mark-parsing", () =>
			prisma.parseJob.update({
				data: { startedAt: new Date(), status: "parsing" },
				where: { id: jobId },
			})
		);

		// ── Step 2: Download from R2 + call Gemini Vision ─────────────────────────
		const geminiResult = await step.run("gemini-parse", async () => {
			logger.info(`[ParseJob] Calling Gemini for jobId=${jobId}`);
			const result = await parseContactImageFromR2(r2Key, mimeType);
			logger.info(
				`[ParseJob] Extracted ${result.contacts.length} contacts, confidence=${result.confidence}`
			);
			return result;
		});

		// ── Step 3: Save candidate contacts to ParseJob for review ──────────────
		await step.run("save-candidates-to-parse-job", async () => {
			await prisma.parseJob.update({
				data: {
					candidates: geminiResult.contacts as unknown as object,
					completedAt: new Date(),
					confidence: geminiResult.confidence,
					rawExtractedText: geminiResult.rawText,
					reviewStatus: "pending_review",
					status: "done",
					warnings: geminiResult.warnings,
				},
				where: { id: jobId },
			});

			logger.info(
				`[ParseJob] jobId=${jobId} saved ${geminiResult.contacts.length} candidates with reviewStatus=pending_review`
			);
		});

		return {
			candidatesCount: geminiResult.contacts.length,
			confidence: geminiResult.confidence,
			jobId,
			reviewStatus: "pending_review",
			status: "done",
			warnings: geminiResult.warnings,
		};
	}
);
