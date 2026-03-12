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
		id: "parse-contact-list",
		name: "Parse Contact List Image (Gemini AI + R2)",
		retries: 2,
		concurrency: { limit: 3 },
		timeouts: { finish: "3m" },
		onFailure: async ({ event, step }) => {
			if (event.data.function_id !== "parse-contact-list") {
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
		},
	},
	{ event: "Velocast/contact-list.parse" },

	async ({ event, step, logger }) => {
		const { jobId, r2Key, mimeType } = event.data;

		logger.info(`[ParseJob] Starting jobId=${jobId} r2Key=${r2Key}`);

		// ── Step 1: Mark ParseJob as "parsing" ────────────────────────────────────
		const parseJob = await step.run("mark-parsing", () => {
			return prisma.parseJob.update({
				where: { id: jobId },
				data: { status: "parsing", startedAt: new Date() },
				select: { parsedBy: true },
			});
		});

		const userId = parseJob.parsedBy;

		// ── Step 2: Download from R2 + call Gemini Vision ─────────────────────────
		const geminiResult = await step.run("gemini-parse", async () => {
			logger.info(`[ParseJob] Calling Gemini for jobId=${jobId}`);
			const result = await parseContactImageFromR2(r2Key, mimeType);
			logger.info(
				`[ParseJob] Extracted ${result.contacts.length} contacts, confidence=${result.confidence}`
			);
			return result;
		});

		// ── Step 3: Upsert contacts + update ParseJob row ─────────────────────────
		const { inserted, updated } = await step.run(
			"persist-to-postgres",
			async () => {
				let insertedCount = 0;
				let updatedCount = 0;

				// Process each contact individually so we can track insert vs update.
				// We use upsert on the @@unique([userId, phone]) constraint:
				//   - New phone → INSERT a fresh Contact row
				//   - Existing phone → UPDATE name / type / notes / parseJobId (most recent wins)
				//     but leave optedOut alone — we never re-opt someone in on a fresh upload.
				for (const c of geminiResult.contacts) {
					const existing = await prisma.contact.findUnique({
						where: { uploadedBy_phone: { uploadedBy: userId, phone: c.phone } },
						select: { id: true },
					});

					await prisma.contact.upsert({
						where: { uploadedBy_phone: { uploadedBy: userId, phone: c.phone } },
						create: {
							id: c.id,
							parseJobId: jobId,
							uploadedBy: userId,
							name: c.name,
							phone: c.phone,
							channel: c.channel,
							type: c.type,
							notes: c.notes ?? null,
							rawRow: c.rawRow ?? null,
						},
						update: {
							// Update mutable fields from the latest import
							name: c.name,
							type: c.type,
							notes: c.notes ?? null,
							rawRow: c.rawRow ?? null,
							parseJobId: jobId, // attribute to the most recent import
							// channel: intentionally not updated — changing whatsapp→sms
							//   would silently break ongoing campaigns. Let the user edit manually.
							// optedOut: intentionally not updated — never overwrite an opt-out.
						},
					});

					if (existing) {
						updatedCount++;
					} else {
						insertedCount++;
					}
				}

				// Mark ParseJob done
				await prisma.parseJob.update({
					where: { id: jobId },
					data: {
						status: "done",
						rawExtractedText: geminiResult.rawText,
						confidence: geminiResult.confidence,
						warnings: geminiResult.warnings,
						completedAt: new Date(),
					},
				});

				logger.info(
					`[ParseJob] jobId=${jobId} — ${insertedCount} new, ${updatedCount} updated`
				);

				return { inserted: insertedCount, updated: updatedCount };
			}
		);

		return {
			jobId,
			contactsFound: geminiResult.contacts.length,
			inserted,
			updated,
			confidence: geminiResult.confidence,
			warnings: geminiResult.warnings,
		};
	}
);
