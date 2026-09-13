/**
 * src/features/billing/billing.router.ts
 *
 * All procedures use `protectedProcedure`: userId always from context.session.user.id
 */

import { ORPCError } from "@orpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { creditWallet, getOrCreateWallet } from "#/features/billing/utils";
import {
	formatNaira,
	nairaToKobo,
	PRICING,
	resolveMessageType,
} from "#/features/billing/utils/format";
import {
	initializeDeposit,
	verifyTransaction,
} from "#/features/payment/paystack";
import { calculatePaystackFee } from "#/features/payment/paystack/fee";
import { invalidate, withCache } from "#/lib/cache";
import { protectedProcedure } from "#/orpc";

// ── Wallet ────────────────────────────────────────────────────────────────────
export const getWallet = protectedProcedure.handler(
	withCache("billing.getWallet", 20_000, async ({ context }) => {
		const wallet = await getOrCreateWallet(context.session?.user.id ?? "");
		return {
			availableFormatted: formatNaira(
				Math.max(0, wallet.balanceKobo - wallet.heldKobo)
			),
			availableKobo: Math.max(0, wallet.balanceKobo - wallet.heldKobo),
			balanceFormatted: formatNaira(wallet.balanceKobo),
			balanceKobo: wallet.balanceKobo,
			heldKobo: wallet.heldKobo,
		};
	})
);

// ── Deposit ───────────────────────────────────────────────────────────────────
export const initDeposit = protectedProcedure
	.input(
		z.object({
			amountNaira: z.number().int().min(500).max(5_000_000),
			callbackUrl: z.string().url(),
		})
	)
	.handler(async ({ input, context }) => {
		const { id: userId, email: userEmail } = context.session.user;
		const amountKobo = nairaToKobo(input.amountNaira);
		const feeKobo = calculatePaystackFee(amountKobo);
		const grossKobo = amountKobo + feeKobo;
		const reference = `dep_${uuidv4()}`;
		const wallet = await getOrCreateWallet(userId);

		await context.db.transaction.create({
			data: {
				amountKobo,
				balanceAfterKobo: wallet.balanceKobo,
				description: `Wallet top up of ${formatNaira(amountKobo)}`,
				metadata: {
					feeKobo,
					grossKobo,
					netKobo: amountKobo,
					type: "wallet_deposit",
				},
				reference,
				status: "pending",
				type: "deposit",
				walletId: wallet.id,
			},
		});

		const result = await initializeDeposit({
			callbackUrl: input.callbackUrl,
			email: userEmail,
			feeKobo,
			netAmountKobo: amountKobo,
			reference,
		});

		return {
			amountKobo,
			checkoutUrl: result.authorization_url,
			feeKobo,
			grossKobo,
			reference: result.reference,
		};
	});

export const verifyDeposit = protectedProcedure
	.input(z.object({ reference: z.string() }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const existing = await context.db.transaction.findUnique({
			include: { wallet: true },
			where: { reference: input.reference },
		});
		if (!existing || existing.wallet.userId !== userId) {
			throw new ORPCError("NOT_FOUND", {
				message: "Transaction not found",
			});
		}

		if (existing.status === "completed") {
			const wallet = await getOrCreateWallet(userId);
			return {
				alreadyProcessed: true,
				amountKobo: existing.amountKobo,
				newBalanceFormatted: formatNaira(wallet.balanceKobo),
				newBalanceKobo: wallet.balanceKobo,
			};
		}

		const result = await verifyTransaction(input.reference);
		if (result.status !== "success") {
			await context.db.transaction.update({
				data: { status: "failed" },
				where: { reference: input.reference },
			});
			throw new ORPCError("BAD_REQUEST", {
				message: `Payment ${result.status}: please try again`,
			});
		}

		const metadata =
			(existing.metadata as Record<string, unknown> | null) ?? {};
		const expectedGrossKobo =
			typeof metadata.grossKobo === "number"
				? metadata.grossKobo
				: existing.amountKobo;

		if (result.currency !== "NGN" || result.amount !== expectedGrossKobo) {
			await context.db.transaction.update({
				data: { status: "failed" },
				where: { reference: input.reference },
			});
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment amount or currency mismatch",
			});
		}

		const wallet = await creditWallet({
			amountKobo: existing.amountKobo,
			description: existing.description,
			metadata: {
				...metadata,
				authorization: result.authorization,
				channel: result.authorization?.channel,
				gatewayFeeKobo: result.fees,
				paidAt: result.paid_at,
			},
			paystackRef: input.reference,
			reference: input.reference,
			type: "deposit",
			userId: existing.wallet.userId,
		});

		// Invalidate cached reads
		invalidate(userId, "billing.getWallet");
		invalidate(userId, "billing.getTransactions");

		return {
			alreadyProcessed: false,
			amountKobo: existing.amountKobo,
			newBalanceFormatted: formatNaira(wallet.balanceKobo),
			newBalanceKobo: wallet.balanceKobo,
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
					"campaign_hold",
					"campaign_refund",
					"refund",
				])
				.optional(),
		})
	)
	.handler(
		withCache("billing.getTransactions", 20_000, async ({ input, context }) => {
			const wallet = await context.db.wallet.findUnique({
				where: { userId: context.session?.user.id ?? "" },
			});
			if (!wallet) {
				return {
					pagination: {
						page: 1,
						pageSize: input.pageSize,
						total: 0,
						totalPages: 0,
					},
					transactions: [],
				};
			}

			const where = {
				walletId: wallet.id,
				...(input.type && { type: input.type }),
			};
			const [total, rows] = await Promise.all([
				context.db.transaction.count({ where }),
				context.db.transaction.findMany({
					orderBy: { createdAt: "desc" },
					skip: (input.page - 1) * input.pageSize,
					take: input.pageSize,
					where,
				}),
			]);

			return {
				pagination: {
					page: input.page,
					pageSize: input.pageSize,
					total,
					totalPages: Math.ceil(total / input.pageSize),
				},
				transactions: rows.map((t) => {
					const isHoldRelease =
						(t.metadata as Record<string, unknown> | null)?.isHoldRelease ===
							true || t.description.startsWith("Hold release:");
					const isCredit =
						t.type === "deposit" ||
						t.type === "refund" ||
						(t.type === "campaign_refund" && !isHoldRelease);

					return {
						amountFormatted: formatNaira(t.amountKobo),
						amountKobo: t.amountKobo,
						balanceAfterFormatted: formatNaira(t.balanceAfterKobo),
						balanceAfterKobo: t.balanceAfterKobo,
						campaignId: t.campaignId,
						createdAt: t.createdAt.toISOString(),
						description: t.description,
						id: t.id,
						isCredit,
						isHoldRelease,
						reference: t.reference,
						status: t.status,
						type: t.type,
					};
				}),
			};
		})
	);

// ── Campaign cost check ───────────────────────────────────────────────────────
export const checkCampaignCost = protectedProcedure
	.input(
		z.object({
			contactIds: z.array(z.string()).optional(),
			contacts: z.array(z.object({ channel: z.enum(["whatsapp", "sms"]) })),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
		})
	)
	.handler(async ({ input, context }) => {
		const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
		const serviceWindowContactIds = new Set<number>();

		if (
			input.contactIds &&
			input.contactIds.length > 0 &&
			input.deliveryMode === "marketing"
		) {
			const cutoff = new Date(Date.now() - SERVICE_WINDOW_MS);
			const openSessions = await context.db.contact.findMany({
				select: { id: true },
				where: {
					channel: "whatsapp",
					id: { in: input.contactIds },
					lastInboundAt: { gt: cutoff },
				},
			});
			const openSet = new Set(openSessions.map((c) => c.id));
			input.contactIds.forEach((id, idx) => {
				if (openSet.has(id)) {
					serviceWindowContactIds.add(idx);
				}
			});
		}

		const totalCostKobo = input.contacts.reduce((sum, c, idx) => {
			if (
				serviceWindowContactIds.has(idx) &&
				input.deliveryMode === "marketing"
			) {
				return sum + PRICING.PER_MESSAGE.whatsapp_service;
			}
			const type = resolveMessageType(c.channel, input.deliveryMode);
			return sum + PRICING.PER_MESSAGE[type];
		}, 0);

		const wallet = await getOrCreateWallet(context.session.user.id);
		const availableKobo = Math.max(0, wallet.balanceKobo - wallet.heldKobo);
		const canAfford = availableKobo >= totalCostKobo;
		const serviceWindowCount = serviceWindowContactIds.size;

		let prescreenFullCostKobo: number | null = null;
		if (input.deliveryMode === "utility_prescreen") {
			const consentCost = totalCostKobo;
			const replyAllCost =
				input.contacts.filter((c) => c.channel === "whatsapp").length *
				PRICING.PER_MESSAGE.whatsapp_service;
			prescreenFullCostKobo = consentCost + replyAllCost;
		}

		return {
			availableFormatted: formatNaira(availableKobo),
			availableKobo,
			balanceFormatted: formatNaira(wallet.balanceKobo),
			balanceKobo: wallet.balanceKobo,
			canAfford,
			deliveryMode: input.deliveryMode,
			heldFormatted: formatNaira(wallet.heldKobo),
			heldKobo: wallet.heldKobo,
			prescreenConsentCostFormatted:
				input.deliveryMode === "utility_prescreen"
					? formatNaira(totalCostKobo)
					: null,
			prescreenFullCostFormatted:
				prescreenFullCostKobo === null
					? null
					: formatNaira(prescreenFullCostKobo),
			rates: {
				sms: formatNaira(PRICING.PER_MESSAGE.sms),
				whatsappMarketing: formatNaira(PRICING.PER_MESSAGE.whatsapp_marketing),
				whatsappService: formatNaira(PRICING.PER_MESSAGE.whatsapp_service),
				whatsappUtility: formatNaira(PRICING.PER_MESSAGE.whatsapp_utility),
			},
			serviceWindowCount,
			serviceWindowCountFormatted:
				serviceWindowCount > 0 ? `${serviceWindowCount}` : null,
			shortfallFormatted:
				totalCostKobo - availableKobo > 0
					? formatNaira(totalCostKobo - availableKobo)
					: null,
			shortfallKobo: canAfford ? 0 : totalCostKobo - availableKobo,
			totalCostFormatted: formatNaira(totalCostKobo),
			totalCostKobo,
		};
	});
