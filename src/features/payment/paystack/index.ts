/**
 * src/features/payment/paystack/index.ts
 *
 * Typed Paystack API client.
 * All amounts going TO Paystack are in kobo (₦1 = 100 kobo).
 * All amounts coming FROM Paystack are also in kobo.
 *
 * Docs: https://paystack.com/docs/api/
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.paystack.co";

function headers() {
	const key = process.env.PAYSTACK_SECRET_KEY;
	if (!key) {
		throw new Error("PAYSTACK_SECRET_KEY is not set");
	}
	return {
		Authorization: `Bearer ${key}`,
		"Content-Type": "application/json",
	};
}

async function request<T>(
	method: "GET" | "POST" | "PUT" | "DELETE",
	path: string,
	body?: Record<string, unknown>
): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		headers: headers(),
		method,
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	const json = (await res.json()) as {
		status: boolean;
		message?: string;
		data: T;
	};

	if (!(res.ok && json.status)) {
		throw new Error(json.message ?? `Paystack error: ${res.status}`);
	}

	return json.data;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InitializeTransactionResult {
	access_code: string;
	authorization_url: string;
	reference: string;
}

export interface VerifyTransactionResult {
	amount: number; // gross amount in kobo
	authorization?: {
		authorization_code?: string;
		channel?: string;
		bank?: string;
		last4?: string;
	};
	currency: string;
	customer: { email: string; customer_code: string };
	fees?: number;
	id: number;
	metadata?: Record<string, unknown>;
	paid_at: string;
	reference: string;
	status: "success" | "failed" | "abandoned" | "pending";
}

// ─── One-time deposit ─────────────────────────────────────────────────────────

/**
 * Start a one-time deposit. Returns a Paystack checkout URL.
 *
 * @param email User email
 * @param netAmountKobo Amount to credit to the user's wallet in kobo
 * @param feeKobo Gateway fee to pass through in kobo
 * @param reference Unique deposit reference
 * @param callbackUrl Redirect URL after payment completion
 */
export function initializeDeposit({
	email,
	netAmountKobo,
	feeKobo,
	reference,
	callbackUrl,
}: {
	email: string;
	netAmountKobo: number;
	feeKobo: number;
	reference: string;
	callbackUrl: string;
}): Promise<InitializeTransactionResult> {
	const grossAmountKobo = netAmountKobo + feeKobo;
	return request<InitializeTransactionResult>(
		"POST",
		"/transaction/initialize",
		{
			amount: grossAmountKobo,
			callback_url: callbackUrl,
			channels: ["card", "bank", "ussd", "bank_transfer"],
			currency: "NGN",
			email,
			metadata: {
				feeKobo,
				grossKobo: grossAmountKobo,
				netKobo: netAmountKobo,
				type: "wallet_deposit",
			},
			reference,
		}
	);
}

/**
 * Verify a completed transaction by reference.
 * Call this from your Paystack webhook and the callback URL handler.
 */
export function verifyTransaction(
	reference: string
): Promise<VerifyTransactionResult> {
	return request<VerifyTransactionResult>(
		"GET",
		`/transaction/verify/${encodeURIComponent(reference)}`
	);
}

// ─── Webhook validation ───────────────────────────────────────────────────────

/**
 * Validate that a webhook request genuinely came from Paystack using timing safe HMAC.
 */
export function validateWebhookSignature(
	rawBody: string,
	paystackSignature: string
): boolean {
	const secret = process.env.PAYSTACK_SECRET_KEY;
	if (!(secret && paystackSignature)) {
		return false;
	}

	const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
	if (hash.length !== paystackSignature.length) {
		return false;
	}

	return timingSafeEqual(
		Buffer.from(hash, "utf8"),
		Buffer.from(paystackSignature, "utf8")
	);
}
