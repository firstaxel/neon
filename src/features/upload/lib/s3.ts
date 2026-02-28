import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "#/env";

/**
 * Cloudflare R2 is S3-compatible.
 * Configure it by pointing the S3 endpoint at your R2 account endpoint:
 *   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        - Cloudflare account ID
 *   R2_ACCESS_KEY_ID     - R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY - R2 API token Secret Access Key
 *   R2_BUCKET_NAME       - R2 bucket name
 *   R2_PUBLIC_URL        - (optional) Public bucket URL or custom domain
 */

function createR2Client(): S3Client {
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;
	if (!accountId) {
		throw new Error("R2_ACCOUNT_ID is not set");
	}
	if (!env.CLOUDFLARE_ACCESS_KEY_ID) {
		throw new Error("R2_ACCESS_KEY_ID is not set");
	}
	if (!env.CLOUDFLARE_SECRET_ACCESS_KEY) {
		throw new Error("R2_SECRET_ACCESS_KEY is not set");
	}

	return new S3Client({
		region: "auto", // R2 uses "auto" as the region
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
			secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
		},
	});
}

// Singleton (same pattern as DB client)
declare global {
	// eslint-disable-next-line no-var
	var __r2Client: S3Client | undefined;
}

const r2 = globalThis.__r2Client ?? createR2Client();
if (process.env.NODE_ENV !== "production") {
	globalThis.__r2Client = r2;
}

export const BUCKET = process.env.R2_BUCKET_NAME ?? "bulk-messaging";

// ─── Helper: build deterministic R2 object key ───────────────────────────────

export function buildR2Key(
	jobId: string,
	filename: string,
	userId: string
): string {
	const date = new Date().toISOString().slice(0, 7); // e.g. "2024-11"
	const ext = filename.split(".").pop() ?? "bin";
	return `${userId}/uploads/${date}/${jobId}.${ext}`;
}

// ─── Upload a file buffer to R2 ──────────────────────────────────────────────

export async function uploadToR2(params: {
	key: string;
	body: Buffer;
	contentType: string;
	metadata?: Record<string, string>;
}): Promise<{ key: string; bucket: string }> {
	await r2.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: params.key,
			Body: params.body,
			ContentType: params.contentType,
			Metadata: params.metadata,
		})
	);
	return { key: params.key, bucket: BUCKET };
}

// ─── Download a file from R2 as Buffer ───────────────────────────────────────

export async function downloadFromR2(key: string): Promise<Buffer> {
	const response = await r2.send(
		new GetObjectCommand({ Bucket: BUCKET, Key: key })
	);

	if (!response.Body) {
		throw new Error(`R2 object ${key} has no body`);
	}

	// Convert ReadableStream → Buffer
	const chunks: Uint8Array[] = [];
	const stream = response.Body as AsyncIterable<Uint8Array>;
	for await (const chunk of stream) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

// ─── Get object metadata ──────────────────────────────────────────────────────

export async function getR2ObjectMetadata(key: string) {
	const response = await r2.send(
		new HeadObjectCommand({ Bucket: BUCKET, Key: key })
	);
	return {
		contentType: response.ContentType,
		contentLength: response.ContentLength,
		metadata: response.Metadata,
	};
}

// ─── Generate a presigned download URL (for Gemini to fetch) ─────────────────

export function getPresignedDownloadUrl(
	key: string,
	expiresInSeconds = 300 // 5 minutes — enough for Gemini to fetch
): Promise<string> {
	return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
		expiresIn: expiresInSeconds,
	});
}

// ─── Generate a presigned UPLOAD URL (client-side direct uploads) ─────────────

export function getPresignedUploadUrl(
	key: string,
	contentType: string,
	expiresInSeconds = 300
): Promise<string> {
	return getSignedUrl(
		r2,
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			ContentType: contentType,
		}),
		{ expiresIn: expiresInSeconds }
	);
}

// ─── Delete an object ─────────────────────────────────────────────────────────

export async function deleteFromR2(key: string): Promise<void> {
	await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// ─── Build public URL (if bucket has public access enabled) ───────────────────

const publicUrlRegex = /\/$/;

export function getPublicUrl(key: string): string | null {
	const base = process.env.R2_PUBLIC_URL;
	if (!base) {
		return null;
	}
	return `${base.replace(publicUrlRegex, "")}/${key}`;
}
