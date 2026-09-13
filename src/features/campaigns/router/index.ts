import { ORPCError } from "@orpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
	holdCampaignFunds,
	releaseCampaignHold,
} from "#/features/billing/utils";
import { normalizePhoneNumber } from "#/features/contacts/utils/phone";
import { SCENARIO_SEED_TEMPLATES } from "#/features/miscellaneous/scenario";
import type { PrismaClient } from "#/generated/prisma/client";
import { invalidate, withCache } from "#/lib/cache";
import { inngest } from "#/lib/inngest/client";
import { calculateMaxSegmentsForAudience } from "#/lib/sms";
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

/**
 * Resolves audience contacts for a campaign or estimate.
 * Automatically deduplicates recipients by normalized Nigerian E.164 phone numbers
 * and filters out contacts who have opted out.
 */
async function resolveAudienceContacts(
	db: PrismaClient,
	userId: string,
	contactIds?: string[],
	audienceFilter?: { tagIds?: string[]; all?: boolean }
): Promise<Array<{ id: string; name: string; phone: string }>> {
	let rows: Array<{
		id: string;
		name: string;
		optedOut: boolean;
		phone: string;
	}> = [];

	if (contactIds && contactIds.length > 0) {
		rows = await db.contact.findMany({
			select: { id: true, name: true, optedOut: true, phone: true },
			where: {
				id: { in: contactIds },
				uploadedBy: userId,
			},
		});
	} else if (audienceFilter?.tagIds && audienceFilter.tagIds.length > 0) {
		rows = await db.contact.findMany({
			select: { id: true, name: true, optedOut: true, phone: true },
			where: {
				tags: { hasSome: audienceFilter.tagIds },
				uploadedBy: userId,
			},
		});
	} else if (audienceFilter?.all) {
		rows = await db.contact.findMany({
			select: { id: true, name: true, optedOut: true, phone: true },
			where: {
				uploadedBy: userId,
			},
		});
	}

	const active = rows.filter((c) => !c.optedOut);

	const seenPhones = new Set<string>();
	const deduplicated: Array<{ id: string; name: string; phone: string }> = [];

	for (const contact of active) {
		const norm = normalizePhoneNumber(contact.phone);
		const canonicalPhone =
			norm.success && norm.phone
				? norm.phone
				: contact.phone.replace(/\D/g, "");
		if (!seenPhones.has(canonicalPhone)) {
			seenPhones.add(canonicalPhone);
			deduplicated.push(contact);
		}
	}

	return deduplicated;
}

export const estimateCost = protectedProcedure
	.input(
		z.object({
			audienceFilter: z
				.object({
					all: z.boolean().optional(),
					tagIds: z.array(z.string()).optional(),
				})
				.optional(),
			contactIds: z.array(z.string()).optional(),
			messageText: z.string().min(1),
			templateVars: z.record(z.string(), z.string()).default({}),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const contacts = await resolveAudienceContacts(
			context.db,
			userId,
			input.contactIds,
			input.audienceFilter
		);

		const profile = await context.db.userProfile.findUnique({
			select: { orgName: true },
			where: { userId },
		});
		const orgName = profile?.orgName ?? "Velocast";
		const resolvedTemplateVars: Record<string, string> = {
			...input.templateVars,
			org: orgName,
			org_name: orgName,
			orgName,
		};

		const audienceCalc = calculateMaxSegmentsForAudience({
			contacts,
			template: input.messageText,
			templateVars: resolvedTemplateVars,
		});

		const wallet = await context.db.wallet.findUnique({
			select: { balanceKobo: true, heldKobo: true },
			where: { userId },
		});

		const availableBalanceKobo =
			(wallet?.balanceKobo ?? 0) - (wallet?.heldKobo ?? 0);
		const { totalEstimatedCostKobo } = audienceCalc;
		const sufficientBalance = availableBalanceKobo >= totalEstimatedCostKobo;

		return {
			availableBalanceKobo,
			baseSegments: audienceCalc.baseCalculation.segments,
			characterCount: audienceCalc.baseCalculation.totalCharacterCount,
			costPerSegmentKobo: audienceCalc.baseCalculation.costPerSegmentKobo,
			encoding: audienceCalc.baseCalculation.encoding,
			maxSegments: audienceCalc.maxSegments,
			sufficientBalance,
			totalContacts: contacts.length,
			totalEstimatedCostKobo,
		};
	});

export const createSmsCampaign = protectedProcedure
	.input(
		z.object({
			audienceFilter: z
				.object({
					all: z.boolean().optional(),
					tagIds: z.array(z.string()).optional(),
				})
				.optional(),
			contactIds: z.array(z.string()).optional(),
			messageText: z.string().min(1),
			name: z.string().optional(),
			scenario: ScenarioSchema,
			scheduledAt: z.string().datetime().optional().nullable(),
			senderId: z.string().optional(),
			templateVars: z.record(z.string(), z.string()).default({}),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		const contacts = await resolveAudienceContacts(
			context.db,
			userId,
			input.contactIds,
			input.audienceFilter
		);

		if (contacts.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No eligible recipients found for campaign.",
			});
		}

		const profile = await context.db.userProfile.findUnique({
			select: { orgName: true, senderId: true },
			where: { userId },
		});
		const orgName = profile?.orgName ?? "Velocast";
		const resolvedTemplateVars: Record<string, string> = {
			...input.templateVars,
			org: orgName,
			org_name: orgName,
			orgName,
		};

		const audienceCalc = calculateMaxSegmentsForAudience({
			contacts,
			template: input.messageText,
			templateVars: resolvedTemplateVars,
		});

		const { totalEstimatedCostKobo } = audienceCalc;

		const wallet = await context.db.wallet.findUnique({
			select: { balanceKobo: true, heldKobo: true },
			where: { userId },
		});
		const availableBalanceKobo =
			(wallet?.balanceKobo ?? 0) - (wallet?.heldKobo ?? 0);

		if (availableBalanceKobo < totalEstimatedCostKobo) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Insufficient wallet balance. Estimated cost is ${totalEstimatedCostKobo} kobo, but available balance is ${availableBalanceKobo} kobo.`,
			});
		}

		const campaignId = uuidv4();
		const effectiveSenderId =
			input.senderId?.trim() || profile?.senderId || undefined;

		await context.db.campaign.create({
			data: {
				deliveryMode: "marketing",
				estimatedCostKobo: totalEstimatedCostKobo,
				id: campaignId,
				name: input.name?.trim() || null,
				scenario: input.scenario,
				scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
				senderId: effectiveSenderId ?? null,
				smsTemplate: input.messageText,
				status: "pending",
				totalMessages: contacts.length,
				useCustomTemplate: true,
				userId,
				whatsappTemplate: "",
			},
		});

		try {
			await holdCampaignFunds({
				amountKobo: totalEstimatedCostKobo,
				campaignId,
				description: input.name
					? `Campaign hold: ${input.name}`
					: `Campaign hold for ${campaignId}`,
				userId,
			});
		} catch (error) {
			await context.db.campaign
				.delete({ where: { id: campaignId } })
				.catch(() => {
					// Ignore deletion error during cleanup
				});
			throw error;
		}

		try {
			await inngest.send({
				data: {
					campaignId,
					contactIds: contacts.map((c) => c.id),
					forceSmsChannel: true,
					scenario: input.scenario,
					scheduledAt: input.scheduledAt ?? undefined,
					smsTemplate: input.messageText,
					templateVars: resolvedTemplateVars,
					userId,
					whatsappTemplate: "",
				},
				name: "Velocast/campaign.send",
			});
		} catch (inngestError) {
			try {
				await releaseCampaignHold({
					campaignId,
					reason: "Failed to dispatch campaign send event",
					userId,
				});
			} catch {
				// Ignore release error during cleanup
			}
			try {
				await context.db.campaign.updateMany({
					data: { completedAt: new Date(), status: "failed" },
					where: { id: campaignId },
				});
			} catch {
				// Ignore update error during cleanup
			}
			throw inngestError;
		}

		invalidate(userId, "campaign.list");

		return {
			campaignId,
			heldKobo: totalEstimatedCostKobo,
			scheduledAt: input.scheduledAt ?? null,
			status: "pending",
			totalMessages: contacts.length,
		};
	});

export const cancelScheduledCampaign = protectedProcedure
	.input(z.object({ campaignId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		const campaign = await context.db.campaign.findUnique({
			select: { id: true, scheduledAt: true, status: true, userId: true },
			where: { id: input.campaignId },
		});

		if (!campaign || campaign.userId !== userId) {
			throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
		}

		if (campaign.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Campaign cannot be cancelled in '${campaign.status}' status`,
			});
		}

		const updated = await context.db.campaign.updateMany({
			data: { completedAt: new Date(), status: "cancelled" },
			where: { id: input.campaignId, status: "pending", userId },
		});

		if (updated.count === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Campaign is no longer in pending status",
			});
		}

		const releaseResult = await releaseCampaignHold({
			campaignId: input.campaignId,
			reason: "Scheduled campaign cancelled by user",
			userId,
		});

		invalidate(userId, "campaign.list");

		return {
			campaignId: input.campaignId,
			releasedKobo: releaseResult.unspentReleasedKobo,
			status: "cancelled",
		};
	});

export const sendCampaign = protectedProcedure
	.input(
		z.object({
			contacts: z.array(ContactSchema).min(1),
			customTemplate: z
				.object({ sms: z.string(), whatsapp: z.string() })
				.optional(),
			deliveryMode: z
				.enum(["marketing", "utility_prescreen", "sms_fallback"])
				.default("marketing"),
			scenario: ScenarioSchema,
			templateVars: z.record(z.string(), z.string()).default({}),
			useCustom: z.boolean().default(false),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		let template: { whatsapp: string; sms: string };

		if (input.useCustom && input.customTemplate) {
			template = input.customTemplate;
		} else {
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

		const profile = await context.db.userProfile.findUnique({
			select: { orgName: true },
			where: { userId },
		});
		const orgName = profile?.orgName ?? "Velocast";

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

		const contactIds = input.contacts.map((c) => c.id);

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
				deliveryMode: true,
				estimatedCostKobo: true,
				failedMessages: true,
				id: true,
				name: true,
				scenario: true,
				scheduledAt: true,
				senderId: true,
				sentMessages: true,
				smsTemplate: true,
				startedAt: true,
				status: true,
				totalMessages: true,
				userId: true,
				whatsappTemplate: true,
			},
			where: { id: input.campaignId },
		});
		if (!campaign) {
			throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
		}
		if (campaign.userId !== context.session.user.id) {
			throw new ORPCError("FORBIDDEN", { message: "Access denied" });
		}

		const [messages, totalMessages] = await Promise.all([
			context.db.message.findMany({
				orderBy: { createdAt: "asc" },
				select: {
					channel: true,
					contactName: true,
					costKobo: true,
					deliveredAt: true,
					errorMessage: true,
					id: true,
					message: true,
					metaMessageId: true,
					phone: true,
					segments: true,
					sentAt: true,
					status: true,
					termiiMessageId: true,
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
			deliveryMode: campaign.deliveryMode,
			estimatedCostKobo: campaign.estimatedCostKobo,
			failed: campaign.failedMessages,
			messages: messages.map((m) => ({
				channel: m.channel,
				contactName: m.contactName,
				costKobo: m.costKobo,
				deliveredAt: m.deliveredAt,
				errorMessage: m.errorMessage,
				externalId: m.termiiMessageId ?? m.metaMessageId,
				id: m.id,
				message: m.message,
				phone: m.phone,
				segments: m.segments,
				sentAt: m.sentAt,
				status: m.status,
			})),
			messagesPagination: {
				page: input.messagesPage,
				pageSize: input.messagesPageSize,
				total: totalMessages,
				totalPages: Math.ceil(totalMessages / input.messagesPageSize),
			},
			name: campaign.name,
			scenario: campaign.scenario,
			scheduledAt: campaign.scheduledAt,
			senderId: campaign.senderId,
			sent: campaign.sentMessages,
			smsTemplate: campaign.smsTemplate,
			startedAt: campaign.startedAt,
			status: campaign.status,
			total: campaign.totalMessages,
			whatsappTemplate: campaign.whatsappTemplate,
		};
	});

export const getCampaignDetail = getCampaignStatus;

export const listCampaigns = protectedProcedure
	.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
	.handler(
		withCache("campaign.list", 15_000, async ({ input, context }) => {
			const rows = await context.db.campaign.findMany({
				orderBy: { createdAt: "desc" },
				select: {
					completedAt: true,
					createdAt: true,
					estimatedCostKobo: true,
					failedMessages: true,
					id: true,
					name: true,
					scenario: true,
					scheduledAt: true,
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
				estimatedCostKobo: c.estimatedCostKobo,
				failed: c.failedMessages,
				id: c.id,
				name: c.name,
				scenario: c.scenario,
				scheduledAt: c.scheduledAt,
				sent: c.sentMessages,
				status: c.status,
				total: c.totalMessages,
			}));
		})
	);
