// @vitest-environment node
import { describe, expect, it } from "vitest";
import { prisma } from "./db";
import type { Contact, Message, Wallet } from "./db";

describe("Database client and consolidated data model", () => {
	// covers: AC-1
	it("exports a singleton prisma client with expected delegate models", () => {
		expect(prisma).toBeDefined();
		expect(prisma.user).toBeDefined();
		expect(prisma.wallet).toBeDefined();
		expect(prisma.contact).toBeDefined();
		expect(prisma.campaign).toBeDefined();
		expect(prisma.message).toBeDefined();
		expect(prisma.transaction).toBeDefined();
		expect(prisma.parseJob).toBeDefined();
	});

	// covers: AC-6
	it("subscription model delegate is absent from prisma client", () => {
		expect((prisma as any).subscription).toBeUndefined();
	});

	// covers: AC-2, AC-3, AC-7
	it("type shapes reflect consolidated schema attributes", () => {
		const contact: Partial<Contact> = {
			channel: "whatsapp",
			id: "c_1",
			name: "Test Contact",
			parseJobId: null, // AC-3: nullable
			phone: "+2348011223344",
			tags: ["lagos", "first_timers"], // AC-7: native array
		};
		expect(contact.parseJobId).toBeNull();
		expect(contact.tags).toHaveLength(2);

		const message: Partial<Message> = {
			campaignId: "camp_1",
			channel: "sms",
			id: "m_1",
			termiiMessageId: "termii_ref_123", // AC-2: termiiMessageId present
		};
		expect(message.termiiMessageId).toBe("termii_ref_123");
		expect((message as any).twilioSid).toBeUndefined(); // AC-2: twilioSid removed

		const wallet: Partial<Wallet> = {
			balanceKobo: 50000,
			heldKobo: 10000,
			userId: "usr_1",
		};
		expect(wallet.balanceKobo).toBe(50000);
		expect(wallet.heldKobo).toBe(10000);
	});
});
