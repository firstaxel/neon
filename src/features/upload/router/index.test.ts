// @vitest-environment node
import crypto from "node:crypto";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	commitParsedJob,
	confirmDirectUpload,
	dismissParseJob,
	getParseJob,
	getParseStatus,
	getUploadPresignedUrl,
	listParseJobs,
	uploadContactImage,
} from "./index";

vi.mock("../lib/s3", () => ({
	BUCKET: "test-bucket",
	buildR2Key: vi.fn(
		(jobId: string, filename: string, userId: string) =>
			`${userId}/uploads/2026-09/${jobId}.${filename.split(".").pop()}`
	),
	getPresignedDownloadUrl: vi
		.fn()
		.mockResolvedValue("https://r2.example.com/download/roster-photo.jpg"),
	getPresignedUploadUrl: vi
		.fn()
		.mockResolvedValue("https://r2.example.com/upload/presigned-put"),
	uploadToR2: vi
		.fn()
		.mockResolvedValue({ bucket: "test-bucket", key: "mock-key" }),
}));

vi.mock("#/lib/inngest/client", () => ({
	inngest: {
		send: vi.fn().mockResolvedValue({ ids: ["event_mock_123"] }),
	},
}));

describe("Upload router procedures", () => {
	const mockDb = {
		$transaction: vi.fn().mockImplementation((arg) => {
			if (typeof arg === "function") {
				return arg(mockDb);
			}
			return Promise.all(arg);
		}),
		contact: {
			create: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		contactImport: {
			create: vi.fn(),
			update: vi.fn(),
		},
		parseJob: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	};

	const mockContext = {
		db: mockDb as any,
		session: {
			user: {
				email: "pastor@church.ng",
				id: "user_test_123",
			},
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	// covers: AC-1
	it("getUploadPresignedUrl generates presigned PUT URL and deterministic R2 key", async () => {
		const result = await call(
			getUploadPresignedUrl,
			{
				filename: "attendance_sheet.jpg",
				fileSizeBytes: 1024 * 1024,
				mimeType: "image/jpeg",
			},
			{ context: mockContext }
		);

		expect(result.jobId).toBeDefined();
		expect(result.expiresInSeconds).toBe(300);
		expect(result.presignedUrl).toBe(
			"https://r2.example.com/upload/presigned-put"
		);
		expect(result.r2Key).toContain("user_test_123/uploads/2026-09/");
	});

	// covers: AC-1
	it("confirmDirectUpload upserts ParseJob record and sends Inngest parse event", async () => {
		const jobId = crypto.randomUUID();
		const r2Key = `user_test_123/uploads/2026-09/${jobId}.jpg`;

		mockDb.parseJob.upsert.mockResolvedValue({
			id: jobId,
			inngestEventId: null,
			status: "pending",
		});
		mockDb.parseJob.update.mockResolvedValue({});

		const result = await call(
			confirmDirectUpload,
			{
				filename: "roster.jpg",
				fileSizeBytes: 2048,
				jobId,
				mimeType: "image/jpeg",
				r2Key,
			},
			{ context: mockContext }
		);

		expect(result.jobId).toBe(jobId);
		expect(result.message).toBe("Parse job started.");

		expect(mockDb.parseJob.upsert).toHaveBeenCalledWith({
			create: expect.objectContaining({
				fileSizeBytes: 2048,
				id: jobId,
				mimeType: "image/jpeg",
				originalFilename: "roster.jpg",
				parsedBy: "user_test_123",
				r2Key,
				status: "pending",
			}),
			update: {},
			where: { id: jobId },
		});

		expect(mockDb.parseJob.update).toHaveBeenCalledWith({
			data: { inngestEventId: "event_mock_123" },
			where: { id: jobId },
		});
	});

	// covers: AC-1
	it("confirmDirectUpload does not resend Inngest event if already queued", async () => {
		const jobId = crypto.randomUUID();
		const r2Key = `user_test_123/uploads/2026-09/${jobId}.jpg`;

		mockDb.parseJob.upsert.mockResolvedValue({
			id: jobId,
			inngestEventId: "existing_event_id",
			status: "pending",
		});

		const result = await call(
			confirmDirectUpload,
			{
				filename: "roster.jpg",
				fileSizeBytes: 2048,
				jobId,
				mimeType: "image/jpeg",
				r2Key,
			},
			{ context: mockContext }
		);

		expect(result.jobId).toBe(jobId);
		expect(mockDb.parseJob.update).not.toHaveBeenCalled();
	});

	// covers: AC-1, AC-2
	it("uploadContactImage accepts base64 and schedules background parse", async () => {
		mockDb.parseJob.create.mockResolvedValue({});

		const result = await call(
			uploadContactImage,
			{
				fileBase64: Buffer.from("fake image data").toString("base64"),
				filename: "handwritten_sheet.png",
				fileSizeBytes: 1024,
				mimeType: "image/png",
			},
			{ context: mockContext }
		);

		expect(result.jobId).toBeDefined();
		expect(result.message).toContain("Gemini parsing started");
		expect(mockDb.parseJob.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					mimeType: "image/png",
					originalFilename: "handwritten_sheet.png",
					parsedBy: "user_test_123",
					status: "pending",
				}),
			})
		);
	});

	// covers: AC-3, AC-4, AC-5
	it("getParseStatus returns progress and candidates count", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			candidates: [
				{
					category: "First Timer",
					channel: "whatsapp",
					confidence: 0.95,
					hasWarning: false,
					name: "Ada Lovelace",
					phone: "08012345678",
					rawPhone: "08012345678",
				},
			],
			confidence: 0.92,
			contacts: [],
			errorMessage: null,
			id: jobId,
			reviewStatus: "pending_review",
			status: "done",
			warnings: [],
		});

		const result = await call(
			getParseStatus,
			{ jobId },
			{ context: mockContext }
		);

		expect(result.jobId).toBe(jobId);
		expect(result.status).toBe("done");
		expect(result.reviewStatus).toBe("pending_review");
		expect(result.candidatesCount).toBe(1);
		expect(result.totalExtracted).toBe(1);
		expect(result.progress).toBe(100);
	});

	// covers: AC-4, AC-5
	it("getParseJob returns staged candidates, confidence, and presigned image url", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			candidates: [
				{
					category: "Member",
					channel: "whatsapp",
					confidence: 0.88,
					hasWarning: false,
					name: "Chidi Anagonye",
					phone: "+2348033334444",
					rawPhone: "08033334444",
				},
				{
					category: "Visitor",
					channel: "whatsapp",
					confidence: 0.62,
					hasWarning: true,
					name: "Eleanor Shellstrop",
					phone: "0809999",
					rawPhone: "0809999",
					warningReason: "Invalid phone length",
				},
			],
			confidence: 0.75,
			createdAt: new Date("2026-09-13T10:00:00.000Z"),
			errorMessage: null,
			fileSizeBytes: 4096,
			id: jobId,
			originalFilename: "sunday_roster.jpg",
			r2Key: `user_test_123/uploads/2026-09/${jobId}.jpg`,
			reviewStatus: "pending_review",
			status: "done",
			strategy: "skip_duplicates",
			tagsApplied: [],
			warnings: ["Low confidence rows detected"],
		});

		const result = await call(getParseJob, { jobId }, { context: mockContext });

		expect(result.jobId).toBe(jobId);
		expect(result.reviewStatus).toBe("pending_review");
		expect(result.imageUrl).toBe(
			"https://r2.example.com/download/roster-photo.jpg"
		);
		expect(result.candidates).toHaveLength(2);
		expect(result.candidates[1].hasWarning).toBe(true);
		expect(result.totalExtracted).toBe(2);
	});

	// covers: AC-3, AC-6, AC-7
	it("commitParsedJob inserts new contacts with skip_duplicates strategy and marks job committed", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			originalFilename: "roster.jpg",
			reviewStatus: "pending_review",
		});
		mockDb.contactImport.create.mockResolvedValue({});
		mockDb.contact.findMany.mockResolvedValue([]);
		mockDb.contact.create.mockResolvedValue({ id: crypto.randomUUID() });
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.parseJob.update.mockResolvedValue({});

		const result = await call(
			commitParsedJob,
			{
				contacts: [
					{
						channel: "whatsapp",
						included: true,
						name: "Tunde Bakare",
						phone: "08022223333",
						type: "prospect",
					},
					{
						channel: "whatsapp",
						included: false,
						name: "Excluded Person",
						phone: "08011112222",
						type: "prospect",
					},
				],
				jobId,
				strategy: "skip_duplicates",
				tags: ["Sunday Service", "September 2026"],
			},
			{ context: mockContext }
		);

		expect(result.jobId).toBe(jobId);
		expect(result.createdCount).toBe(1);
		expect(result.skippedCount).toBe(0);
		expect(result.totalProcessed).toBe(1);

		expect(mockDb.contact.findMany).toHaveBeenCalledWith({
			where: {
				phone: { in: ["+2348022223333"] },
				uploadedBy: "user_test_123",
			},
		});

		expect(mockDb.contact.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				channel: "whatsapp",
				name: "Tunde Bakare",
				parseJobId: jobId,
				phone: "+2348022223333",
				tags: ["Sunday Service", "September 2026"],
				uploadedBy: "user_test_123",
			}),
		});

		expect(mockDb.parseJob.update).toHaveBeenCalledWith({
			data: expect.objectContaining({
				reviewStatus: "committed",
				strategy: "skip_duplicates",
				tagsApplied: ["Sunday Service", "September 2026"],
			}),
			where: { id: jobId },
		});
	});

	// covers: AC-6, AC-7
	it("commitParsedJob handles overwrite strategy by updating existing contact and merging tags", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			originalFilename: "roster.jpg",
			reviewStatus: "pending_review",
		});
		mockDb.contactImport.create.mockResolvedValue({});
		mockDb.contact.findMany.mockResolvedValue([
			{
				id: "existing_contact_id",
				notes: "Original note",
				phone: "+2348022223333",
				tags: ["existing_tag"],
			},
		]);
		mockDb.contact.update.mockResolvedValue({});
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.parseJob.update.mockResolvedValue({});

		const result = await call(
			commitParsedJob,
			{
				contacts: [
					{
						channel: "whatsapp",
						included: true,
						name: "Updated Name",
						phone: "08022223333",
						type: "contact",
					},
				],
				jobId,
				strategy: "overwrite",
				tags: ["new_batch_tag"],
			},
			{ context: mockContext }
		);

		expect(result.createdCount).toBe(0);
		expect(result.updatedCount).toBe(1);

		expect(mockDb.contact.update).toHaveBeenCalledWith({
			data: expect.objectContaining({
				name: "Updated Name",
				notes: "Original note",
				parseJobId: jobId,
				tags: ["existing_tag", "new_batch_tag"],
				type: "contact",
			}),
			where: { id: "existing_contact_id" },
		});
	});

	// covers: AC-6, AC-7
	it("commitParsedJob handles tags_only strategy by preserving name and merging tags", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			originalFilename: "roster.jpg",
			reviewStatus: "pending_review",
		});
		mockDb.contactImport.create.mockResolvedValue({});
		mockDb.contact.findMany.mockResolvedValue([
			{
				id: "existing_contact_id",
				phone: "+2348022223333",
				tags: ["existing_tag"],
			},
		]);
		mockDb.contact.update.mockResolvedValue({});
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.parseJob.update.mockResolvedValue({});

		const result = await call(
			commitParsedJob,
			{
				contacts: [
					{
						channel: "whatsapp",
						included: true,
						name: "Ignored Name",
						phone: "08022223333",
						type: "contact",
					},
				],
				jobId,
				strategy: "tags_only",
				tags: ["only_tag"],
			},
			{ context: mockContext }
		);

		expect(result.updatedCount).toBe(1);
		expect(mockDb.contact.update).toHaveBeenCalledWith({
			data: expect.objectContaining({
				parseJobId: jobId,
				tags: ["existing_tag", "only_tag"],
			}),
			where: { id: "existing_contact_id" },
		});
	});

	it("commitParsedJob prefetches in a single findMany call and handles in-batch duplicates", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			originalFilename: "roster.jpg",
			reviewStatus: "pending_review",
		});
		mockDb.contactImport.create.mockResolvedValue({});
		mockDb.contact.findMany.mockResolvedValue([]);
		const createdContact = {
			id: "new_contact_1",
			phone: "+2348022223333",
			tags: ["Batch 1"],
		};
		mockDb.contact.create.mockResolvedValue(createdContact);
		mockDb.contact.update.mockResolvedValue({});
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.parseJob.update.mockResolvedValue({});

		const result = await call(
			commitParsedJob,
			{
				contacts: [
					{
						channel: "whatsapp",
						included: true,
						name: "First Instance",
						phone: "08022223333",
						type: "prospect",
					},
					{
						channel: "whatsapp",
						included: true,
						name: "Second Instance (Duplicate)",
						phone: "08022223333",
						type: "prospect",
					},
				],
				jobId,
				strategy: "skip_duplicates",
				tags: ["Batch 1"],
			},
			{ context: mockContext }
		);

		// Single prefetch query executed
		expect(mockDb.contact.findMany).toHaveBeenCalledTimes(1);
		expect(mockDb.contact.findMany).toHaveBeenCalledWith({
			where: {
				phone: { in: ["+2348022223333"] },
				uploadedBy: "user_test_123",
			},
		});
		// First was created, second was recognized in-memory and skipped
		expect(result.createdCount).toBe(1);
		expect(result.skippedCount).toBe(1);
		expect(mockDb.contact.create).toHaveBeenCalledTimes(1);
	});

	// covers: AC-7
	it("commitParsedJob rejects already committed job", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			reviewStatus: "committed",
		});

		await expect(
			call(
				commitParsedJob,
				{
					contacts: [
						{
							included: true,
							name: "Person",
							phone: "08012345678",
						},
					],
					jobId,
				},
				{ context: mockContext }
			)
		).rejects.toThrow("This parse job has already been committed.");
	});

	// covers: AC-8
	it("dismissParseJob updates review status to dismissed without modifying contacts", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			reviewStatus: "pending_review",
		});
		mockDb.parseJob.update.mockResolvedValue({});

		const result = await call(
			dismissParseJob,
			{ jobId },
			{ context: mockContext }
		);

		expect(result.jobId).toBe(jobId);
		expect(result.reviewStatus).toBe("dismissed");
		expect(mockDb.parseJob.update).toHaveBeenCalledWith({
			data: { reviewStatus: "dismissed" },
			where: { id: jobId },
		});
		expect(mockDb.contact.create).not.toHaveBeenCalled();
	});

	// covers: AC-8
	it("dismissParseJob rejects already committed job", async () => {
		const jobId = crypto.randomUUID();
		mockDb.parseJob.findFirst.mockResolvedValue({
			id: jobId,
			reviewStatus: "committed",
		});

		await expect(
			call(dismissParseJob, { jobId }, { context: mockContext })
		).rejects.toThrow("Cannot dismiss an already committed parse job.");
	});

	it("listParseJobs returns all parse jobs formatted for user", async () => {
		mockDb.parseJob.findMany.mockResolvedValue([
			{
				confidence: 0.9,
				contacts: [{ id: "c1" }],
				createdAt: new Date("2026-09-13T08:00:00.000Z"),
				errorMessage: null,
				fileSizeBytes: 2000,
				id: "job_1",
				originalFilename: "sheet1.jpg",
				status: "done",
				warnings: [],
			},
		]);

		const result = await call(listParseJobs, undefined, {
			context: mockContext,
		});

		expect(result.data).toHaveLength(1);
		expect(result.data[0].jobId).toBe("job_1");
		expect(result.data[0].totalExtracted).toBe(1);
		expect(result.data[0].progress).toBe(100);
	});
});
