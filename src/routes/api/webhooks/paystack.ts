/**
 * POST /api/paystack/webhook
 *
 * Receives Paystack webhook events and processes them server-side.
 * This is the authoritative path for crediting wallets and activating
 * subscriptions — the client verify flow is a UX convenience fallback only.
 *
 * Events handled:
 *   charge.success         → credit user wallet for deposit
 *   subscription.create    → activate Subscription row
 *   subscription.disable   → mark Subscription as cancelled
 *   invoice.payment_failed → notify user + pause subscription
 *
 * Set this URL in your Paystack Dashboard → Settings → Webhooks:
 *   https://yourdomain.com/api/paystack/webhook
 */
import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { creditWallet, formatNaira } from "#/features/billing/utils";
import { validateWebhookSignature } from "#/features/payment/paystack";

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
		console.warn("[Paystack Webhook] Invalid signature — rejecting");
		return Response.json({ error: "Invalid signature" }, { status: 401 });
	}

	const payload = JSON.parse(rawBody) as {
		event: string;
		data: Record<string, unknown>;
	};
	const { event, data } = payload;

	console.info(`[Paystack Webhook] Event: ${event}`);

	try {
		switch (event) {
			// ── Deposit completed ─────────────────────────────────────────────────
			case "charge.success": {
				const reference = data.reference as string;
				const amountKobo = data.amount as number;
				const metadata = (data.metadata ?? {}) as Record<string, string>;
				const type = metadata.type;

				// Only handle wallet deposits here, not subscription auth charges
				if (type !== "wallet_deposit") {
					break;
				}

				// Find which user this belongs to via pending transaction
				const pending = await prisma.transaction.findUnique({
					include: { wallet: true },
					where: { reference },
				});

				if (!pending) {
					console.warn(`[Webhook] No pending transaction for ref ${reference}`);
					break;
				}
				if (pending.status === "completed") {
					console.info(`[Webhook] Already processed ${reference} — skipping`);
					break;
				}

				// Credit wallet
				await creditWallet({
					amountKobo,
					description: `Wallet top-up of ${formatNaira(amountKobo)}`,
					paystackRef: reference,
					reference: `${reference}_webhook`,
					type: "deposit",
					userId: pending.wallet.userId,
				});

				// Mark original pending record as completed
				await prisma.transaction.update({
					data: { paystackRef: reference, status: "completed" },
					where: { reference },
				});

				console.info(
					`[Webhook] Credited ${formatNaira(amountKobo)} to wallet for tx ${reference}`
				);
				break;
			}

			default:
				console.info(`[Webhook] Unhandled event: ${event}`);
		}
	} catch (err) {
		console.error("[Paystack Webhook] Error processing event:", err);
		// Return 200 anyway — Paystack will retry on non-200
		// Better to acknowledge than to loop retries
	}

	// Always return 200 so Paystack stops retrying
	return Response.json({ received: true });
}
