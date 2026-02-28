import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { prisma } from "#/db";
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
			filename: z.string().min(1),
			mimeType: z.enum(ALLOWED_MIME_TYPES),
			fileBase64: z.string().min(1),
			fileSizeBytes: z
				.number()
				.int()
				.positive()
				.max(8 * 1024 * 1024),
		})
	)
	.handler(async ({ input, context }) => {
		const jobId = uuidv4();
		const userId = context.session.user.id;
		const r2Key = buildR2Key(jobId, input.filename, userId);

		// 1. Upload image bytes to Cloudflare R2
		const imageBuffer = Buffer.from(input.fileBase64, "base64");
		await uploadToR2({
			key: r2Key,
			body: imageBuffer,
			contentType: input.mimeType,
			metadata: { jobId, originalFilename: input.filename },
		});

		// 2. Create ParseJob row in Postgres via Prisma
		await prisma.parseJob.create({
			data: {
				id: jobId,
				status: "pending",
				r2Key,
				r2Bucket: BUCKET,
				originalFilename: input.filename,
				mimeType: input.mimeType,
				fileSizeBytes: input.fileSizeBytes,
				parsedBy: context.session.user.id,
			},
		});

		// 3. Fire Inngest background job — returns instantly
		await inngest.send({
			name: "neon/contact-list.parse",
			data: {
				jobId,
				r2Key,
				r2Bucket: BUCKET,
				mimeType: input.mimeType,
				originalFilename: input.filename,
				parsedBy: context.session.user.id,
			},
		});

		return {
			jobId,
			r2Key,
			message:
				"Image uploaded to R2. Gemini parsing started as a background job.",
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
			mimeType: z.enum(ALLOWED_MIME_TYPES),
			fileSizeBytes: z
				.number()
				.int()
				.positive()
				.max(8 * 1024 * 1024),
		})
	)
	.handler(async ({ input, context }) => {
		const jobId = uuidv4();
		const userId = context.session.user.id;
		const r2Key = buildR2Key(jobId, input.filename, userId);
		const presignedUrl = await getPresignedUploadUrl(
			r2Key,
			input.mimeType,
			300
		);
		return { jobId, r2Key, presignedUrl, expiresInSeconds: 300 };
	});

/**
 * confirmDirectUpload
 *
 * Called after the client finishes a direct-to-R2 upload via presigned URL.
 * Creates the Prisma row and fires the Inngest parse job.
 */
export const confirmDirectUpload = protectedProcedure
	.input(
		z.object({
			jobId: z.string().uuid(),
			r2Key: z.string().min(1),
			filename: z.string().min(1),
			mimeType: z.enum(ALLOWED_MIME_TYPES),
			fileSizeBytes: z.number().int().positive(),
		})
	)
	.handler(async ({ input, context }) => {
		const job = await prisma.parseJob.upsert({
			where: { id: input.jobId },
			create: {
				id: input.jobId,
				status: "pending",
				r2Key: input.r2Key,
				r2Bucket: BUCKET,
				originalFilename: input.filename,
				mimeType: input.mimeType,
				fileSizeBytes: input.fileSizeBytes,
				parsedBy: context.session.user.id,
			},
			update: {},
		});

		if (!job.inngestEventId) {
			const event = await inngest.send({
				name: "neon/contact-list.parse",
				data: {
					jobId: input.jobId,
					r2Key: input.r2Key,
					r2Bucket: BUCKET,
					mimeType: input.mimeType,
					originalFilename: input.filename,
					parsedBy: context.session.user.id,
				},
			});
			await prisma.parseJob.update({
				where: { id: input.jobId },
				data: { inngestEventId: event.ids[0] },
			});
		}

		return { jobId: input.jobId, message: "Parse job started." };
	});

/**
 * getParseStatus
 *
 * Polling endpoint — returns parse job status + extracted contacts when done.
 * Frontend polls every ~1.5s until status === "done" | "error".
 */
export const getParseStatus = protectedProcedure
	.input(z.object({ jobId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const job = await prisma.parseJob.findUnique({
			where: { id: input.jobId },
			include: {
				contacts: { orderBy: { createdAt: "asc" } },
			},
		});

		if (!job) {
			throw new Error(`Parse job ${input.jobId} not found`);
		}

		const progressByStatus: Record<string, number> = {
			pending: 10,
			parsing: 55,
			done: 100,
		};
		const progress = progressByStatus[job.status] ?? 0;

		return {
			jobId: job.id,
			status: job.status,
			progress,
			confidence: job.confidence,
			warnings: job.warnings as string[],
			contacts: job.status === "done" ? job.contacts : [],
			totalExtracted: job.status === "done" ? job.contacts.length : 0,
			error: job.status === "error" ? job.errorMessage : undefined,
		};
	});
