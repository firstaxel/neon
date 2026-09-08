/**
 * src/orpc/billing.router.ts
 * All procedures use `protectedProcedure` — userId always from context.session.user.id
 */

import { ORPCError } from "@orpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
	creditWallet,
	formatNaira,
	getOrCreateWallet,
	nairaToKobo,
	PRICING,
	resolveMessageType,
} from "#/features/billing/utils";
import {
	initializeDeposit,
	verifyTransaction,
} from "#/features/payment/paystack";
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
				amountKobo,
				balanceAfterKobo: wallet.balanceKobo,
				description: `Wallet top-up of ${formatNaira(amountKobo)}`,
				reference,
				status: "pending",
				type: "deposit",
				walletId: wallet.id,
			},
		});

		const result = await initializeDeposit(
			userEmail,
			amountKobo,
			reference,
			input.callbackUrl
		);
		return {
			amountKobo,
			checkoutUrl: result.authorization_url,
			reference: result.reference,
		};
	});

export const verifyDeposit = protectedProcedure
	.input(z.object({ reference: z.string() }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const existing = await context.db.transaction.findUnique({
			where: { reference: input.reference },
		});
		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Transaction not found",
			});
		}
		if (existing.status === "completed") {
			return { alreadyProcessed: true, amountKobo: existing.amountKobo };
		}

		const result = await verifyTransaction(input.reference);
		if (result.status !== "success") {
			await context.db.transaction.update({
				data: { status: "failed" },
				where: { reference: input.reference },
			});
			throw new ORPCError("BAD_REQUEST", {
				message: `Payment ${result.status} — please try again`,
			});
		}

		const wallet = await creditWallet({
			amountKobo: result.amount,
			description: `Wallet top-up of ${formatNaira(result.amount)}`,
			paystackRef: input.reference,
			reference: `${input.reference}_credit`,
			type: "deposit",
			userId: context.session.user.id,
		});
		await context.db.transaction.update({
			data: { paystackRef: input.reference, status: "completed" },
			where: { reference: input.reference },
		});

		// Wallet balance changed — invalidate cached reads
		invalidate(userId, "billing.getWallet");
		invalidate(userId, "billing.getTransactions");

		return {
			alreadyProcessed: false,
			amountKobo: result.amount,
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
				transactions: rows.map((t) => ({
					amountFormatted: formatNaira(t.amountKobo),
					amountKobo: t.amountKobo,
					balanceAfterFormatted: formatNaira(t.balanceAfterKobo),
					balanceAfterKobo: t.balanceAfterKobo,
					campaignId: t.campaignId,
					createdAt: t.createdAt.toISOString(),
					description: t.description,
					id: t.id,
					isCredit: ["deposit", "campaign_refund", "refund"].includes(t.type),
					reference: t.reference,
					status: t.status,
					type: t.type,
				})),
			};
		})
	);

// ── Campaign cost check ───────────────────────────────────────────────────────
export const checkCampaignCost = protectedProcedure
	.input(
		z.object({
			contactIds: z.array(z.string()).optional(), // if provided, detect open service windows
			contacts: z.array(z.object({ channel: z.enum(["whatsapp", "sms"]) })),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
		})
	)
	.handler(async ({ input, context }) => {
		// Detect which contacts have an open 24h service window (lastInboundAt < 24h ago)
		// These WhatsApp contacts can receive free-form messages at whatsapp_service rate (₦0)
		const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
		const serviceWindowContactIds = new Set<number>(); // index into input.contacts

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
			// Map back to indexes in input.contacts (parallel array)
			input.contactIds.forEach((id, idx) => {
				if (openSet.has(id)) {
					serviceWindowContactIds.add(idx);
				}
			});
		}

		// Cost per contact — service window contacts are priced at ₦0 for marketing mode
		const totalCostKobo = input.contacts.reduce((sum, c, idx) => {
			if (
				serviceWindowContactIds.has(idx) &&
				input.deliveryMode === "marketing"
			) {
				return sum + PRICING.PER_MESSAGE.whatsapp_service; // ₦0
			}
			const type = resolveMessageType(c.channel, input.deliveryMode);
			return sum + PRICING.PER_MESSAGE[type];
		}, 0);

		const wallet = await getOrCreateWallet(context.session.user.id);
		const canAfford = wallet.balanceKobo >= totalCostKobo;
		const serviceWindowCount = serviceWindowContactIds.size;

		// For utility_prescreen: also expose the worst-case full cost (if every contact
		// replies YES and gets the real message billed at whatsapp_service rate).
		let prescreenFullCostKobo: number | null = null;
		if (input.deliveryMode === "utility_prescreen") {
			const consentCost = totalCostKobo;
			const replyAllCost =
				input.contacts.filter((c) => c.channel === "whatsapp").length *
				PRICING.PER_MESSAGE.whatsapp_service;
			prescreenFullCostKobo = consentCost + replyAllCost;
		}

		return {
			balanceFormatted: formatNaira(wallet.balanceKobo),
			balanceKobo: wallet.balanceKobo,
			canAfford,
			deliveryMode: input.deliveryMode,
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
			serviceWindowCount, // contacts who can be sent free-form at ₦0
			serviceWindowCountFormatted:
				serviceWindowCount > 0 ? `${serviceWindowCount}` : null,
			shortfallFormatted:
				totalCostKobo - wallet.balanceKobo > 0
					? formatNaira(totalCostKobo - wallet.balanceKobo)
					: null,
			shortfallKobo: canAfford ? 0 : totalCostKobo - wallet.balanceKobo,
			totalCostFormatted: formatNaira(totalCostKobo),
			totalCostKobo,
		};
	});
