import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkCampaignCost,
	getTransactions,
	getWallet,
	initDeposit,
	verifyDeposit,
} from "./billing.router";

const MISMATCH_REGEX = /amount or currency mismatch/i;
const NOT_FOUND_REGEX = /not found/i;

// Mock dependencies
vi.mock("#/features/billing/utils", () => ({
	creditWallet: vi.fn(),
	getOrCreateWallet: vi.fn(),
}));

vi.mock("#/features/billing/utils/format", () => ({
	formatNaira: (kobo: number) => `₦${(kobo / 100).toLocaleString()}`,
	nairaToKobo: (naira: number) => naira * 100,
	PRICING: {
		PER_MESSAGE: {
			sms: 600,
			whatsapp_marketing: 9000,
			whatsapp_service: 0,
			whatsapp_utility: 800,
		},
	},
	resolveMessageType: (channel: string, mode: string) => {
		if (channel === "sms") {
			return "sms";
		}
		if (mode === "utility_prescreen") {
			return "whatsapp_utility";
		}
		return "whatsapp_marketing";
	},
}));

vi.mock("#/features/payment/paystack/fee", () => ({
	calculatePaystackFee: (netKobo: number) => {
		const flatFeeKobo = netKobo >= 250_000 ? 10_000 : 0;
		const rawFee = Math.round((netKobo + flatFeeKobo) / (1 - 0.015)) - netKobo;
		return Math.min(200_000, rawFee);
	},
}));

vi.mock("#/features/payment/paystack", () => ({
	initializeDeposit: vi.fn(),
	verifyTransaction: vi.fn(),
}));

import { creditWallet, getOrCreateWallet } from "#/features/billing/utils";
import {
	initializeDeposit,
	verifyTransaction,
} from "#/features/payment/paystack";
import { invalidate } from "#/lib/cache";

describe("Billing router", () => {
	const mockDb = {
		contact: {
			findMany: vi.fn(),
		},
		transaction: {
			count: vi.fn(),
			create: vi.fn(),
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
		invalidate("user_test_billing", "billing.getTransactions");
		invalidate("user_test_billing", "billing.getWallet");
	});

	// covers: AC-6, AC-9
	it("deprecated subscription endpoints are completely absent from billing router", async () => {
		const routerModule = await import("./billing.router");
		const routerKeys = Object.keys(routerModule);
		expect(routerKeys).not.toContain("getSubscription");
		expect(routerKeys).not.toContain("initSubscription");
		expect(routerKeys).not.toContain("cancelSubscription");
	});

	// covers: AC-6
	it("getWallet returns prepaid wallet balance and available kobo", async () => {
		(getOrCreateWallet as any).mockResolvedValue({
			balanceKobo: 500_000,
			createdAt: new Date(),
			heldKobo: 120_000,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		const result = await call(getWallet, undefined, {
			context: mockContext,
		});

		expect(result.balanceKobo).toBe(500_000);
		expect(result.heldKobo).toBe(120_000);
		expect(result.availableKobo).toBe(380_000);
		expect(result.balanceFormatted).toBe("₦5,000");
		expect(result.availableFormatted).toBe("₦3,800");
	});

	// covers: AC-1, AC-2
	it("initDeposit calculates gateway fee and initializes Paystack checkout for valid amount", async () => {
		(getOrCreateWallet as any).mockResolvedValue({
			balanceKobo: 0,
			createdAt: new Date(),
			heldKobo: 0,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		mockDb.transaction.create.mockResolvedValue({
			id: "tx_dep_1",
		});

		(initializeDeposit as any).mockResolvedValue({
			access_code: "acc_123",
			authorization_url: "https://checkout.paystack.com/pay123",
			reference: "dep_test_ref",
		});

		const result = await call(
			initDeposit,
			{
				amountNaira: 10_000,
				callbackUrl: "https://velocast.ng/billing/verify",
			},
			{ context: mockContext }
		);

		expect(result.amountKobo).toBe(1_000_000);
		expect(result.feeKobo).toBe(25_381);
		expect(result.grossKobo).toBe(1_025_381);
		expect(result.checkoutUrl).toBe("https://checkout.paystack.com/pay123");

		expect(mockDb.transaction.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				amountKobo: 1_000_000,
				balanceAfterKobo: 0,
				status: "pending",
				type: "deposit",
				walletId: "wallet_123",
			}),
		});
	});

	// covers: AC-1
	it("initDeposit enforces minimum deposit limit of 500 Naira", async () => {
		await expect(
			call(
				initDeposit,
				{
					amountNaira: 499,
					callbackUrl: "https://velocast.ng/billing/verify",
				},
				{ context: mockContext }
			)
		).rejects.toThrow();
	});

	// covers: AC-1
	it("initDeposit enforces maximum deposit limit of 5000000 Naira", async () => {
		await expect(
			call(
				initDeposit,
				{
					amountNaira: 5_000_001,
					callbackUrl: "https://velocast.ng/billing/verify",
				},
				{ context: mockContext }
			)
		).rejects.toThrow();
	});

	// covers: AC-2, AC-4, AC-10
	it("verifyDeposit credits wallet when gross amount and currency match", async () => {
		const pendingTx = {
			amountKobo: 1_000_000,
			id: "tx_123",
			metadata: {
				feeKobo: 25_381,
				grossKobo: 1_025_381,
			},
			reference: "dep_ref_123",
			status: "pending",
			wallet: {
				balanceKobo: 500_000,
				id: "wallet_123",
				userId: "user_test_billing",
			},
			walletId: "wallet_123",
		};

		mockDb.transaction.findUnique.mockResolvedValue(pendingTx);
		(verifyTransaction as any).mockResolvedValue({
			amount: 1_025_381,
			channel: "card",
			currency: "NGN",
			paidAt: new Date().toISOString(),
			reference: "dep_ref_123",
			status: "success",
		});

		(creditWallet as any).mockResolvedValue({
			balanceKobo: 1_500_000,
			createdAt: new Date(),
			heldKobo: 0,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		const result = await call(
			verifyDeposit,
			{ reference: "dep_ref_123" },
			{ context: mockContext }
		);

		expect(result.alreadyProcessed).toBe(false);
		expect(result.amountKobo).toBe(1_000_000);
		expect(result.newBalanceKobo).toBe(1_500_000);
		expect(result.newBalanceFormatted).toBe("₦15,000");
		expect(creditWallet).toHaveBeenCalledWith(
			expect.objectContaining({
				amountKobo: 1_000_000,
				reference: "dep_ref_123",
				userId: "user_test_billing",
			})
		);
	});

	// covers: AC-4
	it("verifyDeposit handles already completed transaction idempotently", async () => {
		const completedTx = {
			amountKobo: 1_000_000,
			id: "tx_123",
			reference: "dep_ref_123",
			status: "completed",
			wallet: {
				balanceKobo: 1_500_000,
				id: "wallet_123",
				userId: "user_test_billing",
			},
			walletId: "wallet_123",
		};

		mockDb.transaction.findUnique.mockResolvedValue(completedTx);
		(getOrCreateWallet as any).mockResolvedValue({
			balanceKobo: 1_500_000,
			createdAt: new Date(),
			heldKobo: 0,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		const result = await call(
			verifyDeposit,
			{ reference: "dep_ref_123" },
			{ context: mockContext }
		);

		expect(result.alreadyProcessed).toBe(true);
		expect(result.amountKobo).toBe(1_000_000);
		expect(result.newBalanceKobo).toBe(1_500_000);
		expect(verifyTransaction).not.toHaveBeenCalled();
		expect(creditWallet).not.toHaveBeenCalled();
	});

	// covers: AC-10
	it("verifyDeposit rejects payment when Paystack amount does not match expected gross kobo", async () => {
		const pendingTx = {
			amountKobo: 1_000_000,
			id: "tx_123",
			metadata: {
				feeKobo: 25_381,
				grossKobo: 1_025_381,
			},
			reference: "dep_ref_123",
			status: "pending",
			wallet: {
				balanceKobo: 500_000,
				id: "wallet_123",
				userId: "user_test_billing",
			},
			walletId: "wallet_123",
		};

		mockDb.transaction.findUnique.mockResolvedValue(pendingTx);
		(verifyTransaction as any).mockResolvedValue({
			amount: 500_000, // Tampered amount
			channel: "card",
			currency: "NGN",
			paidAt: new Date().toISOString(),
			reference: "dep_ref_123",
			status: "success",
		});

		await expect(
			call(
				verifyDeposit,
				{ reference: "dep_ref_123" },
				{ context: mockContext }
			)
		).rejects.toThrow(MISMATCH_REGEX);

		expect(mockDb.transaction.update).toHaveBeenCalledWith({
			data: { status: "failed" },
			where: { reference: "dep_ref_123" },
		});
		expect(creditWallet).not.toHaveBeenCalled();
	});

	// covers: AC-6, AC-7
	it("getTransactions maps ledger entries with credit status and pagination", async () => {
		mockDb.wallet.findUnique.mockResolvedValue({
			id: "wallet_123",
			userId: "user_test_billing",
		});

		mockDb.transaction.count.mockResolvedValue(2);
		mockDb.transaction.findMany.mockResolvedValue([
			{
				amountKobo: 200_000,
				balanceAfterKobo: 200_000,
				campaignId: null,
				createdAt: new Date("2026-09-07T10:00:00Z"),
				description: "Wallet deposit",
				id: "tx_1",
				reference: "ref_1",
				status: "completed",
				type: "deposit",
			},
			{
				amountKobo: 6000,
				balanceAfterKobo: 194_000,
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
			getTransactions,
			{ page: 1, pageSize: 20 },
			{ context: mockContext }
		);

		expect(result.pagination.total).toBe(2);
		expect(result.transactions).toHaveLength(2);
		expect(result.transactions[0].isCredit).toBe(true);
		expect(result.transactions[1].isCredit).toBe(false);
		expect(result.transactions[1].type).toBe("message_debit");
	});

	// covers: AC-7
	it("getTransactions supports filtering by transaction type", async () => {
		mockDb.wallet.findUnique.mockResolvedValue({
			id: "wallet_123",
			userId: "user_test_billing",
		});

		mockDb.transaction.count.mockResolvedValue(1);
		mockDb.transaction.findMany.mockResolvedValue([
			{
				amountKobo: 200_000,
				balanceAfterKobo: 200_000,
				campaignId: null,
				createdAt: new Date("2026-09-07T10:00:00Z"),
				description: "Wallet deposit",
				id: "tx_1",
				reference: "ref_1",
				status: "completed",
				type: "deposit",
			},
		]);

		const result = await call(
			getTransactions,
			{ page: 1, pageSize: 20, type: "deposit" },
			{ context: mockContext }
		);

		expect(mockDb.transaction.count).toHaveBeenCalledWith({
			where: { type: "deposit", walletId: "wallet_123" },
		});
		expect(result.transactions).toHaveLength(1);
		expect(result.transactions[0].type).toBe("deposit");
	});

	// covers: AC-6, AC-8
	it("checkCampaignCost calculates cost accurately for mixed SMS and WhatsApp", async () => {
		(getOrCreateWallet as any).mockResolvedValue({
			balanceKobo: 100_000,
			createdAt: new Date(),
			heldKobo: 0,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		const result = await call(
			checkCampaignCost,
			{
				contacts: [
					{ channel: "sms" }, // 600 kobo
					{ channel: "whatsapp" }, // 9000 kobo
				],
				deliveryMode: "marketing",
			},
			{ context: mockContext }
		);

		// Total: 600 + 9000 = 9600 kobo
		expect(result.totalCostKobo).toBe(9600);
		expect(result.canAfford).toBe(true);
		expect(result.shortfallKobo).toBe(0);
	});

	it("verifyDeposit rejects verification if transaction belongs to another user", async () => {
		const otherUserTx = {
			amountKobo: 500_000,
			id: "tx_attacker_target",
			reference: "dep_victim_ref",
			status: "pending",
			wallet: {
				balanceKobo: 0,
				id: "wallet_victim",
				userId: "victim_user_id", // Different user
			},
			walletId: "wallet_victim",
		};

		mockDb.transaction.findUnique.mockResolvedValue(otherUserTx);

		await expect(
			call(
				verifyDeposit,
				{ reference: "dep_victim_ref" },
				{ context: mockContext }
			)
		).rejects.toThrow(NOT_FOUND_REGEX);

		expect(verifyTransaction).not.toHaveBeenCalled();
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("checkCampaignCost accounts for held balance when evaluating affordability", async () => {
		// Total balance: 10,000 kobo, but 8,000 is held -> only 2,000 available
		(getOrCreateWallet as any).mockResolvedValue({
			balanceKobo: 10_000,
			createdAt: new Date(),
			heldKobo: 8000,
			id: "wallet_123",
			updatedAt: new Date(),
			userId: "user_test_billing",
		});

		// Cost: 600 + 9000 = 9600 kobo.
		// Since available = 2000, cannot afford (shortfall = 7600)
		const result = await call(
			checkCampaignCost,
			{
				contacts: [{ channel: "sms" }, { channel: "whatsapp" }],
				deliveryMode: "marketing",
			},
			{ context: mockContext }
		);

		expect(result.totalCostKobo).toBe(9600);
		expect(result.availableKobo).toBe(2000);
		expect(result.canAfford).toBe(false);
		expect(result.shortfallKobo).toBe(7600);
	});

	it("getTransactions identifies hold release transactions with isHoldRelease and neutral isCredit", async () => {
		mockDb.wallet.findUnique.mockResolvedValue({
			id: "wallet_123",
			userId: "user_test_billing",
		});

		mockDb.transaction.count.mockResolvedValue(1);
		mockDb.transaction.findMany.mockResolvedValue([
			{
				amountKobo: 5000,
				balanceAfterKobo: 100_000,
				campaignId: "camp_1",
				createdAt: new Date("2026-09-07T10:00:00Z"),
				description: "Hold release: Unused reserve for campaign camp_1",
				id: "tx_release",
				metadata: { isHoldRelease: true },
				reference: "rel_camp_1",
				status: "completed",
				type: "campaign_refund",
			},
		]);

		const result = await call(
			getTransactions,
			{ page: 1, pageSize: 20 },
			{ context: mockContext }
		);

		expect(result.transactions[0].isHoldRelease).toBe(true);
		expect(result.transactions[0].isCredit).toBe(false);
	});
});
