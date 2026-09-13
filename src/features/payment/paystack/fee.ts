/**
 * src/features/payment/paystack/fee.ts
 *
 * Client safe fee calculation for Paystack transactions.
 * Free of server dependencies or Node runtime built in modules.
 */

/**
 * Calculate the Paystack fee for Nigerian transactions.
 * Standard pricing: 1.5 percent plus 100 Naira flat fee.
 * The 100 Naira flat fee is waived for transactions below 2,500 Naira (250,000 kobo).
 * Total fee is capped at 2,000 Naira (200,000 kobo).
 *
 * To ensure the wallet receives the exact net deposit amount,
 * we calculate the fee to add to the checkout gross charge:
 * Net equals Gross minus Fee, so Gross equals (Net + flatFee) / (1 - 0.015)
 */
export function calculatePaystackFee(netKobo: number): number {
	const flatFeeKobo = netKobo >= 250_000 ? 10_000 : 0;
	const rawFee = Math.round((netKobo + flatFeeKobo) / (1 - 0.015)) - netKobo;
	return Math.min(200_000, rawFee);
}
