import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingRouter from "./billing.router";

// Mock dependencies
vi.mock("#/features/billing/utils", () => ({
	PRICING: {
		PER_MESSAGE: {
			sms: 400,
			whatsapp_marketing: 1400,
			whatsapp_service: 0,
			whatsapp_utility: 600,
		},
	},
	formatNaira: (kobo: number) => `₦${(kobo / 100).toLocaleString()}`,
	getOrCreateWallet: vi.fn(),
	nairaToKobo: (naira: number) => naira * 100,
	resolveMessageType: (channel: string, mode: string) => {
		if (channel === "sms") return "sms";
		if (mode === "utility_prescreen") return "whatsapp_utility";
		return "whatsapp_marketing";
	},
}));

vi.mock("#/features/payment/paystack", () => ({
	initializeDeposit: vi.fn(),
	verifyTransaction: vi.fn(),
}));

import { getOrCreateWallet } from "#/features/billing/utils";

describe("Billing router", () => {
	const mockDb = {
		contact: {
			findMany: vi.fn(),
		},
		transaction: {
			count: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		wallet: {
			findUnique: vi.fn(),
		},
	};

	const mockContext = {
		db: mockDb as any,
		session: {
			user: {
				email: "pastor@church.ng",
				id: "user_test_billing",
			},
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	// covers: AC-6
	it("deprecated subscription endpoints are completely absent from billing router", () => {
		const routerKeys = Object.keys(billingRouter);
		expect(routerKeys).not.toContain("getSubscription");
		expect(routerKeys).not.toContain("initSubscription");
		expect(routerKeys).not.toContain("cancelSubscription");
	});

	// covers: AC-6
	it("getWallet returns prepaid wallet balance and available kobo", async () => {
		vi.mocked(getOrCreateWallet).mockResolvedValue({
			balanceKobo: 500000,
			createdAt: new Date(),
			heldKobo: 120000,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		const result = await call(
			billingRouter.getWallet,
			undefined,
			{ context: mockContext }
		);

		expect(result.balanceKobo).toBe(500000);
		expect(result.heldKobo).toBe(120000);
		expect(result.availableKobo).toBe(380000);
		expect(result.balanceFormatted).toBe("₦5,000");
		expect(result.availableFormatted).toBe("₦3,800");
	});

	// covers: AC-6
	it("getTransactions maps ledger entries with credit status and pagination", async () => {
		mockDb.wallet.findUnique.mockResolvedValue({
			id: "wallet_123",
			userId: "user_test_billing",
		});

		mockDb.transaction.count.mockResolvedValue(2);
		mockDb.transaction.findMany.mockResolvedValue([
			{
				amountKobo: 200000,
				balanceAfterKobo: 200000,
				campaignId: null,
				createdAt: new Date("2026-09-07T10:00:00Z"),
				description: "Wallet top-up",
				id: "tx_1",
				reference: "ref_1",
				status: "completed",
				type: "deposit",
			},
			{
				amountKobo: 4000,
				balanceAfterKobo: 196000,
				campaignId: "camp_1",
				createdAt: new Date("2026-09-07T11:00:00Z"),
				description: "Dispatched 10 SMS messages",
				id: "tx_2",
				reference: "ref_2",
				status: "completed",
				type: "message_debit",
			},
		]);

		const result = await call(
			billingRouter.getTransactions,
			{ page: 1, pageSize: 20 },
			{ context: mockContext }
		);

		expect(result.pagination.total).toBe(2);
		expect(result.transactions).toHaveLength(2);
		expect(result.transactions[0].isCredit).toBe(true);
		expect(result.transactions[1].isCredit).toBe(false);
		expect(result.transactions[1].type).toBe("message_debit");
	});

	// covers: AC-6
	it("checkCampaignCost calculates cost accurately for mixed SMS and WhatsApp", async () => {
		vi.mocked(getOrCreateWallet).mockResolvedValue({
			balanceKobo: 10000,
			createdAt: new Date(),
			heldKobo: 0,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		const result = await call(
			billingRouter.checkCampaignCost,
			{
				contacts: [
					{ channel: "sms" }, // 400 kobo
					{ channel: "whatsapp" }, // 1400 kobo
				],
				deliveryMode: "marketing",
			},
			{ context: mockContext }
		);

		// Total: 400 + 1400 = 1800 kobo
		expect(result.totalCostKobo).toBe(1800);
		expect(result.canAfford).toBe(true);
		expect(result.shortfallKobo).toBe(0);
	});
});
