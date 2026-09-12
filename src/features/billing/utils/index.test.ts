import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTx } = vi.hoisted(() => {
	const tx = {
		$queryRaw: vi.fn(),
		transaction: {
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		wallet: {
			findUnique: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	};
	return { mockTx: tx };
});

vi.mock("#/db", () => ({
	prisma: {
		$queryRaw: vi.fn(),
		$transaction: vi.fn(async (callback) => callback(mockTx)),
		transaction: mockTx.transaction,
		wallet: mockTx.wallet,
	},
}));

import { prisma } from "#/db";
import { formatNaira, nairaToKobo, resolveMessageType } from "./format";
import { canAffordCampaign, creditWallet } from "./index";

const NAIRA_500_REGEX = /500\.00/;
const NAIRA_1_50_REGEX = /1\.50/;

describe("Billing Utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("formatNaira & nairaToKobo", () => {
		it("converts kobo to formatted currency string", () => {
			expect(formatNaira(50_000)).toMatch(NAIRA_500_REGEX);
			expect(formatNaira(150)).toMatch(NAIRA_1_50_REGEX);
		});

		it("converts naira to kobo integer", () => {
			expect(nairaToKobo(500)).toBe(50_000);
			expect(nairaToKobo(12.5)).toBe(1250);
		});
	});

	describe("resolveMessageType", () => {
		it("resolves channel and mode to correct message type", () => {
			expect(resolveMessageType("sms", "marketing")).toBe("sms");
			expect(resolveMessageType("whatsapp", "sms_fallback")).toBe("sms");
			expect(resolveMessageType("whatsapp", "utility_prescreen")).toBe(
				"whatsapp_utility"
			);
			expect(resolveMessageType("whatsapp", "marketing")).toBe(
				"whatsapp_marketing"
			);
		});
	});

	describe("canAffordCampaign", () => {
		it("deducts held funds from balance when calculating affordability", async () => {
			// Balance is 10,000 kobo, but 7,000 is held -> only 3,000 spendable
			(prisma.wallet.upsert as any).mockResolvedValue({
				balanceKobo: 10_000,
				heldKobo: 7000,
				id: "w_1",
				userId: "u_1",
			});

			// Cost is 2 x 600 (SMS) = 1200 kobo -> 3000 >= 1200 -> canAfford = true
			const result = await canAffordCampaign(
				"u_1",
				[{ channel: "sms" }, { channel: "sms" }],
				"marketing"
			);

			expect(result.availableKobo).toBe(3000);
			expect(result.balanceKobo).toBe(10_000);
			expect(result.heldKobo).toBe(7000);
			expect(result.totalCostKobo).toBe(1200);
			expect(result.canAfford).toBe(true);
			expect(result.shortfallKobo).toBe(0);
		});

		it("reports shortfall against available funds when held balance restricts spending", async () => {
			// Balance is 10,000 kobo, 9,500 held -> only 500 spendable
			(prisma.wallet.upsert as any).mockResolvedValue({
				balanceKobo: 10_000,
				heldKobo: 9500,
				id: "w_1",
				userId: "u_1",
			});

			// Cost is 1 SMS (600 kobo) -> 500 < 600 -> canAfford = false, shortfall = 100
			const result = await canAffordCampaign(
				"u_1",
				[{ channel: "sms" }],
				"marketing"
			);

			expect(result.availableKobo).toBe(500);
			expect(result.totalCostKobo).toBe(600);
			expect(result.canAfford).toBe(false);
			expect(result.shortfallKobo).toBe(100);
		});
	});

	describe("creditWallet security checks", () => {
		it("throws TRANSACTION_WALLET_MISMATCH if existing transaction belongs to a different wallet", async () => {
			(mockTx.wallet.upsert as any).mockResolvedValue({
				balanceKobo: 50_000,
				heldKobo: 0,
				id: "attacker_wallet",
				userId: "attacker_id",
			});

			// Existing transaction belongs to victim_wallet
			(mockTx.transaction.findUnique as any).mockResolvedValue({
				amountKobo: 100_000,
				id: "tx_victim",
				reference: "ref_stolen",
				status: "pending",
				walletId: "victim_wallet", // Mismatch!
			});

			await expect(
				creditWallet({
					amountKobo: 100_000,
					reference: "ref_stolen",
					userId: "attacker_id",
				})
			).rejects.toThrow("TRANSACTION_WALLET_MISMATCH");

			expect(mockTx.wallet.update).not.toHaveBeenCalled();
		});

		it("successfully credits wallet and updates existing pending transaction", async () => {
			(mockTx.wallet.upsert as any).mockResolvedValue({
				balanceKobo: 50_000,
				heldKobo: 0,
				id: "owner_wallet",
				userId: "owner_id",
			});

			(mockTx.transaction.findUnique as any).mockResolvedValue({
				amountKobo: 100_000,
				id: "tx_owner",
				reference: "ref_legit",
				status: "pending",
				walletId: "owner_wallet",
			});

			(mockTx.wallet.update as any).mockResolvedValue({
				balanceKobo: 150_000,
				heldKobo: 0,
				id: "owner_wallet",
				userId: "owner_id",
			});

			const wallet = await creditWallet({
				amountKobo: 100_000,
				reference: "ref_legit",
				userId: "owner_id",
			});

			expect(mockTx.wallet.update).toHaveBeenCalledWith({
				data: { balanceKobo: { increment: 100_000 } },
				where: { id: "owner_wallet" },
			});
			expect(mockTx.transaction.update).toHaveBeenCalledWith({
				data: expect.objectContaining({
					balanceAfterKobo: 150_000,
					status: "completed",
				}),
				where: { reference: "ref_legit" },
			});
			expect(wallet.balanceKobo).toBe(150_000);
		});
	});
});
