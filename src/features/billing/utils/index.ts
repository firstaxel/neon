/**
 * src/features/billing/utils/index.ts
 *
 * Core billing helpers used by oRPC procedures and Inngest workers.
 *
 * Rules:
 *  - All amounts stored and passed as kobo (integer). ₦1 = 100 kobo.
 *  - The wallet has two values:
 *      balanceKobo: spendable funds
 *      heldKobo: reserved for in-flight campaigns (not spendable)
 *  - Every financial event creates an immutable Transaction row.
 *  - We never update balance without row level locking and writing a Transaction.
 */

import { prisma } from "#/db";
import type { Prisma } from "#/generated/prisma/client";

// ─── Format helpers & pricing ─────────────────────────────────────────────────
import { type MessageType, PRICING, resolveMessageType } from "./format";

// ─── Core Wallet Operations ───────────────────────────────────────────────────

/**
 * Ensure a wallet exists for a user and return it.
 */
export async function getOrCreateWallet(userId: string) {
	return await prisma.wallet.upsert({
		create: {
			balanceKobo: 0,
			heldKobo: 0,
			userId,
		},
		update: {},
		where: { userId },
	});
}

/**
 * Credit a user wallet atomically and append an immutable transaction row.
 * Uses SELECT FOR UPDATE on the wallet record to serialize concurrent updates.
 */
export async function creditWallet({
	userId,
	amountKobo,
	type = "deposit",
	reference,
	paystackRef,
	description,
	metadata,
}: {
	userId: string;
	amountKobo: number;
	type?: "deposit" | "refund" | "campaign_refund";
	reference: string;
	paystackRef?: string;
	description?: string;
	metadata?: Record<string, unknown> | Prisma.InputJsonValue;
}) {
	return await prisma.$transaction(async (tx) => {
		// Row level write lock
		const wallet = await tx.wallet.upsert({
			create: { balanceKobo: 0, heldKobo: 0, userId },
			update: {},
			where: { userId },
		});

		await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${wallet.id} FOR UPDATE`;

		// Check if transaction with this reference already exists
		const existingTx = await tx.transaction.findUnique({
			where: { reference },
		});

		if (existingTx) {
			if (existingTx.walletId !== wallet.id) {
				throw new Error("TRANSACTION_WALLET_MISMATCH");
			}
			if (existingTx.status === "completed") {
				return wallet;
			}
		}

		// Increment wallet balance
		const updatedWallet = await tx.wallet.update({
			data: { balanceKobo: { increment: amountKobo } },
			where: { id: wallet.id },
		});

		const txDescription =
			description ??
			(type === "deposit" ? "Deposit to wallet" : "Wallet transaction");

		if (existingTx) {
			await tx.transaction.update({
				data: {
					balanceAfterKobo: updatedWallet.balanceKobo,
					...(metadata !== undefined && {
						metadata: metadata as Prisma.InputJsonValue,
					}),
					...(paystackRef && { paystackRef }),
					status: "completed",
				},
				where: { reference },
			});
		} else {
			await tx.transaction.create({
				data: {
					amountKobo,
					balanceAfterKobo: updatedWallet.balanceKobo,
					description: txDescription,
					...(metadata !== undefined && {
						metadata: metadata as Prisma.InputJsonValue,
					}),
					...(paystackRef && { paystackRef }),
					reference,
					status: "completed",
					type,
					walletId: wallet.id,
				},
			});
		}

		return updatedWallet;
	});
}

/**
 * Reserve wallet balance for an in flight broadcast campaign.
 */
export async function holdCampaignFunds({
	userId,
	campaignId,
	amountKobo,
	description,
}: {
	userId: string;
	campaignId: string;
	amountKobo: number;
	description?: string;
}): Promise<{
	balanceKobo: number;
	heldKobo: number;
	holdReference: string;
	success: boolean;
}> {
	return await prisma.$transaction(async (tx) => {
		const wallet = await tx.wallet.findUnique({ where: { userId } });
		if (!wallet) {
			throw new Error("WALLET_NOT_FOUND");
		}

		// Row level write lock
		await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${wallet.id} FOR UPDATE`;

		const availableKobo = wallet.balanceKobo - wallet.heldKobo;
		if (availableKobo < amountKobo) {
			throw new Error("INSUFFICIENT_BALANCE");
		}

		const updatedWallet = await tx.wallet.update({
			data: { heldKobo: { increment: amountKobo } },
			where: { id: wallet.id },
		});

		const holdReference = `hold_${campaignId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		await tx.transaction.create({
			data: {
				amountKobo,
				balanceAfterKobo: updatedWallet.balanceKobo,
				campaignId,
				description: description ?? `Hold for campaign ${campaignId}`,
				reference: holdReference,
				status: "completed",
				type: "campaign_hold",
				walletId: wallet.id,
			},
		});

		return {
			balanceKobo: updatedWallet.balanceKobo,
			heldKobo: updatedWallet.heldKobo,
			holdReference,
			success: true,
		};
	});
}

/**
 * Debit a wallet for a completed broadcast campaign.
 * Decrements held balance, debits actual message cost from balance, and logs transactions.
 */
export async function commitCampaignDeduction({
	userId,
	campaignId,
	actualCostKobo,
	description,
}: {
	userId: string;
	campaignId: string;
	actualCostKobo: number;
	description?: string;
}): Promise<{ balanceKobo: number; heldKobo: number; success: boolean }> {
	return await prisma.$transaction(async (tx) => {
		const wallet = await tx.wallet.findUnique({ where: { userId } });
		if (!wallet) {
			throw new Error("WALLET_NOT_FOUND");
		}

		// Row level write lock
		await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${wallet.id} FOR UPDATE`;

		// Find original hold amount for this campaign
		const holdTx = await tx.transaction.findFirst({
			orderBy: { createdAt: "desc" },
			where: {
				campaignId,
				type: "campaign_hold",
				walletId: wallet.id,
			},
		});

		const originalHoldKobo = holdTx?.amountKobo ?? actualCostKobo;
		const unusedHoldKobo = Math.max(0, originalHoldKobo - actualCostKobo);

		// Decrement hold by original hold amount, decrement balance by actual cost
		const updatedWallet = await tx.wallet.update({
			data: {
				balanceKobo: { decrement: actualCostKobo },
				heldKobo: { decrement: originalHoldKobo },
			},
			where: { id: wallet.id },
		});

		// Record the debit transaction
		await tx.transaction.create({
			data: {
				amountKobo: actualCostKobo,
				balanceAfterKobo: updatedWallet.balanceKobo,
				campaignId,
				description:
					description ?? `Debit for campaign ${campaignId} broadcast`,
				reference: `deb_${campaignId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				status: "completed",
				type: "message_debit",
				walletId: wallet.id,
			},
		});

		// If there was an unspent hold portion, record the release
		if (unusedHoldKobo > 0) {
			await tx.transaction.create({
				data: {
					amountKobo: unusedHoldKobo,
					balanceAfterKobo: updatedWallet.balanceKobo,
					campaignId,
					description: `Hold release: Unused reserve for campaign ${campaignId}`,
					metadata: {
						isHoldRelease: true,
						unspentReleasedKobo: unusedHoldKobo,
					},
					reference: `rel_${campaignId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					status: "completed",
					type: "campaign_refund",
					walletId: wallet.id,
				},
			});
		}

		return {
			balanceKobo: updatedWallet.balanceKobo,
			heldKobo: updatedWallet.heldKobo,
			success: true,
		};
	});
}

/**
 * Release any remaining held balance for a campaign (e.g. on failure, cancellation, or partial delivery).
 */
export async function releaseCampaignHold({
	userId,
	campaignId,
	totalDebitedKobo = 0,
	reason,
}: {
	userId: string;
	campaignId: string;
	totalDebitedKobo?: number;
	reason?: string;
}): Promise<{ heldKobo: number; unspentReleasedKobo: number }> {
	return await prisma.$transaction(async (tx) => {
		const wallet = await tx.wallet.findUnique({ where: { userId } });
		if (!wallet) {
			throw new Error("WALLET_NOT_FOUND");
		}

		// Row level write lock
		await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${wallet.id} FOR UPDATE`;

		// Find total held for this campaign
		const holds = await tx.transaction.findMany({
			where: {
				campaignId,
				type: "campaign_hold",
				walletId: wallet.id,
			},
		});

		const totalHeldKobo = holds.reduce((sum, h) => sum + h.amountKobo, 0);

		// Find any already released amounts
		const existingReleases = await tx.transaction.findMany({
			where: {
				campaignId,
				type: "campaign_refund",
				walletId: wallet.id,
			},
		});
		const alreadyRefundedKobo = existingReleases.reduce(
			(sum, r) => sum + r.amountKobo,
			0
		);

		const remainingToClear = Math.max(
			0,
			totalHeldKobo - totalDebitedKobo - alreadyRefundedKobo
		);
		const amountToDecrementHeld = Math.min(wallet.heldKobo, remainingToClear);

		const updatedWallet = await tx.wallet.update({
			data: { heldKobo: { decrement: amountToDecrementHeld } },
			where: { id: wallet.id },
		});

		if (remainingToClear > 0) {
			await tx.transaction.create({
				data: {
					amountKobo: remainingToClear,
					balanceAfterKobo: updatedWallet.balanceKobo,
					campaignId,
					description: `Hold release: ${reason ?? "Campaign completed"}`,
					metadata: {
						isHoldRelease: true,
						unspentReleasedKobo: remainingToClear,
					},
					reference: `rel_${campaignId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					status: "completed",
					type: "campaign_refund",
					walletId: wallet.id,
				},
			});
		}

		return {
			heldKobo: updatedWallet.heldKobo,
			unspentReleasedKobo: remainingToClear,
		};
	});
}

/**
 * Debit a wallet for a single sent message.
 */
export async function debitForMessage({
	userId,
	messageType,
	campaignId,
	messageId,
}: {
	userId: string;
	messageType: MessageType;
	campaignId?: string;
	messageId: string;
}): Promise<{ balanceKobo: number; success: boolean }> {
	const cost = PRICING.PER_MESSAGE[messageType];

	try {
		const wallet = await prisma.$transaction(async (tx) => {
			const w = await tx.wallet.findUniqueOrThrow({ where: { userId } });

			// Row level write lock
			await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${w.id} FOR UPDATE`;

			if (w.balanceKobo < cost) {
				throw new Error("INSUFFICIENT_BALANCE");
			}

			const updated = await tx.wallet.update({
				data: { balanceKobo: { decrement: cost } },
				where: { id: w.id },
			});

			await tx.transaction.create({
				data: {
					amountKobo: cost,
					balanceAfterKobo: updated.balanceKobo,
					campaignId,
					description: `Message: ${messageType.replace(/_/g, " ")} (${messageId})`,
					reference: `msg_${messageId}`,
					status: "completed",
					type: "message_debit",
					walletId: w.id,
				},
			});

			return updated;
		});

		return { balanceKobo: wallet.balanceKobo, success: true };
	} catch {
		return { balanceKobo: 0, success: false };
	}
}

/**
 * Refund a failed message delivery back to the user's wallet.
 */
export async function refundFailedMessage({
	userId,
	messageType,
	campaignId,
	messageId,
	reason = "delivery_failed",
}: {
	userId: string;
	messageType: MessageType;
	campaignId?: string;
	messageId: string;
	reason?: string;
}): Promise<void> {
	const amountKobo = PRICING.PER_MESSAGE[messageType];
	if (amountKobo === 0) {
		return;
	}

	await creditWallet({
		amountKobo,
		description: `Refund: ${messageType.replace(/_/g, " ")} message not delivered (${reason})`,
		metadata: campaignId ? { campaignId, messageId } : { messageId },
		reference: `refund_${messageId}`,
		type: "campaign_refund",
		userId,
	});
}

/** Backward compatibility alias for message refund */
export const refundForMessage = refundFailedMessage;

/**
 * Pre-flight cost check before a campaign is queued.
 * Evaluates affordability against spendable available funds (balance minus held).
 */
export async function canAffordCampaign(
	userId: string,
	contacts: Array<{ channel: "whatsapp" | "sms" }>,
	deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback" = "marketing"
): Promise<{
	availableKobo: number;
	balanceKobo: number;
	canAfford: boolean;
	heldKobo: number;
	shortfallKobo: number;
	totalCostKobo: number;
}> {
	const totalCostKobo = contacts.reduce((sum, c) => {
		const type = resolveMessageType(c.channel, deliveryMode);
		return sum + PRICING.PER_MESSAGE[type];
	}, 0);

	const wallet = await getOrCreateWallet(userId);
	const availableKobo = Math.max(0, wallet.balanceKobo - wallet.heldKobo);
	const canAfford = availableKobo >= totalCostKobo;

	return {
		availableKobo,
		balanceKobo: wallet.balanceKobo,
		canAfford,
		heldKobo: wallet.heldKobo,
		shortfallKobo: canAfford ? 0 : totalCostKobo - availableKobo,
		totalCostKobo,
	};
}
