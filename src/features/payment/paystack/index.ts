/**
 * src/lib/paystack.ts
 *
 * Typed Paystack API client.
 * All amounts going TO Paystack are in kobo (₦1 = 100 kobo).
 * All amounts coming FROM Paystack are also in kobo.
 *
 * Docs: https://paystack.com/docs/api/
 */

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
		method,
		headers: headers(),
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	const json = await res.json();

	if (!(res.ok && json.status)) {
		throw new Error(json.message ?? `Paystack error: ${res.status}`);
	}

	return json.data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InitializeTransactionResult {
	access_code: string;
	authorization_url: string;
	reference: string;
}

export interface VerifyTransactionResult {
	amount: number; // kobo
	authorization: { authorization_code: string };
	currency: string;
	customer: { email: string; customer_code: string };
	id: number;
	paid_at: string;
	reference: string;
	status: "success" | "failed" | "abandoned" | "pending";
}

export interface CreateSubscriptionResult {
	email_token: string;
	plan: { plan_code: string; amount: number };
	status: string;
	subscription_code: string;
}

export interface FetchSubscriptionResult {
	amount: number; // kobo
	next_payment_date: string;
	plan: { plan_code: string; name: string; interval: string };
	status: string;
	subscription_code: string;
}

// ─── One-time deposit ─────────────────────────────────────────────────────────

/**
 * Start a one-time deposit. Returns a Paystack checkout URL.
 *
 * @param email    User's email (Paystack uses this to identify the customer)
 * @param amountKobo  Amount in kobo to deposit
 * @param reference  Unique idempotency reference — store this to verify later
 * @param callbackUrl  Where to redirect after payment
 */
export function initializeDeposit(
	email: string,
	amountKobo: number,
	reference: string,
	callbackUrl: string
): Promise<InitializeTransactionResult> {
	return request<InitializeTransactionResult>(
		"POST",
		"/transaction/initialize",
		{
			email,
			amount: amountKobo,
			reference,
			callback_url: callbackUrl,
			currency: "NGN",
			channels: ["card", "bank", "ussd", "bank_transfer"],
			metadata: { type: "wallet_deposit" },
		}
	);
}

/**
 * Verify a completed transaction by reference.
 * Call this from your Paystack webhook AND the callback URL handler.
 */
export function verifyTransaction(
	reference: string
): Promise<VerifyTransactionResult> {
	return request<VerifyTransactionResult>(
		"GET",
		`/transaction/verify/${encodeURIComponent(reference)}`
	);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Create a Paystack recurring subscription for a user.
 *
 * @param customerEmail   User's email
 * @param planCode        Paystack plan code (e.g. "PLN_xxxx") — set in dashboard
 * @param authorizationCode  From a previous successful charge (card on file)
 */
export function createSubscription(
	customerEmail: string,
	planCode: string,
	authorizationCode: string
): Promise<CreateSubscriptionResult> {
	return request<CreateSubscriptionResult>("POST", "/subscription", {
		customer: customerEmail,
		plan: planCode,
		authorization: authorizationCode,
	});
}

/**
 * Fetch a subscription by its Paystack subscription code.
 */
export function fetchSubscription(
	subscriptionCode: string
): Promise<FetchSubscriptionResult> {
	return request<FetchSubscriptionResult>(
		"GET",
		`/subscription/${subscriptionCode}`
	);
}

/**
 * Disable (cancel) a Paystack subscription.
 * Requires the subscription code + email token (returned at creation).
 */
export function cancelSubscription(
	subscriptionCode: string,
	emailToken: string
): Promise<{ subscription_code: string }> {
	return request<{ subscription_code: string }>(
		"POST",
		"/subscription/disable",
		{ code: subscriptionCode, token: emailToken }
	);
}

// ─── Webhook validation ───────────────────────────────────────────────────────

import { createHmac } from "node:crypto";

/**
 * Validate that a webhook request genuinely came from Paystack.
 * Call this at the top of your webhook handler before processing anything.
 */
export function validateWebhookSignature(
	rawBody: string,
	paystackSignature: string
): boolean {
	const secret = process.env.PAYSTACK_SECRET_KEY;
	if (!secret) {
		return false;
	}

	const hash = createHmac("sha512", secret).update(rawBody).digest("hex");

	return hash === paystackSignature;
}
