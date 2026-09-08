// @vitest-environment node
import crypto from "node:crypto";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createContact,
	getContact,
	updateContact,
} from "./router";

describe("Contacts router", () => {
	const mockDb = {
		contact: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
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
		).rejects.toThrow('A contact with phone +2348011223344 already exists ("Existing Member").');

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
		).rejects.toThrow('Phone +2348022222222 already belongs to contact "Other Contact".');
	});
});
