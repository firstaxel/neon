/**
 * POST /api/webhooks/paystack
 *
 * Receives Paystack webhook events and processes them server-side.
 * This is the authoritative path for crediting wallets.
 *
 * Events handled:
 *   charge.success → credit user wallet for deposit
 */
import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { creditWallet } from "#/features/billing/utils";
import { formatNaira } from "#/features/billing/utils/format";
import { validateWebhookSignature } from "#/features/payment/paystack";
import type { Prisma } from "#/generated/prisma/client";
import { invalidate } from "#/lib/cache";

export const Route = createFileRoute("/api/webhooks/paystack")({
	server: {
		handlers: {
			POST: async ({ request }) => paystackWebhook(request),
		},
	},
});

export async function paystackWebhook(req: Request) {
	// ── 1. Validate Paystack signature ────────────────────────────────────────
	const rawBody = await req.text();
	const signature = req.headers.get("x-paystack-signature") ?? "";

	if (!validateWebhookSignature(rawBody, signature)) {
		console.warn("[Paystack Webhook] Invalid signature: rejecting");
		return Response.json({ error: "Invalid signature" }, { status: 401 });
	}

	let payload: {
		event: string;
		data: Record<string, unknown>;
	};
	try {
		payload = JSON.parse(rawBody);
	} catch {
		console.warn("[Paystack Webhook] Malformed JSON payload");
		return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
	}

	const { event, data } = payload;

	console.info(`[Paystack Webhook] Event: ${event}`);

	try {
		switch (event) {
			// ── Deposit completed ─────────────────────────────────────────────────
			case "charge.success": {
				const reference = data.reference as string;
				const grossAmountKobo = data.amount as number;
				const currency = data.currency as string;
				const metadata = (data.metadata ?? {}) as Record<string, unknown>;
				const { type } = metadata;

				if (type !== "wallet_deposit") {
					break;
				}

				const pending = await prisma.transaction.findUnique({
					include: { wallet: true },
					where: { reference },
				});

				if (!pending) {
					console.warn(
						`[Paystack Webhook] No pending transaction for ref ${reference}`
					);
					break;
				}
				if (pending.status === "completed") {
					console.info(
						`[Paystack Webhook] Already processed ${reference}: skipping`
					);
					break;
				}

				const pendingMeta =
					(pending.metadata as Record<string, unknown> | null) ?? {};
				const expectedGrossKobo =
					typeof pendingMeta.grossKobo === "number"
						? pendingMeta.grossKobo
						: pending.amountKobo;

				if (currency !== "NGN" || grossAmountKobo !== expectedGrossKobo) {
					console.warn(
						`[Paystack Webhook] Mismatched amount/currency for ref ${reference}. Expected ${expectedGrossKobo} NGN, received ${grossAmountKobo} ${currency}`
					);
					await prisma.transaction.update({
						data: { status: "failed" },
						where: { reference },
					});
					break;
				}

				// Credit wallet with net deposit amount
				await creditWallet({
					amountKobo: pending.amountKobo,
					description: pending.description,
					metadata: {
						...pendingMeta,
						authorization: data.authorization,
						channel: (data.authorization as Record<string, unknown> | undefined)
							?.channel,
						gatewayFeeKobo: data.fees,
						paidAt: data.paid_at,
					} as Prisma.InputJsonValue,
					paystackRef: reference,
					reference,
					type: "deposit",
					userId: pending.wallet.userId,
				});

				// Invalidate cached reads for the user
				invalidate(pending.wallet.userId, "billing.getWallet");
				invalidate(pending.wallet.userId, "billing.getTransactions");

				console.info(
					`[Paystack Webhook] Credited ${formatNaira(pending.amountKobo)} to wallet for tx ${reference}`
				);
				break;
			}

			default:
				console.info(`[Paystack Webhook] Unhandled event: ${event}`);
		}
	} catch (err) {
		console.error("[Paystack Webhook] Error processing event:", err);
	}

	// Always return 200 so Paystack halts retry loops
	return Response.json({ received: true });
}
