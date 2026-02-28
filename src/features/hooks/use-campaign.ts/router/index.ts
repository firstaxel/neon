import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { prisma } from "#/db";
import { inngest } from "#/lib/inngest/client";
import { getTemplate } from "#/lib/scenarios";
import { protectedProcedure } from "#/orpc";

const ContactSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	phone: z.string().min(7),
	channel: z.enum(["whatsapp", "sms"]),
	type: z.string(),
});

const ScenarioSchema = z.enum([
	"first_timer",
	"follow_up",
	"event_invite",
	"prayer_request",
	"general",
]);

// ─── Procedures ───────────────────────────────────────────────────────────────

/**
 * sendCampaign
 *
 * Creates a Campaign row in Postgres then triggers the Inngest fan-out
 * orchestrator. Returns campaignId instantly; caller polls getCampaignStatus.
 */
export const sendCampaign = protectedProcedure
	.input(
		z.object({
			scenario: ScenarioSchema,
			contacts: z.array(ContactSchema).min(1),
			useCustom: z.boolean().default(false),
			customTemplate: z
				.object({ whatsapp: z.string(), sms: z.string() })
				.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const template =
			input.useCustom && input.customTemplate
				? input.customTemplate
				: getTemplate(input.scenario);

		if (!template) {
			throw new Error(`Template not found for scenario: ${input.scenario}`);
		}

		const campaignId = uuidv4();

		// 1. Create Campaign row via Prisma
		await prisma.campaign.create({
			data: {
				id: campaignId,
				scenario: input.scenario,
				status: "pending",
				whatsappTemplate: template.whatsapp,
				smsTemplate: template.sms,
				useCustomTemplate: input.useCustom,
				totalMessages: input.contacts.length,
				createdBy: context.session.user.id,
			},
		});

		// 2. Fire Inngest orchestrator
		await inngest.send({
			name: "neon/campaign.send",
			data: {
				campaignId,
				contacts: input.contacts,
				whatsappTemplate: template.whatsapp ?? "",
				smsTemplate: template.sms,
				scenario: input.scenario,
				createdBy: context.session.user.id,
			},
		});

		return {
			campaignId,
			totalQueued: input.contacts.length,
			message: "Campaign queued. Poll getCampaignStatus for live progress.",
		};
	});

/**
 * getCampaignStatus
 *
 * Polling endpoint for live campaign progress.
 * Returns campaign summary + all per-message statuses from Postgres.
 */
export const getCampaignStatus = protectedProcedure
	.input(z.object({ campaignId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const campaign = await prisma.campaign.findUnique({
			where: { id: input.campaignId },
			include: {
				messages: { orderBy: { createdAt: "asc" } },
			},
		});

		if (!campaign) {
			throw new Error(`Campaign ${input.campaignId} not found`);
		}

		return {
			campaignId: campaign.id,
			status: campaign.status,
			scenario: campaign.scenario,
			total: campaign.totalMessages,
			sent: campaign.sentMessages,
			failed: campaign.failedMessages,
			createdAt: campaign.createdAt,
			completedAt: campaign.completedAt,
			messages: campaign.messages.map((m) => ({
				id: m.id,
				contactName: m.contactName,
				phone: m.phone,
				channel: m.channel,
				message: m.message,
				status: m.status,
				twilioSid: m.twilioSid,
				errorMessage: m.errorMessage,
				sentAt: m.sentAt,
			})),
		};
	});

/**
 * listCampaigns
 *
 * Returns recent campaigns with summary stats — for an admin history view.
 */
export const listCampaigns = protectedProcedure
	.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
	.handler(async ({ input }) => {
		const rows = await prisma.campaign.findMany({
			orderBy: { createdAt: "desc" },
			take: input.limit,
			select: {
				id: true,
				scenario: true,
				status: true,
				totalMessages: true,
				sentMessages: true,
				failedMessages: true,
				createdAt: true,
				completedAt: true,
			},
		});

		return rows.map((c) => ({
			id: c.id,
			scenario: c.scenario,
			status: c.status,
			total: c.totalMessages,
			sent: c.sentMessages,
			failed: c.failedMessages,
			createdAt: c.createdAt,
			completedAt: c.completedAt,
		}));
	});
