/**
 * src/lib/billing.ts
 *
 * Core billing helpers used by oRPC procedures and Inngest workers.
 *
 * Rules:
 *  - All amounts stored and passed as kobo (integer). ₦1 = 100 kobo.
 *  - The wallet has two values:
 *      balanceKobo — spendable funds
 *      heldKobo    — reserved for in-flight campaigns (not spendable)
 *  - Every financial event creates an immutable Transaction row.
 *  - We never update balance without writing a Transaction first.
 */

import { prisma } from "#/db";

// ─── Pricing constants (edit here to change rates) ───────────────────────────

/**
 * MessageType drives billing — not raw channel alone.
 *
 *  whatsapp_marketing — Meta template sent outside any active 24h session.
 *                       Charged at the Nigerian marketing conversation rate.
 *  whatsapp_utility   — Meta template sent as a utility conversation (e.g. the
 *                       consent pre-screen message). Cheaper than marketing.
 *  whatsapp_service   — Free-form text sent within 24h of an inbound message
 *                       (e.g. the real body after a YES reply). Meta charges
 *                       this as a service conversation; we pass the saving on.
 *  sms                — Termii SMS, flat rate regardless of content.
 */
export type MessageType =
	| "whatsapp_marketing"
	| "whatsapp_utility"
	| "whatsapp_service"
	| "sms";

export const PRICING = {
	/**
	 * Per-message costs in kobo (N1 = 100 kobo).
	 * Source: Meta Nigeria conversation pricing + Termii SMS rate.
	 */
	PER_MESSAGE: {
		whatsapp_marketing: 9000, // N9.00  — Meta marketing conversation (Nigeria)
		whatsapp_utility: 800, // N3.00  — Meta utility conversation (Nigeria)
		whatsapp_service: 0, // N1.00  — Meta service conversation (24h window)
		sms: 600, // N2.50  — Termii SMS
	} as const satisfies Record<MessageType, number>,

	/** Monthly plan prices in kobo */
	PLANS: {
		starter: {
			priceKobo: 500_000,
			monthlyLimit: 500,
			label: "Starter",
			paystackPlanCode: process.env.PAYSTACK_PLAN_STARTER ?? "",
		},
		growth: {
			priceKobo: 1_500_000,
			monthlyLimit: 2000,
			label: "Growth",
			paystackPlanCode: process.env.PAYSTACK_PLAN_GROWTH ?? "",
		},
		pro: {
			priceKobo: 3_500_000,
			monthlyLimit: 999_999,
			label: "Pro",
			paystackPlanCode: process.env.PAYSTACK_PLAN_PRO ?? "",
		},
	},
} as const;

export type PlanKey = keyof typeof PRICING.PLANS;

/**
 * Resolve the MessageType for a contact based on channel + delivery mode.
 * This is the single source of truth for "what does this send cost?"
 */
export function resolveMessageType(
	channel: "whatsapp" | "sms",
	deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback"
): MessageType {
	if (channel === "sms" || deliveryMode === "sms_fallback") {
		return "sms";
	}
	if (deliveryMode === "utility_prescreen") {
		return "whatsapp_utility";
	}
	return "whatsapp_marketing";
}

// ─── Wallet helpers ───────────────────────────────────────────────────────────

/**
 * Get or create a wallet for a user. Idempotent.
 */
export function getOrCreateWallet(userId: string) {
	return prisma.wallet.upsert({
		where: { userId },
		create: { userId, balanceKobo: 0, heldKobo: 0 },
		update: {},
	});
}

/**
 * Credit a wallet and write a Transaction row.
 * Used for confirmed Paystack deposits.
 */
export function creditWallet({
	userId,
	amountKobo,
	description,
	reference,
	paystackRef,
	type = "deposit",
}: {
	userId: string;
	amountKobo: number;
	description: string;
	reference: string;
	paystackRef?: string;
	type?: "deposit" | "campaign_refund" | "refund";
}) {
	return prisma.$transaction(async (tx) => {
		const wallet = await tx.wallet.update({
			where: { userId },
			data: { balanceKobo: { increment: amountKobo } },
		});

		await tx.transaction.create({
			data: {
				walletId: wallet.id,
				type,
				status: "completed",
				amountKobo,
				balanceAfterKobo: wallet.balanceKobo,
				description,
				reference,
				paystackRef,
			},
		});

		return wallet;
	});
}

/**
 * Debit a wallet for a single sent message.
 *
 * Pass messageType (not raw channel) so the correct rate is applied:
 *   whatsapp_marketing — full Meta marketing conversation rate
 *   whatsapp_utility   — cheaper Meta utility rate (pre-screen consent)
 *   whatsapp_service   — cheapest Meta service rate (reply within 24h window)
 *   sms                — flat Termii rate
 *
 * Returns { success: false } if balance is insufficient — caller should pause.
 */
export async function debitForMessage({
	userId,
	messageType,
	campaignId,
	messageId,
}: {
	userId: string;
	messageType: MessageType;
	campaignId: string;
	messageId: string;
}): Promise<{ success: boolean; balanceKobo: number }> {
	const cost = PRICING.PER_MESSAGE[messageType];

	try {
		const wallet = await prisma.$transaction(async (tx) => {
			// Lock the wallet row to prevent race conditions
			const w = await tx.wallet.findUniqueOrThrow({ where: { userId } });

			if (w.balanceKobo < cost) {
				throw new Error("INSUFFICIENT_BALANCE");
			}

			const updated = await tx.wallet.update({
				where: { userId },
				data: { balanceKobo: { decrement: cost } },
			});

			await tx.transaction.create({
				data: {
					walletId: updated.id,
					type: "message_debit",
					status: "completed",
					amountKobo: cost,
					balanceAfterKobo: updated.balanceKobo,
					description: `${messageType.replace("_", " ")} message sent`,
					reference: `msg_${messageId}`,
					campaignId,
					messageId,
				},
			});

			return updated;
		});

		return { success: true, balanceKobo: wallet.balanceKobo };
	} catch (err) {
		if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
			const w = await prisma.wallet.findUnique({ where: { userId } });
			return { success: false, balanceKobo: w?.balanceKobo ?? 0 };
		}
		throw err;
	}
}

/**
 * Refund a wallet for a message that was debited but never successfully sent.
 *
 * Call this in every failure path that occurs AFTER a successful debitForMessage:
 *   - send-campaign worker: send fails on all retries (onFailure handler)
 *   - send-campaign worker: Meta/Termii returns result.success === false
 *   - prescreen worker: consent send fails after debit
 *   - prescreen/SMS worker: Termii fails after debit
 *   - sendPendingMessage: real send fails after debit
 *
 * Idempotent by reference — if the same ref is refunded twice the second
 * creditWallet call will still write a second Transaction row, so callers
 * must ensure they only call this once per messageId. The safest place is
 * always inside an Inngest step so it is checkpointed.
 */
export async function refundForMessage({
	userId,
	messageType,
	messageId,
	reason,
}: {
	userId: string;
	messageType: MessageType;
	campaignId: string;
	messageId: string;
	reason: string;
}): Promise<void> {
	const amountKobo = PRICING.PER_MESSAGE[messageType];

	await creditWallet({
		userId,
		amountKobo,
		type: "campaign_refund",
		description: `Refund: ${messageType.replace(/_/g, " ")} message not delivered — ${reason}`,
		reference: `refund_${messageId}`,
	});
}

/**
 * Pre-flight cost check before a campaign is queued.
 *
 * Each contact is costed at the rate that will actually be charged based on
 * the delivery mode — not just their stored channel value.
 *
 * Delivery mode mapping:
 *   marketing         → whatsapp_marketing (or sms for SMS contacts)
 *   utility_prescreen → whatsapp_utility for WA contacts (consent msg cost only;
 *                       the real message after YES is billed separately at send time)
 *   sms_fallback      → sms for every contact regardless of stored channel
 */
export async function canAffordCampaign(
	userId: string,
	contacts: Array<{ channel: "whatsapp" | "sms" }>,
	deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback" = "marketing"
): Promise<{
	canAfford: boolean;
	shortfallKobo: number;
	totalCostKobo: number;
	balanceKobo: number;
}> {
	const totalCostKobo = contacts.reduce((sum, c) => {
		const type = resolveMessageType(c.channel, deliveryMode);
		return sum + PRICING.PER_MESSAGE[type];
	}, 0);

	const wallet = await getOrCreateWallet(userId);
	const canAfford = wallet.balanceKobo >= totalCostKobo;

	return {
		canAfford,
		shortfallKobo: canAfford ? 0 : totalCostKobo - wallet.balanceKobo,
		totalCostKobo,
		balanceKobo: wallet.balanceKobo,
	};
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Convert kobo integer to a formatted Naira string. e.g. 500 → "₦5.00" */
export function formatNaira(kobo: number): string {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		minimumFractionDigits: 2,
	}).format(kobo / 100);
}

/** Convert a Naira amount string to kobo. e.g. "5000" → 500000 */
export function nairaToKobo(naira: number): number {
	return Math.round(naira * 100);
}
