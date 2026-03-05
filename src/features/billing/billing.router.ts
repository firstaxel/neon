/**
 * src/orpc/billing.router.ts
 * All procedures use `protectedProcedure` — userId always from context.session.user.id
 */

import { ORPCError } from "@orpc/client";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
	canAffordCampaign,
	creditWallet,
	formatNaira,
	getOrCreateWallet,
	nairaToKobo,
	type PlanKey,
	PRICING,
} from "#/features/billing/utils";
import {
	initializeDeposit,
	cancelSubscription as paystackCancelSub,
	verifyTransaction,
} from "#/features/payment/paystack";
import { protectedProcedure } from "#/orpc";

// ── Wallet ────────────────────────────────────────────────────────────────────
export const getWallet = protectedProcedure.handler(async ({ context }) => {
	const wallet = await getOrCreateWallet(context.session.user.id);
	return {
		balanceKobo: wallet.balanceKobo,
		heldKobo: wallet.heldKobo,
		availableKobo: Math.max(0, wallet.balanceKobo - wallet.heldKobo),
		balanceFormatted: formatNaira(wallet.balanceKobo),
		availableFormatted: formatNaira(
			Math.max(0, wallet.balanceKobo - wallet.heldKobo)
		),
	};
});

// ── Deposit ───────────────────────────────────────────────────────────────────
export const initDeposit = protectedProcedure
	.input(
		z.object({
			amountNaira: z.number().int().min(100).max(1_000_000),
			callbackUrl: z.url(),
		})
	)
	.handler(async ({ input, context }) => {
		const { id: userId, email: userEmail } = context.session.user;
		const amountKobo = nairaToKobo(input.amountNaira);
		const reference = `dep_${uuidv4()}`;
		const wallet = await getOrCreateWallet(userId);

		await context.db.transaction.create({
			data: {
				walletId: wallet.id,
				type: "deposit",
				status: "pending",
				amountKobo,
				balanceAfterKobo: wallet.balanceKobo,
				description: `Wallet top-up of ${formatNaira(amountKobo)}`,
				reference,
			},
		});

		const result = await initializeDeposit(
			userEmail,
			amountKobo,
			reference,
			input.callbackUrl
		);
		return {
			checkoutUrl: result.authorization_url,
			reference: result.reference,
			amountKobo,
		};
	});

export const verifyDeposit = protectedProcedure
	.input(z.object({ reference: z.string() }))
	.handler(async ({ input, context }) => {
		const existing = await context.db.transaction.findUnique({
			where: { reference: input.reference },
		});
		if (!existing) {
			throw new ORPCError("Transaction not found");
		}
		if (existing.status === "completed") {
			return { alreadyProcessed: true, amountKobo: existing.amountKobo };
		}

		const result = await verifyTransaction(input.reference);
		if (result.status !== "success") {
			await context.db.transaction.update({
				where: { reference: input.reference },
				data: { status: "failed" },
			});
			throw new ORPCError(`Payment ${result.status} — please try again`);
		}

		const wallet = await creditWallet({
			userId: context.session.user.id,
			amountKobo: result.amount,
			description: `Wallet top-up of ${formatNaira(result.amount)}`,
			reference: `${input.reference}_credit`,
			paystackRef: input.reference,
			type: "deposit",
		});
		await context.db.transaction.update({
			where: { reference: input.reference },
			data: { status: "completed", paystackRef: input.reference },
		});

		return {
			alreadyProcessed: false,
			amountKobo: result.amount,
			newBalanceKobo: wallet.balanceKobo,
			newBalanceFormatted: formatNaira(wallet.balanceKobo),
		};
	});

// ── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = protectedProcedure
	.input(
		z.object({
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(50).default(20),
			type: z
				.enum([
					"deposit",
					"message_debit",
					"subscription",
					"campaign_refund",
					"refund",
				])
				.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const wallet = await context.db.wallet.findUnique({
			where: { userId: context.session.user.id },
		});
		if (!wallet) {
			return {
				transactions: [],
				pagination: {
					total: 0,
					page: 1,
					pageSize: input.pageSize,
					totalPages: 0,
				},
			};
		}

		const where = {
			walletId: wallet.id,
			...(input.type && { type: input.type }),
		};
		const [total, rows] = await Promise.all([
			context.db.transaction.count({ where }),
			context.db.transaction.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
			}),
		]);

		return {
			transactions: rows.map((t) => ({
				id: t.id,
				type: t.type,
				status: t.status,
				amountKobo: t.amountKobo,
				amountFormatted: formatNaira(t.amountKobo),
				balanceAfterKobo: t.balanceAfterKobo,
				balanceAfterFormatted: formatNaira(t.balanceAfterKobo),
				description: t.description,
				reference: t.reference,
				campaignId: t.campaignId,
				createdAt: t.createdAt.toISOString(),
				isCredit: ["deposit", "campaign_refund", "refund"].includes(t.type),
			})),
			pagination: {
				total,
				page: input.page,
				pageSize: input.pageSize,
				totalPages: Math.ceil(total / input.pageSize),
			},
		};
	});

// ── Campaign cost check ───────────────────────────────────────────────────────
export const checkCampaignCost = protectedProcedure
	.input(
		z.object({
			contacts: z.array(z.object({ channel: z.enum(["whatsapp", "sms"]) })),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
		})
	)
	.handler(async ({ input, context }) => {
		const result = await canAffordCampaign(
			context.session.user.id,
			input.contacts,
			input.deliveryMode
		);

		// For utility_prescreen: also expose the worst-case full cost (if every contact
		// replies YES and gets the real message billed at whatsapp_service rate).
		// This lets the wizard show a cost range: "from ₦X up to ₦Y".
		let prescreenFullCostKobo: number | null = null;
		if (input.deliveryMode === "utility_prescreen") {
			const consentCost = result.totalCostKobo; // already computed as utility rate
			const replyAllCost =
				input.contacts.filter((c) => c.channel === "whatsapp").length *
				PRICING.PER_MESSAGE.whatsapp_service;
			const smsCost =
				input.contacts.filter((c) => c.channel === "sms").length *
				PRICING.PER_MESSAGE.sms;
			prescreenFullCostKobo = consentCost + replyAllCost + smsCost;
		}

		return {
			...result,
			totalCostFormatted: formatNaira(result.totalCostKobo),
			shortfallFormatted:
				result.shortfallKobo > 0 ? formatNaira(result.shortfallKobo) : null,
			balanceFormatted: formatNaira(result.balanceKobo),
			deliveryMode: input.deliveryMode,
			rates: {
				whatsappMarketing: formatNaira(PRICING.PER_MESSAGE.whatsapp_marketing),
				whatsappUtility: formatNaira(PRICING.PER_MESSAGE.whatsapp_utility),
				whatsappService: formatNaira(PRICING.PER_MESSAGE.whatsapp_service),
				sms: formatNaira(PRICING.PER_MESSAGE.sms),
			},
			// Only populated for utility_prescreen: worst-case if all contacts reply YES
			prescreenConsentCostFormatted:
				input.deliveryMode === "utility_prescreen"
					? formatNaira(result.totalCostKobo)
					: null,
			prescreenFullCostFormatted:
				prescreenFullCostKobo !== null
					? formatNaira(prescreenFullCostKobo)
					: null,
		};
	});

// ── Subscription ──────────────────────────────────────────────────────────────
export const getSubscription = protectedProcedure.handler(
	async ({ context }) => {
		const sub = await context.db.subscription.findUnique({
			where: { userId: context.session.user.id },
		});
		const plans = Object.entries(PRICING.PLANS).map(([key, p]) => ({
			key,
			label: p.label,
			priceKobo: p.priceKobo,
			priceFormatted: formatNaira(p.priceKobo),
			monthlyLimit:
				p.monthlyLimit === 999_999
					? "Unlimited"
					: p.monthlyLimit.toLocaleString(),
			paystackPlanCode: p.paystackPlanCode,
		}));
		if (!sub) {
			return { subscription: null, plans };
		}
		return {
			subscription: {
				id: sub.id,
				plan: sub.plan,
				status: sub.status,
				monthlyMessageLimit: sub.monthlyMessageLimit,
				messagesUsedThisCycle: sub.messagesUsedThisCycle,
				currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
				paystackSubCode: sub.paystackSubCode,
				remainingMessages: Math.max(
					0,
					sub.monthlyMessageLimit - sub.messagesUsedThisCycle
				),
				usagePercent:
					sub.monthlyMessageLimit === 999_999
						? 0
						: Math.round(
								(sub.messagesUsedThisCycle / sub.monthlyMessageLimit) * 100
							),
			},
			plans,
		};
	}
);

export const initSubscription = protectedProcedure
	.input(
		z.object({
			plan: z.enum(["starter", "growth", "pro"]),
			callbackUrl: z.string().url(),
		})
	)
	.handler(async ({ input, context }) => {
		const planConfig = PRICING.PLANS[input.plan as PlanKey];
		const reference = `sub_${input.plan}_${uuidv4()}`;
		const result = await initializeDeposit(
			context.session.user.email,
			5000,
			reference,
			input.callbackUrl
		);
		const wallet = await getOrCreateWallet(context.session.user.id);
		await context.db.transaction.create({
			data: {
				walletId: wallet.id,
				type: "subscription",
				status: "pending",
				amountKobo: planConfig.priceKobo,
				balanceAfterKobo: 0,
				description: `Subscription to ${planConfig.label} plan`,
				reference,
			},
		});
		return {
			checkoutUrl: result.authorization_url,
			reference,
			plan: input.plan,
			planLabel: planConfig.label,
			priceFormatted: formatNaira(planConfig.priceKobo),
		};
	});

export const cancelSubscription = protectedProcedure.handler(
	async ({ context }) => {
		const sub = await context.db.subscription.findUnique({
			where: { userId: context.session.user.id },
		});
		if (!sub) {
			throw new ORPCError("No active subscription found");
		}
		if (sub.status === "cancelled") {
			throw new ORPCError("Subscription already cancelled");
		}
		if (sub.paystackSubCode) {
			try {
				await paystackCancelSub(
					sub.paystackSubCode,
					sub.paystackCustomerCode ?? ""
				);
			} catch {
				/* continue */
			}
		}
		const updated = await context.db.subscription.update({
			where: { userId: context.session.user.id },
			data: { status: "cancelled", cancelledAt: new Date() },
		});
		return {
			cancelled: true,
			currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
			message: `Your ${sub.plan} plan remains active until ${updated.currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
		};
	}
);
