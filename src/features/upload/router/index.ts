import { ORPCError } from "@orpc/server";
import { captureException, startSpan } from "@sentry/tanstackstart-react";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { PrismaClient } from "#/db";
import { normalizePhoneNumber } from "#/features/contacts/utils/phone";
import type { CandidateContact } from "#/lib/gemini";
import { inngest } from "#/lib/inngest/client";
import { protectedProcedure } from "#/orpc";
import {
	BUCKET,
	buildR2Key,
	getPresignedDownloadUrl,
	getPresignedUploadUrl,
	uploadToR2,
} from "../lib/s3";

const ALLOWED_MIME_TYPES = [
	"image/jpeg",
	"image/jpg",
	"image/png",
	"image/webp",
	"image/gif",
] as const;

// ─── Procedures ───────────────────────────────────────────────────────────────

/**
 * uploadContactImage
 *
 * Server-side upload:
 *   Client sends file as base64 → server uploads to Cloudflare R2
 *   → creates ParseJob row in Postgres → triggers Inngest background job
 *
 * Returns jobId instantly. Client polls `getParseStatus` for completion.
 */
export const uploadContactImage = protectedProcedure
	.input(
		z.object({
			fileBase64: z.string().min(1),
			filename: z.string().min(1),
			fileSizeBytes: z
				.number()
				.int()
				.positive()
				.max(8 * 1024 * 1024),
			mimeType: z.enum(ALLOWED_MIME_TYPES),
		})
	)
	.handler(async ({ input, context }) => {
		return await startSpan(
			{ name: "uploadContactImage", op: "function" },
			async () => {
				const jobId = uuidv4();
				const r2Key = buildR2Key(
					jobId,
					input.filename,
					context.session.user.id
				);

				// 1. Upload image bytes to Cloudflare R2
				const imageBuffer = Buffer.from(input.fileBase64, "base64");
				await uploadToR2({
					body: imageBuffer,
					contentType: input.mimeType,
					key: r2Key,
					metadata: { jobId, originalFilename: input.filename },
				});

				// 2. Create ParseJob row in Postgres via context.db
				await context.db.parseJob.create({
					data: {
						fileSizeBytes: input.fileSizeBytes,
						id: jobId,
						mimeType: input.mimeType,
						originalFilename: input.filename,
						parsedBy: context.session.user.id,
						r2Bucket: BUCKET,
						r2Key,
						status: "pending",
					},
				});

				// 3. Fire Inngest background job — returns instantly
				await inngest.send({
					data: {
						jobId,
						mimeType: input.mimeType,
						originalFilename: input.filename,
						parsedBy: context.session.user.id,
						r2Bucket: BUCKET,
						r2Key,
					},
					name: "Velocast/contact-list.parse",
				});

				return {
					jobId,
					message:
						"Image uploaded to R2. Gemini parsing started as a background job.",
					r2Key,
				};
			}
		);
	});

/**
 * getUploadPresignedUrl
 *
 * Client-side direct upload pattern (better for large files):
 *  1. Client calls this → gets a presigned R2 PUT URL
 *  2. Client uploads file directly to R2 (bypasses Next.js server)
 *  3. Client calls confirmDirectUpload to create the DB row + start parsing
 */
export const getUploadPresignedUrl = protectedProcedure
	.input(
		z.object({
			filename: z.string().min(1),
			fileSizeBytes: z
				.number()
				.int()
				.positive()
				.max(8 * 1024 * 1024),
			mimeType: z.enum(ALLOWED_MIME_TYPES),
		})
	)
	.handler(async ({ input, context }) => {
		const jobId = uuidv4();
		const r2Key = buildR2Key(jobId, input.filename, context.session.user.id);
		const presignedUrl = await getPresignedUploadUrl(
			r2Key,
			input.mimeType,
			300
		);
		return { expiresInSeconds: 300, jobId, presignedUrl, r2Key };
	});

/**
 * confirmDirectUpload
 *
 * Called after the client finishes a direct-to-R2 upload via presigned URL.
 * Creates the context.db row and fires the Inngest parse job.
 *
 * Idempotent — safe to call twice with the same jobId. The upsert ensures
 * only one DB row is ever created, and the inngestEventId check ensures
 * the Inngest event is only sent once even if the client calls this endpoint
 * twice (e.g. React StrictMode double-invoke, network retry, component re-render).
 */
export const confirmDirectUpload = protectedProcedure
	.input(
		z.object({
			filename: z.string().min(1),
			fileSizeBytes: z.number().int().positive(),
			jobId: z.string().uuid(),
			mimeType: z.enum(ALLOWED_MIME_TYPES),
			r2Key: z.string().min(1),
		})
	)
	.handler(async ({ input, context }) => {
		return await startSpan(
			{ name: "confirmDirectUpload", op: "function" },
			async () => {
				// Try to create the row. If it already exists, do nothing and return it.
				// This is the clean idempotency pattern: one atomic operation, no races.
				const job = await context.db.parseJob.upsert({
					create: {
						fileSizeBytes: input.fileSizeBytes,
						id: input.jobId,
						mimeType: input.mimeType,
						originalFilename: input.filename,
						parsedBy: context.session.user.id,
						r2Bucket: BUCKET,
						r2Key: input.r2Key,
						status: "pending",
					},
					update: {}, // row exists — leave it completely untouched
					where: { id: input.jobId },
				});

				// Only send the Inngest event if no event has been queued yet.
				// inngestEventId is null on a freshly created row and set after the first send.
				if (!job.inngestEventId) {
					const event = await inngest.send({
						data: {
							jobId: input.jobId,
							mimeType: input.mimeType,
							originalFilename: input.filename,
							parsedBy: context.session.user.id,
							r2Bucket: BUCKET,
							r2Key: input.r2Key,
						},
						name: "Velocast/contact-list.parse",
					});

					// Stamp the eventId so any subsequent duplicate call sees this and skips
					await context.db.parseJob.update({
						data: { inngestEventId: event.ids[0] ?? "queued" },
						where: { id: input.jobId },
					});
				}

				return { jobId: input.jobId, message: "Parse job started." };
			}
		);
	});

/**
 * listParseJobs
 *
 * Returns all parse jobs ordered newest-first.
 * Used by the dashboard to render the full parsing history list.
 */
export const listParseJobs = protectedProcedure.handler(async ({ context }) => {
	const jobs = await context.db.parseJob.findMany({
		include: {
			contacts: { orderBy: { createdAt: "asc" } },
		},
		orderBy: { createdAt: "desc" },
		where: { parsedBy: context.session.user.id },
	});

	return {
		data: jobs.map((job) => ({
			confidence: job.confidence,
			contacts: job.status === "done" ? job.contacts : [],
			createdAt: job.createdAt.toISOString(),
			error: job.status === "error" ? job.errorMessage : undefined,
			fileSizeBytes: job.fileSizeBytes,
			jobId: job.id,
			originalFilename: job.originalFilename,
			progress:
				job.status === "pending"
					? 10
					: job.status === "parsing"
						? 55
						: job.status === "done"
							? 100
							: 0,
			status: job.status as "pending" | "parsing" | "done" | "error",
			totalExtracted: job.status === "done" ? job.contacts.length : 0,
			warnings: job.warnings as string[],
		})),
	};
});

/**
 * getParseStatus
 *
 * Polling endpoint — returns parse job status + extracted contacts when done.
 * Frontend polls every ~1.5s until status === "done" | "error".
 */
export const getParseStatus = protectedProcedure
	.input(z.object({ jobId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const job = await context.db.parseJob.findFirst({
			include: {
				contacts: { orderBy: { createdAt: "asc" } },
			},
			where: { id: input.jobId, parsedBy: context.session.user.id },
		});

		if (!job) {
			throw new ORPCError("NOT_FOUND", {
				message: `Parse job ${input.jobId} not found`,
			});
		}

		const progress =
			job.status === "pending"
				? 10
				: job.status === "parsing"
					? 55
					: job.status === "done"
						? 100
						: 0;

		const candidates =
			(job.candidates as unknown as CandidateContact[] | null) ?? [];

		return {
			candidatesCount: candidates.length,
			confidence: job.confidence,
			contacts: job.status === "done" ? job.contacts : [],
			error: job.status === "error" ? job.errorMessage : undefined,
			jobId: job.id,
			progress,
			reviewStatus: job.reviewStatus,
			status: job.status,
			totalExtracted:
				job.status === "done" ? candidates.length || job.contacts.length : 0,
			warnings: job.warnings as string[],
		};
	});

/**
 * getParseJob
 *
 * Retrieves full candidate details and a presigned download URL for the roster image
 * so the user can inspect the photo side by side with parsed data.
 */
export const getParseJob = protectedProcedure
	.input(z.object({ jobId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const job = await context.db.parseJob.findFirst({
			where: { id: input.jobId, parsedBy: context.session.user.id },
		});

		if (!job) {
			throw new ORPCError("NOT_FOUND", {
				message: `Parse job ${input.jobId} not found`,
			});
		}

		let imageUrl = "";
		try {
			imageUrl = await getPresignedDownloadUrl(job.r2Key, 600);
		} catch (error) {
			captureException(error);
			console.error(
				"Failed to generate presigned download URL for parse job:",
				error
			);
			imageUrl = "";
		}

		const candidates =
			(job.candidates as unknown as CandidateContact[] | null) ?? [];

		return {
			candidates,
			confidence: job.confidence ?? 0.85,
			createdAt: job.createdAt.toISOString(),
			error: job.errorMessage,
			fileSizeBytes: job.fileSizeBytes,
			imageUrl,
			jobId: job.id,
			originalFilename: job.originalFilename,
			reviewStatus: job.reviewStatus,
			status: job.status,
			strategy: job.strategy,
			tagsApplied: job.tagsApplied,
			totalExtracted: candidates.length,
			warnings: job.warnings as string[],
		};
	});

type TransactionClient = Parameters<
	Parameters<PrismaClient["$transaction"]>[0]
>[0];

interface StagedContactItem {
	channel: "whatsapp" | "sms";
	id?: string;
	included: boolean;
	name: string;
	notes?: string;
	phone: string;
	type: "new_contact" | "returning" | "contact" | "prospect";
}

interface ExistingContactItem {
	channel?: string | null;
	id: string;
	importBatchId?: string | null;
	name?: string;
	notes?: string | null;
	parseJobId?: string | null;
	phone: string;
	tags: string[];
	type?: string | null;
}

type ContactResolution =
	| { action: "skipped" }
	| {
			action: "created" | "updated";
			op: Promise<unknown>;
			record: ExistingContactItem;
	  };

function resolveContactMutation(
	tx: TransactionClient,
	c: StagedContactItem,
	existing: ExistingContactItem | undefined,
	importId: string,
	jobId: string,
	strategy: "skip_duplicates" | "overwrite" | "tags_only",
	tags: string[],
	userId: string
): ContactResolution {
	if (!existing) {
		const newId = uuidv4();
		const op = tx.contact.create({
			data: {
				channel: c.channel,
				id: newId,
				importBatchId: importId,
				name: c.name,
				notes: c.notes,
				parseJobId: jobId,
				phone: c.phone,
				tags,
				type: c.type,
				uploadedBy: userId,
			},
		});
		return {
			action: "created",
			op,
			record: {
				channel: c.channel,
				id: newId,
				importBatchId: importId,
				name: c.name,
				notes: c.notes,
				parseJobId: jobId,
				phone: c.phone,
				tags,
				type: c.type,
			},
		};
	}

	if (strategy === "skip_duplicates") {
		return { action: "skipped" };
	}

	const mergedTags = Array.from(new Set([...existing.tags, ...tags]));

	if (strategy === "tags_only") {
		const op = tx.contact.update({
			data: {
				importBatchId: importId,
				parseJobId: jobId,
				tags: mergedTags,
			},
			where: { id: existing.id },
		});
		return {
			action: "updated",
			op,
			record: {
				...existing,
				importBatchId: importId,
				parseJobId: jobId,
				tags: mergedTags,
			},
		};
	}

	// Strategy: overwrite
	const op = tx.contact.update({
		data: {
			channel: c.channel,
			importBatchId: importId,
			name: c.name,
			notes: c.notes ?? existing.notes,
			parseJobId: jobId,
			tags: mergedTags,
			type: c.type,
		},
		where: { id: existing.id },
	});
	return {
		action: "updated",
		op,
		record: {
			...existing,
			channel: c.channel,
			importBatchId: importId,
			name: c.name,
			notes: c.notes ?? existing.notes,
			parseJobId: jobId,
			tags: mergedTags,
			type: c.type,
		},
	};
}

interface ExecuteBatchCommitParams {
	activeContacts: StagedContactItem[];
	db: PrismaClient;
	jobId: string;
	originalFilename: string | null;
	strategy: "skip_duplicates" | "overwrite" | "tags_only";
	tags: string[];
	userId: string;
}

async function executeBatchCommit({
	activeContacts,
	db,
	jobId,
	originalFilename,
	strategy,
	tags,
	userId,
}: ExecuteBatchCommitParams) {
	const importId = uuidv4();
	let createdCount = 0;
	let updatedCount = 0;
	let skippedCount = 0;

	const normalizedContacts = activeContacts.map((c) => {
		const norm = normalizePhoneNumber(c.phone);
		const phone = norm.success && norm.phone ? norm.phone : c.phone;
		return { ...c, phone };
	});

	const activePhones = Array.from(
		new Set(normalizedContacts.map((c) => c.phone))
	);

	await db.$transaction(async (tx) => {
		await tx.contactImport.create({
			data: {
				createdCount: 0,
				filename: originalFilename ?? "roster-sheet.jpg",
				id: importId,
				ownerId: userId,
				status: "completed",
				strategy,
				tagsApplied: tags,
				totalRows: activeContacts.length,
				uploadedBy: userId,
			},
		});

		const existingContacts = await tx.contact.findMany({
			where: {
				phone: { in: activePhones },
				uploadedBy: userId,
			},
		});

		const existingByPhone = new Map<string, ExistingContactItem>(
			existingContacts.map((existing) => [existing.phone, existing])
		);
		const operations: Promise<unknown>[] = [];

		for (const c of normalizedContacts) {
			const existing = existingByPhone.get(c.phone);
			const resolution = resolveContactMutation(
				tx,
				c,
				existing,
				importId,
				jobId,
				strategy,
				tags,
				userId
			);

			if (resolution.action === "skipped") {
				skippedCount += 1;
				continue;
			}

			if (resolution.action === "updated") {
				updatedCount += 1;
			} else {
				createdCount += 1;
			}

			operations.push(resolution.op);
			existingByPhone.set(c.phone, resolution.record);
		}

		await Promise.all(operations);

		await tx.contactImport.update({
			data: {
				createdCount,
				skippedCount,
				updatedCount,
			},
			where: { id: importId },
		});

		await tx.parseJob.update({
			data: {
				completedAt: new Date(),
				reviewStatus: "committed",
				strategy,
				tagsApplied: tags,
			},
			where: { id: jobId },
		});
	});

	return {
		createdCount,
		importId,
		jobId,
		skippedCount,
		totalProcessed: activeContacts.length,
		updatedCount,
	};
}

/**
 * commitParsedJob
 *
 * Atomically commits candidate contacts into the contact directory
 * with the chosen deduplication strategy and tags.
 */
export const commitParsedJob = protectedProcedure
	.input(
		z.object({
			contacts: z.array(
				z.object({
					channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
					id: z.string().optional(),
					included: z.boolean().default(true),
					name: z.string().min(1),
					notes: z.string().optional(),
					phone: z.string().min(5),
					type: z
						.enum(["new_contact", "returning", "contact", "prospect"])
						.default("prospect"),
				})
			),
			jobId: z.string().uuid(),
			strategy: z
				.enum(["skip_duplicates", "overwrite", "tags_only"])
				.default("skip_duplicates"),
			tags: z.array(z.string()).default([]),
		})
	)
	.handler(
		async ({ input, context }) =>
			await startSpan({ name: "commitParsedJob", op: "function" }, async () => {
				const userId = context.session.user.id;
				const job = await context.db.parseJob.findFirst({
					where: { id: input.jobId, parsedBy: userId },
				});

				if (!job) {
					throw new ORPCError("NOT_FOUND", {
						message: `Parse job ${input.jobId} not found`,
					});
				}

				if (job.reviewStatus === "committed") {
					throw new ORPCError("BAD_REQUEST", {
						message: "This parse job has already been committed.",
					});
				}

				const activeContacts = input.contacts.filter((c) => c.included);
				if (activeContacts.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message: "No contacts selected for import.",
					});
				}

				return await executeBatchCommit({
					activeContacts,
					db: context.db,
					jobId: job.id,
					originalFilename: job.originalFilename,
					strategy: input.strategy,
					tags: input.tags,
					userId,
				});
			})
	);

/**
 * dismissParseJob
 *
 * Marks a parse job as dismissed without saving contacts to directory.
 */
export const dismissParseJob = protectedProcedure
	.input(z.object({ jobId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const job = await context.db.parseJob.findFirst({
			where: { id: input.jobId, parsedBy: context.session.user.id },
		});

		if (!job) {
			throw new ORPCError("NOT_FOUND", {
				message: `Parse job ${input.jobId} not found`,
			});
		}

		if (job.reviewStatus === "committed") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot dismiss an already committed parse job.",
			});
		}

		await context.db.parseJob.update({
			data: { reviewStatus: "dismissed" },
			where: { id: input.jobId },
		});

		return { jobId: input.jobId, reviewStatus: "dismissed" as const };
	});
