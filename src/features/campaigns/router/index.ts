import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { SCENARIO_SEED_TEMPLATES } from "#/features/miscellaneous/scenario";
import { invalidate, withCache } from "#/lib/cache";
import { inngest } from "#/lib/inngest/client";
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
			// We accept full contact objects from the wizard (for UI validation/preview)
			// but we only forward contact IDs to Inngest to stay well under the 256KB event limit.
			// At ~200 bytes per contact object, 1000 contacts = ~200KB — dangerously close.
			// At ~40 bytes per UUID, 1000 IDs = ~40KB — safe even at 10k contacts.
			contacts: z.array(ContactSchema).min(1),
			useCustom: z.boolean().default(false),
			customTemplate: z
				.object({ whatsapp: z.string(), sms: z.string() })
				.optional(),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
			/** User-supplied values for template variables that can't be auto-resolved (e.g. date, event, org). */
			templateVars: z.record(z.string(), z.string()).default({}),
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
					where: {
						userId,
						scenarioId: input.scenario,
						isDefault: true,
						channel: "whatsapp",
					},
					select: { bodyText: true, smsBody: true },
				}),
				context.db.messageTemplate.findFirst({
					where: {
						userId,
						scenarioId: input.scenario,
						isDefault: true,
						channel: "sms",
					},
					select: { bodyText: true, smsBody: true },
				}),
			]);

			const seedFallback = SCENARIO_SEED_TEMPLATES[input.scenario];
			template = {
				whatsapp: waRow?.bodyText ?? seedFallback.whatsapp,
				sms: smsRow?.bodyText ?? seedFallback.sms,
			};
		}

		// Fetch profile for org name — used in consent messages and as auto-resolved {{org}} var
		const profile = await context.db.userProfile.findUnique({
			where: { userId },
			select: { orgName: true },
		});
		const orgName = profile?.orgName ?? "MessageDesk";

		// Merge auto-resolved server vars with user-supplied vars.
		// Server-side values win over anything the user typed for org/orgName.
		const resolvedTemplateVars: Record<string, string> = {
			...input.templateVars,
			org: orgName,
			orgName,
			org_name: orgName,
		};

		const campaignId = uuidv4();

		await context.db.campaign.create({
			data: {
				id: campaignId,
				userId,
				scenario: input.scenario,
				status: "pending",
				deliveryMode: input.deliveryMode,
				whatsappTemplate: template.whatsapp,
				smsTemplate: template.sms,
				useCustomTemplate: input.useCustom,
				totalMessages: input.contacts.length,
			},
		});

		// Extract only IDs — Inngest functions fetch full contact data from DB.
		// This keeps event payloads tiny regardless of how many contacts are selected.
		const contactIds = input.contacts.map((c) => c.id);

		// ── Branch by delivery mode ───────────────────────────────────────────────
		if (input.deliveryMode === "utility_prescreen") {
			await inngest.send({
				name: "neon/campaign.prescreen",
				data: {
					campaignId,
					userId,
					orgName,
					contactIds,
					realWhatsappMessage: template.whatsapp,
					realSmsMessage: template.sms,
					scenario: input.scenario,
					templateVars: resolvedTemplateVars,
				},
			});
		} else {
			await inngest.send({
				name: "neon/campaign.send",
				data: {
					campaignId,
					userId,
					contactIds,
					// For sms_fallback we tell Inngest to force SMS channel when fetching
					forceSmsChannel: input.deliveryMode === "sms_fallback",
					whatsappTemplate: template.whatsapp,
					smsTemplate: template.sms,
					scenario: input.scenario,
					templateVars: resolvedTemplateVars,
				},
			});
		}

		invalidate(userId, "campaign.list");
		return {
			campaignId,
			totalQueued: input.contacts.length,
			message: "Campaign queued.",
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
			where: { id: input.campaignId },
			select: {
				id: true,
				userId: true,
				status: true,
				scenario: true,
				totalMessages: true,
				sentMessages: true,
				failedMessages: true,
				createdAt: true,
				completedAt: true,
			},
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
				where: { campaignId: input.campaignId },
				orderBy: { createdAt: "asc" },
				skip: (input.messagesPage - 1) * input.messagesPageSize,
				take: input.messagesPageSize,
				select: {
					id: true,
					contactName: true,
					phone: true,
					channel: true,
					message: true,
					status: true,
					metaMessageId: true,
					errorMessage: true,
					sentAt: true,
					deliveredAt: true,
				},
			}),
			context.db.message.count({ where: { campaignId: input.campaignId } }),
		]);

		return {
			campaignId: campaign.id,
			status: campaign.status,
			scenario: campaign.scenario,
			total: campaign.totalMessages,
			sent: campaign.sentMessages,
			failed: campaign.failedMessages,
			createdAt: campaign.createdAt,
			completedAt: campaign.completedAt,
			messages: messages.map((m) => ({
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
			messagesPagination: {
				total: totalMessages,
				page: input.messagesPage,
				pageSize: input.messagesPageSize,
				totalPages: Math.ceil(totalMessages / input.messagesPageSize),
			},
		};
	});

export const listCampaigns = protectedProcedure
	.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
	.handler(
		withCache("campaign.list", 15_000, async ({ input, context }) => {
			const rows = await context.db.campaign.findMany({
				where: { userId: context.session?.user.id ?? "" },
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
		})
	);
