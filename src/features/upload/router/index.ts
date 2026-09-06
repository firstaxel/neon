import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { inngest } from "#/lib/inngest/client";
import { protectedProcedure } from "#/orpc";
import {
	BUCKET,
	buildR2Key,
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
		const jobId = uuidv4();
		const r2Key = buildR2Key(jobId, input.filename, context.session.user.id);

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
			throw new Error(`Parse job ${input.jobId} not found`);
		}

		const progress =
			job.status === "pending"
				? 10
				: job.status === "parsing"
					? 55
					: job.status === "done"
						? 100
						: 0;

		return {
			confidence: job.confidence,
			contacts: job.status === "done" ? job.contacts : [],
			error: job.status === "error" ? job.errorMessage : undefined,
			jobId: job.id,
			progress,
			status: job.status,
			totalExtracted: job.status === "done" ? job.contacts.length : 0,
			warnings: job.warnings as string[],
		};
	});
