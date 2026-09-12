import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/db", () => ({
	prisma: {
		campaign: {
			findUnique: vi.fn(),
		},
		transaction: {
			aggregate: vi.fn(),
			findMany: vi.fn(),
		},
		wallet: {
			findMany: vi.fn(),
		},
	},
}));

vi.mock("#/features/billing/utils", () => ({
	releaseCampaignHold: vi.fn(),
}));

import { prisma } from "#/db";
import { releaseCampaignHold } from "#/features/billing/utils";
import { reconcileStaleCampaignHolds } from "./reconcile-holds";

describe("reconcileStaleCampaignHolds Inngest Function", () => {
	const mockStep = {
		run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 0 reconciled count when no wallets have active holds", async () => {
		(prisma.wallet.findMany as any).mockResolvedValue([]);

		// Extract handler from Inngest function definition
		const handler = (reconcileStaleCampaignHolds as any).fn;
		const result = await handler({ step: mockStep });

		expect(result).toEqual({ reconciledCount: 0 });
		expect(mockStep.run).toHaveBeenCalledWith(
			"fetch-wallets-with-holds",
			expect.any(Function)
		);
		expect(releaseCampaignHold).not.toHaveBeenCalled();
	});

	it("preserves holds for in-progress active campaigns", async () => {
		(prisma.wallet.findMany as any).mockResolvedValue([
			{ heldKobo: 50_000, id: "wallet_1", userId: "user_1" },
		]);

		(prisma.transaction.findMany as any).mockResolvedValue([
			{ campaignId: "active_campaign_1" },
		]);

		(prisma.campaign.findUnique as any).mockResolvedValue({
			status: "running", // In progress: active!
		});

		const handler = (reconcileStaleCampaignHolds as any).fn;
		const result = await handler({ step: mockStep });

		expect(result).toEqual({ reconciledCount: 0 });
		expect(releaseCampaignHold).not.toHaveBeenCalled();
	});

	it("releases stale holds when campaign reached terminal status or was deleted", async () => {
		(prisma.wallet.findMany as any).mockResolvedValue([
			{ heldKobo: 50_000, id: "wallet_1", userId: "user_1" },
		]);

		(prisma.transaction.findMany as any).mockResolvedValue([
			{ campaignId: "stale_completed_camp" },
			{ campaignId: "stale_missing_camp" },
		]);

		(prisma.campaign.findUnique as any)
			.mockResolvedValueOnce({ status: "completed" })
			.mockResolvedValueOnce(null); // Deleted campaign

		(prisma.transaction.aggregate as any).mockResolvedValue({
			_sum: { amountKobo: 12_000 },
		});

		(releaseCampaignHold as any).mockResolvedValue({
			heldKobo: 0,
			unspentReleasedKobo: 38_000,
		});

		const handler = (reconcileStaleCampaignHolds as any).fn;
		const result = await handler({ step: mockStep });

		expect(result).toEqual({ reconciledCount: 2 });
		expect(releaseCampaignHold).toHaveBeenCalledTimes(2);
		expect(releaseCampaignHold).toHaveBeenCalledWith(
			expect.objectContaining({
				campaignId: "stale_completed_camp",
				totalDebitedKobo: 12_000,
				userId: "user_1",
			})
		);
		expect(releaseCampaignHold).toHaveBeenCalledWith(
			expect.objectContaining({
				campaignId: "stale_missing_camp",
				totalDebitedKobo: 12_000,
				userId: "user_1",
			})
		);
	});
});
