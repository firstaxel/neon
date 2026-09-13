import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/db", () => ({
	prisma: {
		campaign: {
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		contact: {
			findMany: vi.fn(),
		},
		message: {
			aggregate: vi.fn(),
			createMany: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		transaction: {
			findFirst: vi.fn(),
		},
	},
}));

vi.mock("#/features/billing/utils", () => ({
	commitCampaignDeduction: vi.fn(),
	debitForMessage: vi.fn(),
	refundForMessage: vi.fn(),
	releaseCampaignHold: vi.fn(),
}));

vi.mock("#/lib/content-check", () => ({
	checkContent: vi.fn().mockResolvedValue({ safe: true }),
}));

vi.mock("#/lib/termii", () => ({
	sendSmsMessage: vi
		.fn()
		.mockResolvedValue({ messageId: "termii_msg_1", success: true }),
}));

vi.mock("#/lib/meta-send", () => ({
	sendTemplateMessage: vi
		.fn()
		.mockResolvedValue({ messageId: "wamid.test.123", success: true }),
	sendWhatsAppMessage: vi
		.fn()
		.mockResolvedValue({ messageId: "wamid.test.456", success: true }),
}));

import { prisma } from "#/db";
import { commitCampaignDeduction } from "#/features/billing/utils";
import { sendTemplateMessage } from "#/lib/meta-send";
import { sendSmsMessage } from "#/lib/termii";
import { sendCampaign, sendSingleMessage } from "./send-campaign";

describe("sendCampaign Orchestrator and sendSingleMessage Worker (AC-6, AC-7, AC-8, AC-9, AC-10)", () => {
	const mockLogger = {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("sendCampaign Orchestrator", () => {
		it("waits via step.sleepUntil when scheduledAt is in the future", async () => {
			const mockStep = {
				run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
				sendEvent: vi.fn().mockResolvedValue({}),
				sleep: vi.fn().mockResolvedValue({}),
				sleepUntil: vi.fn().mockResolvedValue({}),
			};

			const futureDate = new Date(Date.now() + 3_600_000).toISOString();

			(prisma.campaign.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.contact.findMany as any).mockResolvedValue([
				{
					channel: "sms",
					id: "c1",
					name: "Ada",
					phone: "08012345678",
					type: "contact",
				},
			]);
			(prisma.campaign.findUnique as any).mockResolvedValue({
				deliveryMode: "marketing",
				senderId: "ChurchSMS",
			});

			const handler = (sendCampaign as any).fn;
			await handler({
				event: {
					data: {
						campaignId: "camp_scheduled",
						contactIds: ["c1"],
						forceSmsChannel: true,
						scenario: "general",
						scheduledAt: futureDate,
						smsTemplate: "Hello {{name}}",
						templateVars: {},
						userId: "user_1",
						whatsappTemplate: "",
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			expect(mockStep.sleepUntil).toHaveBeenCalledWith(
				"wait-for-schedule",
				expect.any(Date)
			);
			expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({ status: "dispatching" }),
				where: { id: "camp_scheduled", status: "pending" },
			});
		});

		it("aborts safely if the campaign was cancelled before dispatch began", async () => {
			const mockStep = {
				run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
				sendEvent: vi.fn(),
				sleepUntil: vi.fn().mockResolvedValue({}),
			};

			// Status was already changed to cancelled, so count is 0
			(prisma.campaign.updateMany as any).mockResolvedValue({ count: 0 });

			const handler = (sendCampaign as any).fn;
			const result = await handler({
				event: {
					data: {
						campaignId: "camp_cancelled",
						contactIds: ["c1"],
						forceSmsChannel: true,
						scenario: "general",
						smsTemplate: "Hello",
						templateVars: {},
						userId: "user_1",
						whatsappTemplate: "",
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			expect(result).toEqual({
				aborted: true,
				campaignId: "camp_cancelled",
				reason: "cancelled_or_already_dispatching",
			});
			expect(prisma.contact.findMany).not.toHaveBeenCalled();
			expect(mockStep.sendEvent).not.toHaveBeenCalled();
		});

		it("resolves contact positional parameters and fan out events for WhatsApp template broadcast", async () => {
			const mockStep = {
				run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
				sendEvent: vi.fn().mockResolvedValue({}),
				sleep: vi.fn().mockResolvedValue({}),
				sleepUntil: vi.fn().mockResolvedValue({}),
			};

			(prisma.campaign.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.contact.findMany as any)
				.mockResolvedValueOnce([
					{
						channel: "whatsapp",
						id: "c1",
						name: "Ada",
						phone: "+2348012345678",
						type: "contact",
					},
				])
				.mockResolvedValueOnce([]);
			(prisma.campaign.findUnique as any).mockResolvedValue({
				deliveryMode: "marketing",
				senderId: null,
			});

			const handler = (sendCampaign as any).fn;
			const result = await handler({
				event: {
					data: {
						campaignId: "camp_wa_fanout",
						channelTarget: "whatsapp",
						contactIds: ["c1"],
						forceSmsChannel: false,
						scenario: "general",
						smsTemplate: "",
						templateId: "tmpl_1",
						templateParams: {
							"1": "name",
						},
						templateVars: {},
						userId: "user_1",
						waTemplateLanguage: "en",
						waTemplateName: "welcome_pass",
						whatsappTemplate: "Hello {{1}}, welcome!",
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			expect(result).toEqual({
				campaignId: "camp_wa_fanout",
				scenario: "general",
				sms: 0,
				totalQueued: 1,
				whatsapp: 1,
			});

			expect(mockStep.sendEvent).toHaveBeenCalledWith(
				"fan-out-batch-0",
				expect.arrayContaining([
					expect.objectContaining({
						data: expect.objectContaining({
							channel: "whatsapp",
							waTemplateLanguage: "en",
							waTemplateName: "welcome_pass",
							waTemplateParams: ["Ada"],
						}),
						name: "Velocast/campaign.send-single",
					}),
				])
			);
		});
	});

	describe("sendSingleMessage Worker and hold reconciliation", () => {
		it("sends SMS via Termii and reconciles wallet deduction on completion", async () => {
			const mockStep = {
				run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
				sendEvent: vi.fn(),
			};

			// Campaign has upfront hold
			(prisma.transaction.findFirst as any).mockResolvedValue({
				id: "tx_hold_1",
				type: "campaign_hold",
			});

			(prisma.campaign.findUnique as any).mockResolvedValue({
				failedMessages: 0,
				id: "camp_1",
				name: "Easter Invite",
				sentMessages: 1,
				status: "dispatching",
				totalMessages: 1,
			});

			(prisma.campaign.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.message.aggregate as any).mockResolvedValue({
				_sum: { costKobo: 600 },
			});

			(commitCampaignDeduction as any).mockResolvedValue({
				balanceKobo: 9400,
				heldKobo: 0,
				success: true,
			});

			const handler = (sendSingleMessage as any).fn;
			const result = await handler({
				event: {
					data: {
						campaignId: "camp_1",
						channel: "sms",
						contactName: "Ada",
						costKobo: 600,
						deliveryMode: "marketing",
						message: "Hello Ada\n\nReply STOP to opt out",
						messageId: "msg_1",
						phone: "08012345678",
						segments: 1,
						senderId: "ChurchSMS",
						userId: "user_1",
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			expect(result.success).toBe(true);
			expect(sendSmsMessage).toHaveBeenCalledWith(
				"08012345678",
				"Hello Ada\n\nReply STOP to opt out",
				{ senderId: "ChurchSMS" }
			);

			expect(commitCampaignDeduction).toHaveBeenCalledWith(
				expect.objectContaining({
					actualCostKobo: 600,
					campaignId: "camp_1",
					userId: "user_1",
				})
			);

			expect(prisma.campaign.update).toHaveBeenCalledWith({
				data: expect.objectContaining({ status: "completed" }),
				where: { id: "camp_1" },
			});
		});

		it("marks message failed and reconciles hold when onFailure hook is triggered", async () => {
			const onFailure =
				(sendSingleMessage as any).opts?.onFailure ??
				(sendSingleMessage as any).onFailure;

			expect(onFailure).toBeDefined();

			(prisma.message.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.campaign.update as any).mockResolvedValue({ id: "camp_fail_1" });
			(prisma.transaction.findFirst as any).mockResolvedValue({
				id: "tx_hold_fail",
				type: "campaign_hold",
			});
			(prisma.campaign.findUnique as any).mockResolvedValue({
				failedMessages: 1,
				id: "camp_fail_1",
				name: "Failed Campaign",
				sentMessages: 0,
				status: "dispatching",
				totalMessages: 1,
			});
			(prisma.campaign.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.message.aggregate as any).mockResolvedValue({
				_sum: { costKobo: 0 },
			});
			(commitCampaignDeduction as any).mockResolvedValue({ success: true });

			await onFailure({
				error: new Error("Termii gateway timeout after max retries"),
				event: {
					data: {
						event: {
							data: {
								campaignId: "camp_fail_1",
								messageId: "msg_fail_1",
								messageType: "sms",
								userId: "user_fail_1",
							},
						},
					},
				},
				logger: mockLogger,
			});

			expect(prisma.message.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({ status: "failed" }),
				where: {
					id: "msg_fail_1",
					status: { in: ["pending", "sending"] },
				},
			});

			expect(prisma.campaign.update).toHaveBeenCalledWith({
				data: { failedMessages: { increment: 1 } },
				where: { id: "camp_fail_1" },
			});

			expect(commitCampaignDeduction).toHaveBeenCalledWith(
				expect.objectContaining({
					actualCostKobo: 0,
					campaignId: "camp_fail_1",
					userId: "user_fail_1",
				})
			);
		});

		it("dispatches WhatsApp template message via sendTemplateMessage and records metaMessageId", async () => {
			const mockStep = {
				run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
				sendEvent: vi.fn(),
			};

			(prisma.transaction.findFirst as any).mockResolvedValue({
				id: "tx_hold_wa",
			});
			(prisma.message.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.campaign.update as any).mockResolvedValue({
				completedAt: null,
				failedMessages: 0,
				id: "camp_wa_1",
				name: "WhatsApp Campaign",
				sentMessages: 1,
				status: "completed",
				totalMessages: 1,
			});
			(prisma.campaign.findUnique as any).mockResolvedValue({
				completedAt: null,
				failedMessages: 0,
				id: "camp_wa_1",
				name: "WhatsApp Campaign",
				sentMessages: 1,
				status: "completed",
				totalMessages: 1,
			});
			(prisma.campaign.updateMany as any).mockResolvedValue({ count: 1 });
			(prisma.message.aggregate as any).mockResolvedValue({
				_sum: { costKobo: 9000 },
			});
			(commitCampaignDeduction as any).mockResolvedValue({ success: true });

			const handler = (sendSingleMessage as any).fn;
			await handler({
				event: {
					data: {
						campaignId: "camp_wa_1",
						channel: "whatsapp",
						contactId: "c1",
						messageId: "msg_wa_1",
						messageText: "Hello Ada, welcome!",
						messageType: "whatsapp_marketing",
						phone: "+2348012345678",
						recipientName: "Ada",
						totalMessages: 1,
						unitCostKobo: 9000,
						userId: "user_wa_1",
						waTemplateLanguage: "en",
						waTemplateName: "welcome_pass",
						waTemplateParams: ["Ada"],
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			expect(sendTemplateMessage).toHaveBeenCalledWith(
				"+2348012345678",
				"welcome_pass",
				"en",
				["Ada"]
			);

			expect(prisma.message.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({
					metaMessageId: "wamid.test.123",
					status: "sent",
				}),
				where: { id: "msg_wa_1", status: { not: "sent" } },
			});
		});

		it("ensures persist-result is idempotent when retried on failure", async () => {
			const mockStep = {
				run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
				sendEvent: vi.fn(),
			};

			// First execution: updateMany succeeds (count: 1)
			(prisma.message.updateMany as any).mockResolvedValueOnce({ count: 1 });
			(prisma.campaign.update as any).mockResolvedValue({ id: "camp_retry_1" });

			// Simulate failure in sending
			const sendTemplateFail = vi
				.spyOn(await import("#/lib/meta-send"), "sendTemplateMessage")
				.mockResolvedValueOnce({
					error: "Invalid recipient",
					messageId: undefined,
					success: false,
				});

			const handler = (sendSingleMessage as any).fn;
			await handler({
				event: {
					data: {
						campaignId: "camp_retry_1",
						channel: "whatsapp",
						contactId: "c1",
						messageId: "msg_retry_1",
						messageText: "Hello Ada",
						messageType: "whatsapp_marketing",
						phone: "+2348012345678",
						recipientName: "Ada",
						totalMessages: 1,
						unitCostKobo: 9000,
						userId: "user_retry_1",
						waTemplateLanguage: "en",
						waTemplateName: "welcome_pass",
						waTemplateParams: ["Ada"],
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			expect(prisma.campaign.update).toHaveBeenCalledWith({
				data: { failedMessages: { increment: 1 } },
				where: { id: "camp_retry_1" },
			});

			vi.clearAllMocks();

			// Second execution (step retry): message already failed, updateMany returns count: 0
			(prisma.message.updateMany as any).mockResolvedValueOnce({ count: 0 });
			sendTemplateFail.mockResolvedValueOnce({
				error: "Invalid recipient",
				messageId: undefined,
				success: false,
			});

			await handler({
				event: {
					data: {
						campaignId: "camp_retry_1",
						channel: "whatsapp",
						contactId: "c1",
						messageId: "msg_retry_1",
						messageText: "Hello Ada",
						messageType: "whatsapp_marketing",
						phone: "+2348012345678",
						recipientName: "Ada",
						totalMessages: 1,
						unitCostKobo: 9000,
						userId: "user_retry_1",
						waTemplateLanguage: "en",
						waTemplateName: "welcome_pass",
						waTemplateParams: ["Ada"],
					},
				},
				logger: mockLogger,
				step: mockStep,
			});

			// Campaign counter should NOT be incremented again on retry
			expect(prisma.campaign.update).not.toHaveBeenCalled();
		});
	});
});
