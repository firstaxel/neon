import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/db", () => ({
	prisma: {
		campaign: {
			update: vi.fn(),
		},
		contact: {
			updateMany: vi.fn(),
		},
		message: {
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		messageTemplate: {
			updateMany: vi.fn(),
		},
		transaction: {
			findFirst: vi.fn(),
		},
	},
}));

vi.mock("#/features/billing/utils", () => ({
	refundForMessage: vi.fn(),
}));

vi.mock("#/lib/inngest/client", () => ({
	inngest: {
		send: vi.fn(),
	},
}));

import { prisma } from "#/db";
import { refundForMessage } from "#/features/billing/utils";
import { whatsappGetWebhook, whatsappWebhookPost } from "./whatsapp";

describe("WhatsApp webhook verification and status callbacks", () => {
	const verifyToken = "test_webhook_token_123";

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = verifyToken;
		delete process.env.WHATSAPP_WEBHOOK_SECRET;
	});

	describe("GET challenge verification", () => {
		it("returns challenge when verify token matches", () => {
			const req = new Request(
				`http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=challenge_code_abc`
			);
			const res = whatsappGetWebhook(req);
			expect(res.status).toBe(200);
		});

		it("returns 403 Forbidden when verify token does not match", () => {
			const req = new Request(
				"http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=challenge_code_abc"
			);
			const res = whatsappGetWebhook(req);
			expect(res.status).toBe(403);
		});
	});

	describe("POST status callbacks (AC-9, AC-10)", () => {
		it("updates message record with delivered status and deliveredAt timestamp", async () => {
			(prisma.message.updateMany as any).mockResolvedValue({ count: 1 });

			const payload = {
				entry: [
					{
						changes: [
							{
								field: "messages",
								value: {
									messaging_product: "whatsapp",
									metadata: {
										display_phone_number: "2348000000000",
										phone_number_id: "phone_123",
									},
									statuses: [
										{
											id: "wamid_deliv_1",
											recipient_id: "2348012345678",
											status: "delivered",
											timestamp: "1726228800",
										},
									],
								},
							},
						],
						id: "entry_1",
					},
				],
				object: "whatsapp_business_account",
			};

			const req = new Request("http://localhost:3000/api/webhooks/whatsapp", {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});

			const res = await whatsappWebhookPost(req);
			expect(res.status).toBe(200);

			expect(prisma.message.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({
					deliveredAt: expect.any(Date),
					status: "delivered",
				}),
				where: { metaMessageId: "wamid_deliv_1" },
			});
		});

		it("updates message record with read status and readAt timestamp", async () => {
			(prisma.message.updateMany as any).mockResolvedValue({ count: 1 });

			const payload = {
				entry: [
					{
						changes: [
							{
								field: "messages",
								value: {
									messaging_product: "whatsapp",
									metadata: {
										display_phone_number: "2348000000000",
										phone_number_id: "phone_123",
									},
									statuses: [
										{
											id: "wamid_read_1",
											recipient_id: "2348012345678",
											status: "read",
											timestamp: "1726229000",
										},
									],
								},
							},
						],
						id: "entry_1",
					},
				],
				object: "whatsapp_business_account",
			};

			const req = new Request("http://localhost:3000/api/webhooks/whatsapp", {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});

			const res = await whatsappWebhookPost(req);
			expect(res.status).toBe(200);

			expect(prisma.message.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({
					readAt: expect.any(Date),
					status: "read",
				}),
				where: { metaMessageId: "wamid_read_1" },
			});
		});

		it("handles delivery failure by updating message, incrementing failedMessages, and refunding wallet", async () => {
			(prisma.message.findUnique as any).mockResolvedValue({
				campaign: {
					id: "camp_fail_1",
					userId: "user_owner_1",
				},
				campaignId: "camp_fail_1",
				costKobo: 9000,
				id: "msg_rec_1",
				status: "sent",
			});
			(prisma.transaction.findFirst as any).mockResolvedValue(null);
			(prisma.message.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.campaign.update as any).mockResolvedValue({ id: "camp_fail_1" });
			(refundForMessage as any).mockResolvedValue({ success: true });

			const payload = {
				entry: [
					{
						changes: [
							{
								field: "messages",
								value: {
									messaging_product: "whatsapp",
									metadata: {
										display_phone_number: "2348000000000",
										phone_number_id: "phone_123",
									},
									statuses: [
										{
											errors: [
												{
													code: 131_026,
													message: "Message undeliverable to this destination",
													title: "Undeliverable",
												},
											],
											id: "wamid_failed_1",
											recipient_id: "2348012345678",
											status: "failed",
											timestamp: "1726229500",
										},
									],
								},
							},
						],
						id: "entry_1",
					},
				],
				object: "whatsapp_business_account",
			};

			const req = new Request("http://localhost:3000/api/webhooks/whatsapp", {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});

			const res = await whatsappWebhookPost(req);
			expect(res.status).toBe(200);

			expect(prisma.message.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({
					errorMessage: "Message undeliverable to this destination",
					status: "failed",
				}),
				where: { id: "msg_rec_1", status: { not: "failed" } },
			});

			expect(prisma.campaign.update).toHaveBeenCalledWith({
				data: {
					failedMessages: { increment: 1 },
					sentMessages: { decrement: 1 },
				},
				where: { id: "camp_fail_1" },
			});

			expect(refundForMessage).toHaveBeenCalledWith({
				campaignId: "camp_fail_1",
				messageId: "msg_rec_1",
				messageType: "whatsapp_marketing",
				reason: "Message undeliverable to this destination",
				userId: "user_owner_1",
			});
		});

		it("prevents duplicate counters and refunds when concurrent duplicate failure webhooks arrive", async () => {
			(prisma.message.findUnique as any).mockResolvedValue({
				campaign: {
					id: "camp_fail_dup",
					userId: "user_owner_dup",
				},
				campaignId: "camp_fail_dup",
				costKobo: 9000,
				id: "msg_rec_dup",
				status: "failed",
			});
			// Atomic updateMany returns count: 0 because another concurrent call already claimed the failure
			(prisma.message.updateMany as any).mockResolvedValue({ count: 0 });

			const payload = {
				entry: [
					{
						changes: [
							{
								field: "messages",
								value: {
									messaging_product: "whatsapp",
									metadata: {
										display_phone_number: "2348000000000",
										phone_number_id: "phone_123",
									},
									statuses: [
										{
											errors: [
												{
													code: 131_026,
													message: "Message undeliverable to this destination",
													title: "Undeliverable",
												},
											],
											id: "wamid_failed_dup",
											recipient_id: "2348012345678",
											status: "failed",
											timestamp: "1726229500",
										},
									],
								},
							},
						],
						id: "entry_1",
					},
				],
				object: "whatsapp_business_account",
			};

			const req = new Request("http://localhost:3000/api/webhooks/whatsapp", {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});

			const res = await whatsappWebhookPost(req);
			expect(res.status).toBe(200);

			// Must not update campaign counters or issue refund
			expect(prisma.campaign.update).not.toHaveBeenCalled();
			expect(refundForMessage).not.toHaveBeenCalled();
		});
	});

	describe("Template status updates", () => {
		it("updates template status to APPROVED when Meta approves template", async () => {
			(prisma.messageTemplate.updateMany as any).mockResolvedValue({
				count: 1,
			});

			const payload = {
				entry: [
					{
						changes: [
							{
								field: "message_template_status_update",
								value: {
									event: {
										event: "APPROVED",
										message_template_id: 123_456_789,
										message_template_language: "en",
										message_template_name: "welcome_pass",
									},
									messaging_product: "whatsapp",
								},
							},
						],
						id: "entry_1",
					},
				],
				object: "whatsapp_business_account",
			};

			const req = new Request("http://localhost:3000/api/webhooks/whatsapp", {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});

			const res = await whatsappWebhookPost(req);
			expect(res.status).toBe(200);

			expect(prisma.messageTemplate.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({
					approvedAt: expect.any(Date),
					status: "APPROVED",
				}),
				where: { waTemplateId: "123456789" },
			});
		});
	});
});
