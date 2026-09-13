import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cancelScheduledCampaign,
	createSmsCampaign,
	createWhatsappCampaign,
	estimateCost,
	estimateWhatsappCost,
} from "./index";

vi.mock("#/features/billing/utils", () => ({
	holdCampaignFunds: vi.fn(),
	releaseCampaignHold: vi.fn(),
}));

vi.mock("#/lib/inngest/client", () => ({
	inngest: {
		send: vi.fn(),
	},
}));

vi.mock("#/lib/cache", () => ({
	invalidate: vi.fn(),
	withCache: (_prefix: string, _ttl: number, fn: any) => fn,
}));

import {
	holdCampaignFunds,
	releaseCampaignHold,
} from "#/features/billing/utils";
import { inngest } from "#/lib/inngest/client";

const INSUFFICIENT_BALANCE_REGEX = /Insufficient wallet balance/;
const DISPATCHING_STATUS_REGEX =
	/Campaign cannot be cancelled in 'dispatching' status/;

describe("Campaigns router SMS and WhatsApp campaign wizard and dispatch", () => {
	const mockDb = {
		campaign: {
			create: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			updateMany: vi.fn(),
		},
		contact: {
			findMany: vi.fn(),
		},
		messageTemplate: {
			findFirst: vi.fn(),
		},
		userProfile: {
			findUnique: vi.fn(),
		},
		wallet: {
			findUnique: vi.fn(),
		},
	};

	const mockContext = {
		db: mockDb as any,
		session: {
			user: {
				email: "pastor@velocast.ng",
				id: "user_test_campaign",
			},
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("estimateCost (AC-1, AC-4, AC-5)", () => {
		it("deduplicates contacts by Nigerian E.164 phone numbers and filters out opted out contacts", async () => {
			mockDb.contact.findMany.mockResolvedValue([
				{
					id: "c1",
					name: "Ada",
					optedOut: false,
					phone: "08012345678", // Nigerian local format
				},
				{
					id: "c2",
					name: "Ada Duplicate",
					optedOut: false,
					phone: "2348012345678", // Same phone number in E.164 without plus
				},
				{
					id: "c3",
					name: "Chidi",
					optedOut: false,
					phone: "+2348098765432",
				},
				{
					id: "c4",
					name: "Opted Out Contact",
					optedOut: true,
					phone: "08055555555",
				},
			]);

			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
			});

			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 50_000,
				heldKobo: 10_000, // available: 40,000 kobo
			});

			const result = await call(
				estimateCost,
				{
					contactIds: ["c1", "c2", "c3", "c4"],
					messageText: "Hello {{name}}, join our Sunday service at {{org}}.",
				},
				{ context: mockContext }
			);

			// 4 contacts in DB, but 1 is duplicate phone and 1 is opted out -> 2 unique contacts
			expect(result.totalContacts).toBe(2);
			expect(result.encoding).toBe("GSM_7");
			expect(result.baseSegments).toBe(1);
			expect(result.costPerSegmentKobo).toBe(600);
			// 2 contacts * 1 segment * 600 kobo = 1,200 kobo
			expect(result.totalEstimatedCostKobo).toBe(1200);
			expect(result.availableBalanceKobo).toBe(40_000);
			expect(result.sufficientBalance).toBe(true);
		});

		it("reports sufficientBalance as false when spendable balance is less than estimated cost", async () => {
			mockDb.contact.findMany.mockResolvedValue([
				{ id: "c1", name: "Ada", optedOut: false, phone: "08011112222" },
			]);

			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
			});

			// Available balance = 500 kobo, cost is 600 kobo
			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 1500,
				heldKobo: 1000,
			});

			const result = await call(
				estimateCost,
				{
					contactIds: ["c1"],
					messageText: "Test announcement",
				},
				{ context: mockContext }
			);

			expect(result.totalContacts).toBe(1);
			expect(result.totalEstimatedCostKobo).toBe(600);
			expect(result.availableBalanceKobo).toBe(500);
			expect(result.sufficientBalance).toBe(false);
		});
	});

	describe("createSmsCampaign (AC-1, AC-5, AC-6, AC-7)", () => {
		it("places a two-phase wallet hold and creates campaign in pending status with scheduledAt", async () => {
			mockDb.contact.findMany.mockResolvedValue([
				{ id: "c1", name: "Ada", optedOut: false, phone: "08012345678" },
				{ id: "c2", name: "Emeka", optedOut: false, phone: "08023456789" },
			]);

			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
				senderId: "GraceCh",
			});

			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 100_000,
				heldKobo: 0,
			});

			(holdCampaignFunds as any).mockResolvedValue({
				balanceKobo: 100_000,
				heldKobo: 1200,
				success: true,
			});

			mockDb.campaign.create.mockResolvedValue({ id: "camp_123" });

			const scheduledTime = new Date(Date.now() + 86_400_000).toISOString();

			const result = await call(
				createSmsCampaign,
				{
					contactIds: ["c1", "c2"],
					messageText: "Hello {{name}}! Welcome to church.",
					name: "Youth Outreach",
					scenario: "first_timer",
					scheduledAt: scheduledTime,
				},
				{ context: mockContext }
			);

			expect(result.status).toBe("pending");
			expect(result.totalMessages).toBe(2);
			expect(result.heldKobo).toBe(1200);
			expect(result.scheduledAt).toBe(scheduledTime);

			expect(holdCampaignFunds).toHaveBeenCalledWith(
				expect.objectContaining({
					amountKobo: 1200,
					description: "Campaign hold: Youth Outreach",
					userId: "user_test_campaign",
				})
			);

			expect(mockDb.campaign.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					deliveryMode: "marketing",
					estimatedCostKobo: 1200,
					name: "Youth Outreach",
					scenario: "first_timer",
					status: "pending",
					totalMessages: 2,
					userId: "user_test_campaign",
				}),
			});

			expect(inngest.send).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						forceSmsChannel: true,
						scenario: "first_timer",
						scheduledAt: scheduledTime,
						userId: "user_test_campaign",
					}),
					name: "Velocast/campaign.send",
				})
			);
		});

		it("throws an error when spendable balance is insufficient to cover estimated cost", async () => {
			mockDb.contact.findMany.mockResolvedValue([
				{ id: "c1", name: "Ada", optedOut: false, phone: "08012345678" },
			]);

			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
			});

			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 400,
				heldKobo: 0,
			});

			await expect(
				call(
					createSmsCampaign,
					{
						contactIds: ["c1"],
						messageText: "Hello {{name}}",
						scenario: "general",
					},
					{ context: mockContext }
				)
			).rejects.toThrow(INSUFFICIENT_BALANCE_REGEX);

			expect(holdCampaignFunds).not.toHaveBeenCalled();
			expect(mockDb.campaign.create).not.toHaveBeenCalled();
		});

		it("releases wallet hold and marks campaign failed if inngest.send throws an error", async () => {
			mockDb.contact.findMany.mockResolvedValue([
				{ id: "c1", name: "Ada", optedOut: false, phone: "08012345678" },
			]);
			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
			});
			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 10_000,
				heldKobo: 0,
			});
			(holdCampaignFunds as any).mockResolvedValue({
				balanceKobo: 10_000,
				heldKobo: 600,
				success: true,
			});
			mockDb.campaign.create.mockResolvedValue({ id: "camp_fail_send" });
			mockDb.campaign.updateMany.mockResolvedValue({ count: 1 });

			(inngest.send as any).mockRejectedValueOnce(
				new Error("Inngest network connection refused")
			);

			await expect(
				call(
					createSmsCampaign,
					{
						contactIds: ["c1"],
						messageText: "Hello {{name}}",
						scenario: "general",
					},
					{ context: mockContext }
				)
			).rejects.toThrow("Inngest network connection refused");

			expect(releaseCampaignHold).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: "Failed to dispatch campaign send event",
					userId: "user_test_campaign",
				})
			);
			expect(mockDb.campaign.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({ status: "failed" }),
				where: { id: expect.any(String) },
			});
		});
	});

	describe("cancelScheduledCampaign (AC-8)", () => {
		it("cancels a pending scheduled campaign and releases held balance", async () => {
			mockDb.campaign.findUnique.mockResolvedValue({
				id: "camp_scheduled_1",
				scheduledAt: new Date(Date.now() + 3_600_000),
				status: "pending",
				userId: "user_test_campaign",
			});

			mockDb.campaign.updateMany.mockResolvedValue({ count: 1 });

			(releaseCampaignHold as any).mockResolvedValue({
				heldKobo: 0,
				unspentReleasedKobo: 1200,
			});

			const result = await call(
				cancelScheduledCampaign,
				{
					campaignId: "123e4567-e89b-12d3-a456-426614174000",
				},
				{ context: mockContext }
			);

			expect(result.status).toBe("cancelled");
			expect(result.releasedKobo).toBe(1200);

			expect(mockDb.campaign.updateMany).toHaveBeenCalledWith({
				data: expect.objectContaining({ status: "cancelled" }),
				where: {
					id: "123e4567-e89b-12d3-a456-426614174000",
					status: "pending",
					userId: "user_test_campaign",
				},
			});

			expect(releaseCampaignHold).toHaveBeenCalledWith(
				expect.objectContaining({
					campaignId: "123e4567-e89b-12d3-a456-426614174000",
					reason: "Scheduled campaign cancelled by user",
					userId: "user_test_campaign",
				})
			);
		});

		it("rejects cancellation if the campaign is not in pending status", async () => {
			mockDb.campaign.findUnique.mockResolvedValue({
				id: "camp_dispatching_1",
				status: "dispatching",
				userId: "user_test_campaign",
			});

			await expect(
				call(
					cancelScheduledCampaign,
					{
						campaignId: "123e4567-e89b-12d3-a456-426614174000",
					},
					{ context: mockContext }
				)
			).rejects.toThrow(DISPATCHING_STATUS_REGEX);

			expect(releaseCampaignHold).not.toHaveBeenCalled();
		});
	});

	describe("estimateWhatsappCost", () => {
		const templateId = "a0000000-0000-0000-0000-000000000001";

		it("rejects WhatsApp templates that are not approved by Meta", async () => {
			mockDb.messageTemplate.findFirst.mockResolvedValue({
				id: templateId,
				name: "pending_template",
				status: "PENDING",
				userId: "user_test_campaign",
			});

			await expect(
				call(
					estimateWhatsappCost,
					{
						channelTarget: "whatsapp",
						contactIds: ["c1"],
						templateId,
					},
					{ context: mockContext }
				)
			).rejects.toThrow(/Only approved WhatsApp templates can be used/);
		});

		it("calculates 9000 kobo per recipient for pure WhatsApp campaigns", async () => {
			mockDb.messageTemplate.findFirst.mockResolvedValue({
				bodyText: "Hello {{1}}, welcome to our event!",
				id: templateId,
				name: "approved_template",
				status: "APPROVED",
				userId: "user_test_campaign",
			});

			mockDb.contact.findMany.mockResolvedValue([
				{
					channel: "whatsapp",
					id: "c1",
					name: "Ada",
					optedOut: false,
					phone: "+2348012345678",
				},
				{
					channel: "whatsapp",
					id: "c2",
					name: "Chidi",
					optedOut: false,
					phone: "+2348098765432",
				},
			]);

			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 50_000,
				heldKobo: 0,
			});

			const result = await call(
				estimateWhatsappCost,
				{
					channelTarget: "whatsapp",
					contactIds: ["c1", "c2"],
					templateId,
				},
				{ context: mockContext }
			);

			expect(result.whatsappContactsCount).toBe(2);
			expect(result.smsContactsCount).toBe(0);
			expect(result.whatsappCostKobo).toBe(18_000);
			expect(result.totalEstimatedCostKobo).toBe(18_000);
			expect(result.sufficientBalance).toBe(true);
		});

		it("calculates blended cost for Smart Multi Channel mode with WhatsApp and SMS contacts", async () => {
			mockDb.messageTemplate.findFirst.mockResolvedValue({
				bodyText: "Hello {{1}}",
				id: templateId,
				name: "smart_template",
				smsBody: "Fallback SMS text",
				status: "APPROVED",
				userId: "user_test_campaign",
			});

			mockDb.contact.findMany.mockResolvedValue([
				{
					channel: "whatsapp",
					id: "c1",
					name: "Ada",
					optedOut: false,
					phone: "+2348012345678",
				},
				{
					channel: "sms",
					id: "c2",
					name: "Bayo",
					optedOut: false,
					phone: "+2348099998888",
				},
			]);

			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
			});

			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 20_000,
				heldKobo: 0,
			});

			const result = await call(
				estimateWhatsappCost,
				{
					channelTarget: "smart",
					contactIds: ["c1", "c2"],
					smsText: "Hello Bayo from Grace Chapel",
					templateId,
				},
				{ context: mockContext }
			);

			expect(result.whatsappContactsCount).toBe(1);
			expect(result.smsContactsCount).toBe(1);
			expect(result.whatsappCostKobo).toBe(9000);
			expect(result.smsCostKobo).toBe(600);
			expect(result.totalEstimatedCostKobo).toBe(9600);
			expect(result.sufficientBalance).toBe(true);
		});
	});

	describe("createWhatsappCampaign", () => {
		const templateId = "b0000000-0000-0000-0000-000000000002";

		it("rejects creation if any required positional parameter mapping is missing", async () => {
			mockDb.messageTemplate.findFirst.mockResolvedValue({
				bodyText: "Hello {{1}}, your seat number is {{2}}",
				id: templateId,
				language: "en",
				name: "event_pass",
				status: "APPROVED",
				userId: "user_test_campaign",
			});

			await expect(
				call(
					createWhatsappCampaign,
					{
						channelTarget: "whatsapp",
						contactIds: ["c1"],
						templateId,
						templateParams: {
							"1": "Ada",
						},
					},
					{ context: mockContext }
				)
			).rejects.toThrow(/Missing parameter mapping for \{\{2\}\}/);
		});

		it("creates campaign, places balance hold, and sends Inngest event", async () => {
			mockDb.messageTemplate.findFirst.mockResolvedValue({
				bodyText: "Hello {{1}}, welcome!",
				id: templateId,
				language: "en",
				name: "welcome_pass",
				status: "APPROVED",
				userId: "user_test_campaign",
			});

			mockDb.contact.findMany.mockResolvedValue([
				{
					channel: "whatsapp",
					id: "c1",
					name: "Ada",
					optedOut: false,
					phone: "+2348012345678",
				},
			]);

			mockDb.userProfile.findUnique.mockResolvedValue({
				orgName: "Grace Chapel",
				senderId: "ChurchSMS",
			});

			mockDb.wallet.findUnique.mockResolvedValue({
				balanceKobo: 50_000,
				heldKobo: 0,
			});

			mockDb.campaign.create.mockResolvedValue({
				id: "camp_wa_1",
			});

			(holdCampaignFunds as any).mockResolvedValue({
				heldKobo: 9000,
			});

			const result = await call(
				createWhatsappCampaign,
				{
					channelTarget: "whatsapp",
					contactIds: ["c1"],
					name: "Sunday Service Welcome",
					templateId,
					templateParams: {
						"1": "name",
					},
				},
				{ context: mockContext }
			);

			expect(result.status).toBe("pending");
			expect(result.heldKobo).toBe(9000);
			expect(result.totalMessages).toBe(1);

			expect(mockDb.campaign.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					channelTarget: "whatsapp",
					estimatedCostKobo: 9000,
					templateId,
					waTemplateLanguage: "en",
					waTemplateName: "welcome_pass",
				}),
			});

			expect(holdCampaignFunds).toHaveBeenCalledWith({
				amountKobo: 9000,
				campaignId: expect.any(String),
				description: "Campaign hold: Sunday Service Welcome",
				userId: "user_test_campaign",
			});

			expect(inngest.send).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						channelTarget: "whatsapp",
						templateId,
						waTemplateLanguage: "en",
						waTemplateName: "welcome_pass",
					}),
					name: "Velocast/campaign.send",
				})
			);
		});
	});
});
