// @vitest-environment node
import crypto from "node:crypto";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	batchTagContacts,
	createContact,
	deleteContacts,
	getContact,
	getDuplicates,
	importContactsBatch,
	listTags,
	updateContact,
} from "./router";

describe("Contacts router", () => {
	const mockDb = {
		$transaction: vi.fn().mockImplementation((arg) => {
			if (typeof arg === "function") {
				return arg(mockDb);
			}
			return Promise.all(arg);
		}),
		contact: {
			create: vi.fn(),
			deleteMany: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			groupBy: vi.fn(),
			update: vi.fn(),
		},
		contactImport: {
			create: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
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

	// covers: AC-3
	it("createContact creates a contact with null parseJobId and does not fabricate a synthetic ParseJob", async () => {
		mockDb.contact.findUnique.mockResolvedValue(null);
		mockDb.contact.create.mockResolvedValue({
			channel: "whatsapp",
			id: crypto.randomUUID(),
			name: "Chukwudi Okafor",
			parseJobId: null,
			phone: "+2348011223344",
			tags: ["first_timer"],
			type: "new_contact",
		});

		const result = await call(
			createContact,
			{
				channel: "whatsapp",
				name: "Chukwudi Okafor",
				phone: "+2348011223344",
				tags: ["first_timer"],
				type: "new_contact",
			},
			{ context: mockContext }
		);

		expect(result.name).toBe("Chukwudi Okafor");
		expect(result.channel).toBe("whatsapp");
		expect(result.phone).toBe("+2348011223344");
		expect(result.tags).toEqual(["first_timer"]);

		expect(mockDb.contact.create).toHaveBeenCalledWith({
			data: {
				channel: "whatsapp",
				email: null,
				name: "Chukwudi Okafor",
				notes: null,
				parseJobId: null,
				phone: "+2348011223344",
				tags: ["first_timer"],
				type: "new_contact",
				uploadedBy: "user_test_123",
			},
		});
	});

	// covers: AC-4
	it("createContact rejects duplicate phone number for the same user", async () => {
		mockDb.contact.findUnique.mockResolvedValue({
			id: crypto.randomUUID(),
			name: "Existing Member",
			phone: "+2348011223344",
		});

		await expect(
			call(
				createContact,
				{
					channel: "whatsapp",
					name: "Duplicate Person",
					phone: "+2348011223344",
					type: "contact",
				},
				{ context: mockContext }
			)
		).rejects.toThrow(
			'A contact with phone +2348011223344 already exists ("Existing Member").'
		);

		expect(mockDb.contact.create).not.toHaveBeenCalled();
	});

	// covers: AC-7
	it("createContact persists custom audience tags array", async () => {
		mockDb.contact.findUnique.mockResolvedValue(null);
		mockDb.contact.create.mockResolvedValue({
			channel: "sms",
			id: crypto.randomUUID(),
			name: "Amina Bello",
			parseJobId: null,
			phone: "+2348099887766",
			tags: ["youth_fellowship", "abuja_branch", "choir"],
			type: "prospect",
		});

		const result = await call(
			createContact,
			{
				channel: "sms",
				name: "Amina Bello",
				phone: "+2348099887766",
				tags: ["youth_fellowship", "abuja_branch", "choir"],
				type: "prospect",
			},
			{ context: mockContext }
		);

		expect(result.tags).toEqual(["youth_fellowship", "abuja_branch", "choir"]);
		expect(mockDb.contact.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tags: ["youth_fellowship", "abuja_branch", "choir"],
				}),
			})
		);
	});

	// covers: AC-3
	it("getContact resolves a contact with null parseJobId gracefully", async () => {
		const contactId = crypto.randomUUID();
		mockDb.contact.findFirst.mockResolvedValue({
			channel: "whatsapp",
			createdAt: new Date("2026-09-07T12:00:00.000Z"),
			email: "amina@example.com",
			id: contactId,
			name: "Amina Bello",
			notes: "Joined yesterday",
			optedOut: false,
			parseJob: null,
			parseJobId: null,
			phone: "+2348099887766",
			rawRow: null,
			tags: ["youth_fellowship"],
			type: "contact",
		});

		const result = await call(
			getContact,
			{ id: contactId },
			{ context: mockContext }
		);

		expect(result.parseJobId).toBeNull();
		expect(result.sourceConfidence).toBeNull();
		expect(result.sourceFilename).toBeNull();
		expect(result.tags).toEqual(["youth_fellowship"]);
	});

	// covers: AC-4
	it("updateContact prevents updating phone to conflict with another contact", async () => {
		const targetId = crypto.randomUUID();
		const conflictId = crypto.randomUUID();

		mockDb.contact.findFirst.mockResolvedValue({
			channel: "whatsapp",
			id: targetId,
			name: "Existing Contact",
			phone: "+2348011111111",
		});
		mockDb.contact.findUnique.mockResolvedValue({
			id: conflictId,
			name: "Other Contact",
			phone: "+2348022222222",
		});

		await expect(
			call(
				updateContact,
				{
					id: targetId,
					phone: "+2348022222222",
				},
				{ context: mockContext }
			)
		).rejects.toThrow(
			'Phone +2348022222222 already belongs to contact "Other Contact".'
		);
	});

	// covers: AC-8, AC-9, AC-11
	it("importContactsBatch creates new contacts and creates a ContactImport record", async () => {
		const fakeBatchId = crypto.randomUUID();
		mockDb.contactImport.create.mockResolvedValue({ id: fakeBatchId });
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.contact.findUnique.mockResolvedValue(null);
		mockDb.contact.create.mockResolvedValue({ id: crypto.randomUUID() });

		const result = await call(
			importContactsBatch,
			{
				contacts: [
					{
						name: "Emeka Okafor",
						phone: "08012345678",
						tags: ["member"],
					},
					{
						name: "Zainab Ahmed",
						phone: "+2348098765432",
						tags: ["volunteer"],
					},
				],
				defaultChannel: "whatsapp",
				defaultTags: ["lagos_service"],
				defaultType: "prospect",
				filename: "lagos_contacts.csv",
				isLastChunk: true,
				strategy: "skip_duplicates",
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.created).toBe(2);
		expect(result.skipped).toBe(0);
		expect(result.updated).toBe(0);
		expect(result.errors).toHaveLength(0);
		expect(result.importBatchId).toBe(fakeBatchId);

		expect(mockDb.contactImport.create).toHaveBeenCalledWith({
			data: {
				filename: "lagos_contacts.csv",
				ownerId: "user_test_123",
				status: "completed",
				strategy: "skip_duplicates",
				tagsApplied: ["lagos_service"],
				totalRows: 2,
				uploadedBy: "user_test_123",
			},
		});

		expect(mockDb.contact.create).toHaveBeenCalledTimes(2);
		expect(mockDb.contact.create).toHaveBeenCalledWith({
			data: {
				channel: "whatsapp",
				email: null,
				importBatchId: fakeBatchId,
				metadata: undefined,
				name: "Emeka Okafor",
				notes: null,
				parseJobId: null,
				phone: "+2348012345678",
				rawRow: null,
				tags: ["member", "lagos_service"],
				type: "prospect",
				uploadedBy: "user_test_123",
			},
		});
	});

	// covers: AC-11
	it("importContactsBatch with skip_duplicates leaves existing contact alone", async () => {
		const fakeBatchId = crypto.randomUUID();
		mockDb.contactImport.create.mockResolvedValue({ id: fakeBatchId });
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.contact.findUnique.mockResolvedValue({
			id: "existing_contact_1",
			name: "Existing Contact",
			phone: "+2348012345678",
			tags: ["existing_tag"],
		});

		const result = await call(
			importContactsBatch,
			{
				contacts: [
					{
						name: "New Name Attempt",
						phone: "08012345678",
					},
				],
				filename: "single_row.csv",
				strategy: "skip_duplicates",
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.created).toBe(0);
		expect(result.skipped).toBe(1);
		expect(result.updated).toBe(0);
		expect(mockDb.contact.create).not.toHaveBeenCalled();
		expect(mockDb.contact.update).not.toHaveBeenCalled();
	});

	// covers: AC-11
	it("importContactsBatch with overwrite strategy updates existing fields and merges tags", async () => {
		const fakeBatchId = crypto.randomUUID();
		mockDb.contactImport.create.mockResolvedValue({ id: fakeBatchId });
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.contact.findUnique.mockResolvedValue({
			email: "old@example.com",
			id: "existing_contact_2",
			metadata: { priorKey: "oldVal" },
			name: "Old Name",
			phone: "+2348012345678",
			tags: ["tagA"],
		});
		mockDb.contact.update.mockResolvedValue({});

		const result = await call(
			importContactsBatch,
			{
				contacts: [
					{
						email: "new@example.com",
						metadata: { source: "web_form" },
						name: "Updated Name",
						notes: "VIP note",
						phone: "08012345678",
						tags: ["tagB"],
					},
				],
				filename: "overwrite.csv",
				strategy: "overwrite",
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.created).toBe(0);
		expect(result.skipped).toBe(0);
		expect(result.updated).toBe(1);

		expect(mockDb.contact.update).toHaveBeenCalledWith({
			data: {
				channel: "whatsapp",
				email: "new@example.com",
				importBatchId: fakeBatchId,
				metadata: { priorKey: "oldVal", source: "web_form" },
				name: "Updated Name",
				notes: "VIP note",
				tags: ["tagA", "tagB"],
				type: "prospect",
			},
			where: { id: "existing_contact_2" },
		});
	});

	// covers: AC-11
	it("importContactsBatch with tags_only strategy updates tags without modifying other fields", async () => {
		const fakeBatchId = crypto.randomUUID();
		mockDb.contactImport.create.mockResolvedValue({ id: fakeBatchId });
		mockDb.contactImport.update.mockResolvedValue({});
		mockDb.contact.findUnique.mockResolvedValue({
			email: "kept@example.com",
			id: "existing_contact_3",
			name: "Kept Name",
			phone: "+2348012345678",
			tags: ["existing_tag"],
		});
		mockDb.contact.update.mockResolvedValue({});

		const result = await call(
			importContactsBatch,
			{
				contacts: [
					{
						email: "ignore_this@example.com",
						name: "Ignore This Name",
						phone: "08012345678",
						tags: ["new_tag"],
					},
				],
				filename: "tags_only.csv",
				strategy: "tags_only",
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.updated).toBe(1);

		expect(mockDb.contact.update).toHaveBeenCalledWith({
			data: {
				importBatchId: fakeBatchId,
				tags: ["existing_tag", "new_tag"],
			},
			where: { id: "existing_contact_3" },
		});
	});

	// covers: AC-10
	it("importContactsBatch records normalization failure for invalid phone numbers", async () => {
		const fakeBatchId = crypto.randomUUID();
		mockDb.contactImport.create.mockResolvedValue({ id: fakeBatchId });
		mockDb.contactImport.update.mockResolvedValue({});

		const result = await call(
			importContactsBatch,
			{
				contacts: [
					{
						name: "Invalid Person",
						phone: "invalid_phone_string",
					},
				],
				filename: "bad_numbers.csv",
				strategy: "skip_duplicates",
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.created).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].rowNumber).toBe(1);
		expect(result.errors[0].phone).toBe("invalid_phone_string");
	});

	// covers: AC-7, AC-14
	it("listTags extracts and counts tags sorted by frequency with search filter support", async () => {
		mockDb.contact.findMany.mockResolvedValue([
			{ tags: ["lagos", "vip", "choir"] },
			{ tags: ["lagos", "usher"] },
			{ tags: ["vip", "lagos"] },
		]);

		const allTagsResult = await call(listTags, undefined, {
			context: mockContext,
		});
		expect(allTagsResult.tags).toEqual([
			{ count: 3, tag: "lagos" },
			{ count: 2, tag: "vip" },
			{ count: 1, tag: "choir" },
			{ count: 1, tag: "usher" },
		]);

		const filteredResult = await call(
			listTags,
			{ search: "vi" },
			{ context: mockContext }
		);
		expect(filteredResult.tags).toEqual([{ count: 2, tag: "vip" }]);
	});

	// covers: AC-14
	it("batchTagContacts adds and removes tags across selected contacts", async () => {
		const id1 = crypto.randomUUID();
		const id2 = crypto.randomUUID();

		mockDb.contact.findMany.mockResolvedValue([
			{ id: id1, tags: ["youth", "lagos"] },
			{ id: id2, tags: ["lagos", "member"] },
		]);
		mockDb.contact.update.mockResolvedValue({});

		const result = await call(
			batchTagContacts,
			{
				addTags: ["2026_conference"],
				contactIds: [id1, id2],
				removeTags: ["lagos"],
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.updatedCount).toBe(2);
		expect(mockDb.$transaction).toHaveBeenCalled();
		expect(mockDb.contact.update).toHaveBeenCalledWith({
			data: { tags: ["youth", "2026_conference"] },
			where: { id: id1 },
		});
		expect(mockDb.contact.update).toHaveBeenCalledWith({
			data: { tags: ["member", "2026_conference"] },
			where: { id: id2 },
		});
	});

	it("deleteContacts deletes contacts for tenant and invalidates cache", async () => {
		const id1 = crypto.randomUUID();
		const id2 = crypto.randomUUID();

		mockDb.contact.deleteMany.mockResolvedValue({ count: 2 });

		const result = await call(
			deleteContacts,
			{ ids: [id1, id2] },
			{ context: mockContext }
		);

		expect(result).toEqual({ deleted: 2, success: true });
		expect(mockDb.contact.deleteMany).toHaveBeenCalledWith({
			where: {
				id: { in: [id1, id2] },
				uploadedBy: "user_test_123",
			},
		});
	});

	it("getDuplicates groups contacts by phone number when duplicates exist", async () => {
		mockDb.contact.groupBy.mockResolvedValue([{ phone: "+2348011223344" }]);
		mockDb.contact.findMany.mockResolvedValue([
			{
				channel: "whatsapp",
				createdAt: new Date("2026-01-01"),
				email: "a@test.ng",
				id: crypto.randomUUID(),
				name: "First Contact",
				notes: null,
				optedOut: false,
				parseJob: null,
				phone: "+2348011223344",
				tags: ["first"],
				type: "prospect",
			},
			{
				channel: "sms",
				createdAt: new Date("2026-01-02"),
				email: "b@test.ng",
				id: crypto.randomUUID(),
				name: "Second Contact",
				notes: null,
				optedOut: false,
				parseJob: null,
				phone: "+2348011223344",
				tags: ["second"],
				type: "contact",
			},
		]);

		const result = await call(getDuplicates, undefined, {
			context: mockContext,
		});

		expect(result.groups).toHaveLength(1);
		expect(result.groups[0].phone).toBe("+2348011223344");
		expect(result.groups[0].count).toBe(2);
		expect(result.totalDuplicates).toBe(1);
	});

	it("importContactsBatch preserves global rowNumber in error output for failed rows", async () => {
		mockDb.contactImport.create.mockResolvedValue({
			id: "batch_row_num_test",
		});
		mockDb.contactImport.update.mockResolvedValue({});

		const result = await call(
			importContactsBatch,
			{
				contacts: [
					{
						name: "Invalid Member",
						phone: "invalid_not_a_phone",
						rowNumber: 154,
					},
				],
				filename: "contacts.csv",
			},
			{ context: mockContext }
		);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].rowNumber).toBe(154);
		expect(result.errors[0].phone).toBe("invalid_not_a_phone");
	});
});
