import { useCallback, useRef } from "react";
import type { Contact } from "#/db";
import { client } from "#/orpc/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadStatus = "uploading" | "parsing" | "completed" | "error";

export interface UploadFile {
	contacts?: Contact[]; // populated when status === "completed"
	error?: string;
	file: File;
	id: string;
	jobId?: string; // set after upload, used for parse polling
	parseProgress?: number; // 0–100 Gemini parse progress
	progress: number; // 0–100
	status: UploadStatus;
}

type SetUploadFiles = React.Dispatch<React.SetStateAction<UploadFile[]>>;

const ALLOWED_TYPES = new Set([
	"image/jpeg",
	"image/jpg",
	"image/png",
	"image/webp",
	"image/gif",
]);

const PARSE_POLL_INTERVAL_MS = 1500;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useRealUpload
 *
 * Two-phase upload flow:
 *
 * Phase 1 — Upload (XHR → Cloudflare R2 via presigned URL)
 *   progress 0→90: real byte-level XHR upload progress
 *   progress 90:   confirmDirectUpload called → Inngest parse job fires
 *                  → onUploadComplete fires HERE so the UI can immediately
 *                     refetch + show the existing contact list while parsing runs
 *
 * Phase 2 — Parse  (polling oRPC getParseStatus)
 *   progress 90→100: Gemini AI extracts contacts in background
 *   status "completed": onCompleted fires with the freshly parsed contacts
 *
 * Options:
 *   onUploadComplete(fileId, jobId)
 *     ↳ Fires as soon as the file lands in R2 and the Inngest job is queued.
 *       Use this to immediately refetch your existing contact list so users
 *       see data right away — before Gemini finishes parsing the new upload.
 *       e.g. call your React Query refetch / SWR mutate / router.refresh() here.
 *
 *   onCompleted(fileId, contacts)
 *     ↳ Fires when Gemini finishes parsing. contacts[] is the extracted list
 *       from the newly uploaded image. Use this to merge/replace the list.
 *
 *   onError(fileId, error)
 *     ↳ Fires on any failure in either phase.
 *
 * Usage:
 *   const { startUpload, retryUpload } = useRealUpload(setUploadFiles, {
 *     onUploadComplete: (fileId, jobId) => {
 *       queryClient.invalidateQueries({ queryKey: ["contacts"] }); // refetch immediately
 *     },
 *     onCompleted: (fileId, contacts) => {
 *       setContacts(contacts); // swap in final parsed list
 *     },
 *   });
 */
export function useRealUpload(
	setUploadFiles: SetUploadFiles,
	options?: {
		/** Fires immediately when the file finishes uploading to R2 — before parsing. */
		onUploadComplete?: (fileId: string, jobId: string) => void;
		/** Fires when Gemini finishes parsing and contacts are ready. */
		onCompleted?: (fileId: string, contacts: Contact[]) => void;
		onError?: (fileId: string, error: string) => void;
	}
) {
	// Keep options in a ref so callbacks are always fresh without needing
	// to be listed in useCallback deps (avoids stale closure bugs)
	const optionsRef = useRef(options);
	const startedIds = useRef<Set<string>>(new Set());
	optionsRef.current = options;

	// Track active poll intervals so we can clear them on unmount / retry
	const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(
		new Map()
	);
	// Track active XHR requests for abort-on-retry
	const xhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map());

	// ── Patch helpers ──────────────────────────────────────────────────────────

	const patch = useCallback(
		(fileId: string, update: Partial<UploadFile>) => {
			setUploadFiles((prev) =>
				prev.map((f) => (f.id === fileId ? { ...f, ...update } : f))
			);
		},
		[setUploadFiles]
	);

	const setError = useCallback(
		(fileId: string, error: string) => {
			patch(fileId, { status: "error", error, progress: 0 });
			optionsRef.current?.onError?.(fileId, error);
		},
		[patch]
	);

	// ── Phase 2: Poll Gemini parse status ──────────────────────────────────────

	const startParsePoll = useCallback(
		(fileId: string, jobId: string) => {
			patch(fileId, { status: "parsing", jobId, progress: 90 });

			const interval = setInterval(async () => {
				try {
					const result = await client.upload.getParseStatus({ jobId });

					// Map parse progress 0–100 → display progress 90–100
					const displayProgress = 90 + Math.round((result.progress / 100) * 10);
					patch(fileId, {
						parseProgress: result.progress,
						progress: displayProgress,
					});

					if (result.status === "done") {
						clearInterval(interval);
						pollRefs.current.delete(fileId);

						const contacts = (result.contacts ?? []) as Contact[];
						patch(fileId, { status: "completed", progress: 100, contacts });
						optionsRef.current?.onCompleted?.(fileId, contacts);
					} else if (result.status === "error") {
						clearInterval(interval);
						pollRefs.current.delete(fileId);
						setError(fileId, result.error ?? "Gemini parsing failed");
					}
				} catch {
					// Transient network error — keep polling, don't fail the file
				}
			}, PARSE_POLL_INTERVAL_MS);

			pollRefs.current.set(fileId, interval);
		},
		[patch, setError]
	);

	// ── Phase 1: Upload file to Cloudflare R2 via presigned URL ───────────────

	const startUpload = useCallback(
		async (uploadFile: UploadFile) => {
			const { id: fileId, file } = uploadFile;

			if (startedIds.current.has(fileId)) {
				return;
			}
			startedIds.current.add(fileId);

			if (!ALLOWED_TYPES.has(file.type)) {
				// Guard: validate MIME type client-side before hitting the server
				setError(
					fileId,
					`Unsupported file type: ${file.type}. Use JPEG, PNG, WEBP, or GIF.`
				);
				return;
			}

			if (file.size > 8 * 1024 * 1024) {
				setError(fileId, "File is too large. Maximum size is 8MB.");
				return;
			}

			try {
				// ── Step 1: Get presigned R2 upload URL from oRPC ─────────────────────
				const { jobId, r2Key, presignedUrl } =
					await client.upload.getUploadPresignedUrl({
						filename: file.name,
						mimeType: file.type as
							| "image/jpeg"
							| "image/jpg"
							| "image/png"
							| "image/webp"
							| "image/gif",
						fileSizeBytes: file.size,
					});

				patch(fileId, {
					status: "uploading",
					progress: 0,
					jobId,
					error: undefined,
				});

				// ── Step 2: Upload file bytes directly to R2 with XHR progress ────────
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhrRefs.current.set(fileId, xhr);

					// Real byte-level upload progress — maps to 0→90% of our progress bar
					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							const rawPercent = (event.loaded / event.total) * 100;
							// Cap at 89 so we have room for the parse phase (90–100)
							const displayProgress = Math.min(
								Math.round(rawPercent * 0.9),
								89
							);
							patch(fileId, { progress: displayProgress });
						}
					});

					xhr.addEventListener("load", () => {
						xhrRefs.current.delete(fileId);
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve();
						} else {
							reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
						}
					});

					xhr.addEventListener("error", () => {
						xhrRefs.current.delete(fileId);
						reject(
							new Error(
								"Network error during upload. Please check your connection."
							)
						);
					});

					xhr.addEventListener("abort", () => {
						xhrRefs.current.delete(fileId);
						reject(new Error("Upload was cancelled."));
					});

					// PUT directly to R2 presigned URL — no auth headers needed
					xhr.open("PUT", presignedUrl);
					xhr.setRequestHeader("Content-Type", file.type);
					xhr.send(file);
				});

				// ── Step 3: Notify server upload is done → fire Inngest parse job ─────
				patch(fileId, { progress: 90 });
				await client.upload.confirmDirectUpload({
					jobId,
					r2Key,
					filename: file.name,
					mimeType: file.type as
						| "image/jpeg"
						| "image/jpg"
						| "image/png"
						| "image/webp"
						| "image/gif",
					fileSizeBytes: file.size,
				});

				// ── Fire onUploadComplete immediately ─────────────────────────────────
				// The file is now in R2 and the Inngest parse job is queued.
				// This fires BEFORE Gemini finishes — use it to immediately refetch
				// your existing contact list so the UI shows something right away
				// while parsing runs in the background.
				//
				//   e.g. queryClient.invalidateQueries({ queryKey: ["contacts"] })
				//        router.refresh()
				//        mutate("/api/contacts")
				optionsRef.current?.onUploadComplete?.(fileId, jobId);

				// ── Phase 2: Start polling parse status ───────────────────────────────
				startParsePoll(fileId, jobId);
			} catch (err: unknown) {
				const message =
					err instanceof Error
						? err.message
						: "Upload failed. Please try again.";
				setError(fileId, message);
			}
		},
		[patch, setError, startParsePoll]
	);

	// ── retryUpload ────────────────────────────────────────────────────────────
	// Drop-in replacement for the simulateUpload retryUpload function.
	// Accepts the fileId (to reset state) and the original File object.

	const retryUpload = useCallback(
		(fileId: string, file: File) => {
			// Cancel any in-flight XHR for this file
			const xhr = xhrRefs.current.get(fileId);
			if (xhr) {
				xhr.abort();
				xhrRefs.current.delete(fileId);
			}

			// Clear any running parse poll
			const poll = pollRefs.current.get(fileId);
			if (poll) {
				clearInterval(poll);
				pollRefs.current.delete(fileId);
			}

			// Reset file state back to "uploading" (mirrors the simulateUpload retryUpload shape)
			setUploadFiles((prev) =>
				prev.map((f) =>
					f.id === fileId
						? {
								...f,
								progress: 0,
								status: "uploading" as const,
								error: undefined,
								jobId: undefined,
								parseProgress: undefined,
								contacts: undefined,
							}
						: f
				)
			);

			// Restart the full upload flow
			startUpload({ id: fileId, file, progress: 0, status: "uploading" });
		},
		[setUploadFiles, startUpload]
	);

	// ── Cleanup on unmount ─────────────────────────────────────────────────────

	const cleanup = useCallback(() => {
		for (const xhr of xhrRefs.current.values()) {
			xhr.abort();
		}
		xhrRefs.current.clear();
		for (const interval of pollRefs.current.values()) {
			clearInterval(interval);
		}
		pollRefs.current.clear();
	}, []);

	return { startUpload, retryUpload, cleanup };
}
