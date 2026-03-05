import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
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
	"request",
	"general",
]);

export const sendCampaign = protectedProcedure
	.input(
		z.object({
			scenario: ScenarioSchema,
			contacts: z.array(ContactSchema).min(1),
			useCustom: z.boolean().default(false),
			customTemplate: z
				.object({ whatsapp: z.string(), sms: z.string() })
				.optional(),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const template =
			input.useCustom && input.customTemplate
				? input.customTemplate
				: getTemplate(input.scenario);

		// Fetch org name for pre-screen consent message ("X wants to send you a message")
		const profile =
			input.deliveryMode === "utility_prescreen"
				? await context.db.userProfile.findUnique({
						where: { userId },
						select: { orgName: true },
					})
				: null;
		const orgName = profile?.orgName ?? "MessageDesk";

		const campaignId = uuidv4();

		await context.db.campaign.create({
			data: {
				id: campaignId,
				userId,
				scenario: input.scenario,
				status: "pending",
				deliveryMode: input.deliveryMode,
				whatsappTemplate: template?.whatsapp ?? "",
				smsTemplate: template?.sms ?? "",
				useCustomTemplate: input.useCustom,
				totalMessages: input.contacts.length,
			},
		});

		// ── Branch by delivery mode ───────────────────────────────────────────────
		if (input.deliveryMode === "utility_prescreen") {
			// Cheap utility consent message first — real message only sent after YES reply
			await inngest.send({
				name: "neon/campaign.prescreen",
				data: {
					campaignId,
					userId,
					orgName,
					contacts: input.contacts,
					realWhatsappMessage: template?.whatsapp ?? "",
					realSmsMessage: template?.sms ?? "",
					scenario: input.scenario,
				},
			});
		} else {
			// Standard (marketing) or sms_fallback — direct send
			// sms_fallback contacts have channel="whatsapp" in DB but we force SMS delivery
			const contacts =
				input.deliveryMode === "sms_fallback"
					? input.contacts.map((c) => ({ ...c, channel: "sms" as const }))
					: input.contacts;

			await inngest.send({
				name: "neon/campaign.send",
				data: {
					campaignId,
					userId,
					contacts,
					whatsappTemplate: template?.whatsapp ?? "",
					smsTemplate: template?.sms ?? "",
					scenario: input.scenario,
				},
			});
		}

		return {
			campaignId,
			totalQueued: input.contacts.length,
			message: "Campaign queued.",
		};
	});

export const getCampaignStatus = protectedProcedure
	.input(z.object({ campaignId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const campaign = await context.db.campaign.findUnique({
			where: { id: input.campaignId },
			include: { messages: { orderBy: { createdAt: "asc" } } },
		});
		if (!campaign) {
			throw new Error(`Campaign ${input.campaignId} not found`);
		}
		// Ensure user can only see their own campaigns
		if (campaign.userId !== context.session.user.id) {
			throw new Error("Not found");
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
				externalId: m.metaMessageId,
				errorMessage: m.errorMessage,
				sentAt: m.sentAt,
				deliveredAt: m.deliveredAt,
			})),
		};
	});

export const listCampaigns = protectedProcedure
	.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
	.handler(async ({ input, context }) => {
		const rows = await context.db.campaign.findMany({
			where: { userId: context.session.user.id },
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
