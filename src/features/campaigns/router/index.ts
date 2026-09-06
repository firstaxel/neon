import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { SCENARIO_SEED_TEMPLATES } from "#/features/miscellaneous/scenario";
import { invalidate, withCache } from "#/lib/cache";
import { inngest } from "#/lib/inngest/client";
import { protectedProcedure } from "#/orpc";

const ContactSchema = z.object({
	channel: z.enum(["whatsapp", "sms"]),
	id: z.string(),
	name: z.string().min(1),
	phone: z.string().min(7),
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
			// We accept full contact objects from the wizard (for UI validation/preview)
			// but we only forward contact IDs to Inngest to stay well under the 256KB event limit.
			// At ~200 bytes per contact object, 1000 contacts = ~200KB — dangerously close.
			// At ~40 bytes per UUID, 1000 IDs = ~40KB — safe even at 10k contacts.
			contacts: z.array(ContactSchema).min(1),
			customTemplate: z
				.object({ sms: z.string(), whatsapp: z.string() })
				.optional(),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
			scenario: ScenarioSchema,
			/** User-supplied values for template variables that can't be auto-resolved (e.g. date, event, org). */
			templateVars: z.record(z.string(), z.string()).default({}),
			useCustom: z.boolean().default(false),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		// Resolve template: DB default first, then seed fallback.
		// Users own their templates post-onboarding and can edit them freely.
		let template: { whatsapp: string; sms: string };

		if (input.useCustom && input.customTemplate) {
			template = input.customTemplate;
		} else {
			// Look up the user's saved default for this scenario
			const [waRow, smsRow] = await Promise.all([
				context.db.messageTemplate.findFirst({
					select: { bodyText: true, smsBody: true },
					where: {
						channel: "whatsapp",
						isDefault: true,
						scenarioId: input.scenario,
						userId,
					},
				}),
				context.db.messageTemplate.findFirst({
					select: { bodyText: true, smsBody: true },
					where: {
						channel: "sms",
						isDefault: true,
						scenarioId: input.scenario,
						userId,
					},
				}),
			]);

			const seedFallback = SCENARIO_SEED_TEMPLATES[input.scenario];
			template = {
				sms: smsRow?.bodyText ?? seedFallback.sms,
				whatsapp: waRow?.bodyText ?? seedFallback.whatsapp,
			};
		}

		// Fetch profile for org name — used in consent messages and as auto-resolved {{org}} var
		const profile = await context.db.userProfile.findUnique({
			select: { orgName: true },
			where: { userId },
		});
		const orgName = profile?.orgName ?? "Velocast";

		// Merge auto-resolved server vars with user-supplied vars.
		// Server-side values win over anything the user typed for org/orgName.
		const resolvedTemplateVars: Record<string, string> = {
			...input.templateVars,
			org: orgName,
			org_name: orgName,
			orgName,
		};

		const campaignId = uuidv4();

		await context.db.campaign.create({
			data: {
				deliveryMode: input.deliveryMode,
				id: campaignId,
				scenario: input.scenario,
				smsTemplate: template.sms,
				status: "pending",
				totalMessages: input.contacts.length,
				useCustomTemplate: input.useCustom,
				userId,
				whatsappTemplate: template.whatsapp,
			},
		});

		// Extract only IDs — Inngest functions fetch full contact data from DB.
		// This keeps event payloads tiny regardless of how many contacts are selected.
		const contactIds = input.contacts.map((c) => c.id);

		// ── Branch by delivery mode ───────────────────────────────────────────────
		if (input.deliveryMode === "utility_prescreen") {
			await inngest.send({
				data: {
					campaignId,
					contactIds,
					orgName,
					realSmsMessage: template.sms,
					realWhatsappMessage: template.whatsapp,
					scenario: input.scenario,
					templateVars: resolvedTemplateVars,
					userId,
				},
				name: "Velocast/campaign.prescreen",
			});
		} else {
			await inngest.send({
				data: {
					campaignId,
					contactIds,
					// For sms_fallback we tell Inngest to force SMS channel when fetching
					forceSmsChannel: input.deliveryMode === "sms_fallback",
					scenario: input.scenario,
					smsTemplate: template.sms,
					templateVars: resolvedTemplateVars,
					userId,
					whatsappTemplate: template.whatsapp,
				},
				name: "Velocast/campaign.send",
			});
		}

		invalidate(userId, "campaign.list");
		return {
			campaignId,
			message: "Campaign queued.",
			totalQueued: input.contacts.length,
		};
	});

export const getCampaignStatus = protectedProcedure
	.input(
		z.object({
			campaignId: z.string().uuid(),
			messagesPage: z.number().int().min(1).default(1),
			messagesPageSize: z.number().int().min(1).max(200).default(100),
		})
	)
	.handler(async ({ input, context }) => {
		const campaign = await context.db.campaign.findUnique({
			select: {
				completedAt: true,
				createdAt: true,
				failedMessages: true,
				id: true,
				scenario: true,
				sentMessages: true,
				status: true,
				totalMessages: true,
				userId: true,
			},
			where: { id: input.campaignId },
		});
		if (!campaign) {
			throw new Error(`Campaign ${input.campaignId} not found`);
		}
		if (campaign.userId !== context.session.user.id) {
			throw new Error("Not found");
		}

		// Paginate messages — never load all rows unbounded (a 10k campaign = 10k rows in RAM)
		const [messages, totalMessages] = await Promise.all([
			context.db.message.findMany({
				orderBy: { createdAt: "asc" },
				select: {
					channel: true,
					contactName: true,
					deliveredAt: true,
					errorMessage: true,
					id: true,
					message: true,
					metaMessageId: true,
					phone: true,
					sentAt: true,
					status: true,
				},
				skip: (input.messagesPage - 1) * input.messagesPageSize,
				take: input.messagesPageSize,
				where: { campaignId: input.campaignId },
			}),
			context.db.message.count({ where: { campaignId: input.campaignId } }),
		]);

		return {
			campaignId: campaign.id,
			completedAt: campaign.completedAt,
			createdAt: campaign.createdAt,
			failed: campaign.failedMessages,
			messages: messages.map((m) => ({
				channel: m.channel,
				contactName: m.contactName,
				deliveredAt: m.deliveredAt,
				errorMessage: m.errorMessage,
				externalId: m.metaMessageId,
				id: m.id,
				message: m.message,
				phone: m.phone,
				sentAt: m.sentAt,
				status: m.status,
			})),
			messagesPagination: {
				page: input.messagesPage,
				pageSize: input.messagesPageSize,
				total: totalMessages,
				totalPages: Math.ceil(totalMessages / input.messagesPageSize),
			},
			scenario: campaign.scenario,
			sent: campaign.sentMessages,
			status: campaign.status,
			total: campaign.totalMessages,
		};
	});

export const listCampaigns = protectedProcedure
	.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
	.handler(
		withCache("campaign.list", 15_000, async ({ input, context }) => {
			const rows = await context.db.campaign.findMany({
				orderBy: { createdAt: "desc" },
				select: {
					completedAt: true,
					createdAt: true,
					failedMessages: true,
					id: true,
					scenario: true,
					sentMessages: true,
					status: true,
					totalMessages: true,
				},
				take: input.limit,
				where: { userId: context.session?.user.id ?? "" },
			});
			return rows.map((c) => ({
				completedAt: c.completedAt,
				createdAt: c.createdAt,
				failed: c.failedMessages,
				id: c.id,
				scenario: c.scenario,
				sent: c.sentMessages,
				status: c.status,
				total: c.totalMessages,
			}));
		})
	);
