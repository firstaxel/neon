/**
 * src/features/jobs/functions/reconcile-holds.ts
 *
 * Hourly cron job to sweep and reconcile stale campaign holds older than 24 hours.
 */
import { prisma } from "#/db";
import { releaseCampaignHold } from "#/features/billing/utils";
import { inngest } from "#/lib/inngest/client";

export const reconcileStaleCampaignHolds = inngest.createFunction(
	{
		id: "billing-reconcile-stale-holds",
		name: "Billing: Reconcile Stale Campaign Holds",
		triggers: [{ cron: "0 * * * *" }],
	},
	async ({ step }) => {
		const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

		// Find wallets that have a positive held balance
		const walletsWithHolds = await step.run(
			"fetch-wallets-with-holds",
			async () =>
				prisma.wallet.findMany({
					select: { heldKobo: true, id: true, userId: true },
					where: { heldKobo: { gt: 0 } },
				})
		);

		if (walletsWithHolds.length === 0) {
			return { reconciledCount: 0 };
		}

		let totalReconciled = 0;

		for (const wallet of walletsWithHolds) {
			// biome-ignore lint/performance/noAwaitInLoops: Inngest steps are executed sequentially per wallet
			const walletCount = await step.run(
				`reconcile-wallet-${wallet.id}`,
				async () => {
					// Find campaign holds older than 24 hours
					const staleHolds = await prisma.transaction.findMany({
						distinct: ["campaignId"],
						select: { campaignId: true },
						where: {
							campaignId: { not: null },
							createdAt: { lt: staleThreshold },
							type: "campaign_hold",
							walletId: wallet.id,
						},
					});

					const terminalStatuses = ["completed", "failed", "cancelled"];
					const validHolds = staleHolds.filter(
						(h): h is { campaignId: string } => Boolean(h.campaignId)
					);

					const results = await Promise.all(
						validHolds.map(async (hold) => {
							const campaign = await prisma.campaign.findUnique({
								select: { status: true },
								where: { id: hold.campaignId },
							});

							const isStalled =
								!campaign || terminalStatuses.includes(campaign.status);

							if (!isStalled) {
								return 0;
							}

							const debits = await prisma.transaction.aggregate({
								_sum: { amountKobo: true },
								where: {
									campaignId: hold.campaignId,
									type: "message_debit",
									walletId: wallet.id,
								},
							});

							const totalDebitedKobo = debits._sum.amountKobo ?? 0;
							await releaseCampaignHold({
								campaignId: hold.campaignId,
								reason: `Automated cleanup of stale campaign hold (status: ${campaign?.status ?? "not_found"})`,
								totalDebitedKobo,
								userId: wallet.userId,
							});
							return 1;
						})
					);

					return results.reduce<number>((sum, count) => sum + count, 0);
				}
			);

			totalReconciled += walletCount;
		}

		return { reconciledCount: totalReconciled };
	}
);
