import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the handler
vi.mock("#/db", () => ({
	prisma: {
		transaction: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
	},
}));

vi.mock("#/features/billing/utils", () => ({
	creditWallet: vi.fn(),
	formatNaira: (kobo: number) => `₦${(kobo / 100).toLocaleString()}`,
}));

vi.mock("#/features/payment/paystack", () => ({
	validateWebhookSignature: vi.fn(),
}));

vi.mock("#/lib/cache", () => ({
	invalidate: vi.fn(),
}));

import { prisma } from "#/db";
import { creditWallet } from "#/features/billing/utils";
import { validateWebhookSignature } from "#/features/payment/paystack";
import { invalidate } from "#/lib/cache";
import { paystackWebhook } from "#/routes/api/webhooks/paystack";

describe("Paystack Webhook Handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when signature is invalid or missing", async () => {
		(validateWebhookSignature as any).mockReturnValue(false);

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: JSON.stringify({ event: "charge.success" }),
			headers: { "x-paystack-signature": "invalid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.error).toBe("Invalid signature");
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("returns 400 when body is malformed JSON", async () => {
		(validateWebhookSignature as any).mockReturnValue(true);

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: "this-is-not-valid-json",
			headers: { "x-paystack-signature": "valid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toBe("Invalid JSON payload");
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("ignores non-deposit events gracefully and returns 200", async () => {
		(validateWebhookSignature as any).mockReturnValue(true);

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: JSON.stringify({
				data: { reference: "ref_other" },
				event: "subscription.create",
			}),
			headers: { "x-paystack-signature": "valid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.received).toBe(true);
		expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("skips processing if pending transaction is not found", async () => {
		(validateWebhookSignature as any).mockReturnValue(true);
		(prisma.transaction.findUnique as any).mockResolvedValue(null);

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: JSON.stringify({
				data: {
					amount: 100_000,
					currency: "NGN",
					metadata: { type: "wallet_deposit" },
					reference: "non_existent_ref",
				},
				event: "charge.success",
			}),
			headers: { "x-paystack-signature": "valid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.received).toBe(true);
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("idempotently ignores already completed transactions", async () => {
		(validateWebhookSignature as any).mockReturnValue(true);
		(prisma.transaction.findUnique as any).mockResolvedValue({
			amountKobo: 100_000,
			id: "tx_1",
			reference: "ref_completed",
			status: "completed",
			wallet: { userId: "user_1" },
		});

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: JSON.stringify({
				data: {
					amount: 100_000,
					currency: "NGN",
					metadata: { type: "wallet_deposit" },
					reference: "ref_completed",
				},
				event: "charge.success",
			}),
			headers: { "x-paystack-signature": "valid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(200);
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("marks transaction failed when gross amount or currency mismatches", async () => {
		(validateWebhookSignature as any).mockReturnValue(true);
		(prisma.transaction.findUnique as any).mockResolvedValue({
			amountKobo: 100_000,
			id: "tx_1",
			metadata: { grossKobo: 101_523 },
			reference: "ref_mismatch",
			status: "pending",
			wallet: { userId: "user_1" },
		});

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: JSON.stringify({
				data: {
					amount: 50_000, // Tampered amount
					currency: "NGN",
					metadata: { type: "wallet_deposit" },
					reference: "ref_mismatch",
				},
				event: "charge.success",
			}),
			headers: { "x-paystack-signature": "valid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(200);
		expect(prisma.transaction.update).toHaveBeenCalledWith({
			data: { status: "failed" },
			where: { reference: "ref_mismatch" },
		});
		expect(creditWallet).not.toHaveBeenCalled();
	});

	it("credits user wallet and invalidates cache on valid charge.success", async () => {
		(validateWebhookSignature as any).mockReturnValue(true);
		(prisma.transaction.findUnique as any).mockResolvedValue({
			amountKobo: 100_000,
			description: "Wallet deposit: ₦1,000.00",
			id: "tx_1",
			metadata: { grossKobo: 101_523 },
			reference: "ref_valid_123",
			status: "pending",
			wallet: { userId: "user_owner_id" },
		});

		const req = new Request("http://localhost:3000/api/webhooks/paystack", {
			body: JSON.stringify({
				data: {
					amount: 101_523,
					authorization: { channel: "card" },
					currency: "NGN",
					fees: 1523,
					metadata: { type: "wallet_deposit" },
					paid_at: "2026-09-09T12:00:00Z",
					reference: "ref_valid_123",
				},
				event: "charge.success",
			}),
			headers: { "x-paystack-signature": "valid_sig" },
			method: "POST",
		});

		const res = await paystackWebhook(req);
		expect(res.status).toBe(200);
		expect(creditWallet).toHaveBeenCalledWith(
			expect.objectContaining({
				amountKobo: 100_000,
				paystackRef: "ref_valid_123",
				reference: "ref_valid_123",
				type: "deposit",
				userId: "user_owner_id",
			})
		);
		expect(invalidate).toHaveBeenCalledWith(
			"user_owner_id",
			"billing.getWallet"
		);
		expect(invalidate).toHaveBeenCalledWith(
			"user_owner_id",
			"billing.getTransactions"
		);
	});
});
