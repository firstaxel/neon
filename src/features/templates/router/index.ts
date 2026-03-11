/**
 * src/orpc/template.router.ts
 *
 * Full WhatsApp Business API template management.
 *
 * Procedures:
 *   template.list         — list user's templates (with status filter)
 *   template.get          — single template by id
 *   template.create       — create a DRAFT template
 *   template.update       — update a DRAFT template
 *   template.delete       — delete (also removes from Meta if submitted)
 *   template.submit       — submit DRAFT to Meta for approval
 *   template.syncStatus   — poll Meta and update local status
 *   template.recordUsage  — increment usage_count + last_used_at
 */

import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	deleteMetaTemplate,
	fetchTemplateStatus,
	submitTemplate,
	type WaTemplatePayload,
} from "#/features/templates/category/whatsapp/templates";
import { invalidateMany, withCache } from "#/lib/cache";
import type { MessageChannel } from "#/lib/types";
import { protectedProcedure } from "#/orpc";
import type { WaButton, WaStatus } from "../category/whatsapp/templates";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const WaButtonSchema = z.object({
	type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE"]),
	text: z.string().min(1).max(25),
	url: z.string().optional(),
	phoneNumber: z.string().optional(),
	example: z.array(z.string()).optional(),
});

const TemplateInput = z.object({
	name: z
		.string()
		.min(1)
		.max(512)
		.regex(
			/^[a-z0-9_]+$/,
			"Name must be lowercase letters, numbers, and underscores only"
		),
	displayName: z.string().min(1).max(100),
	language: z.string().default("en"),
	category: z
		.enum(["MARKETING", "UTILITY", "AUTHENTICATION"])
		.default("MARKETING"),

	headerFormat: z
		.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"])
		.nullable()
		.optional(),
	headerText: z.string().max(60).optional(),
	headerVars: z.array(z.string()).default([]),

	bodyText: z.string().min(1, "Body text is required").max(1024),
	bodyVars: z.array(z.string()).default([]),

	footerText: z.string().max(60).optional(),

	buttons: z.array(WaButtonSchema).max(10).default([]),

	smsBody: z.string().min(1, "SMS body is required").max(918),
	smsVars: z.array(z.string()).default([]),
	channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
});

// ─── Helper: map DB row → client shape ───────────────────────────────────────

function mapTemplate(t: {
	id: string;
	userId: string;
	name: string;
	displayName: string;
	language: string;
	category: string;
	status: string;
	waTemplateId: string | null;
	waAccountId: string | null;
	rejectionReason: string | null;
	headerFormat: string | null;
	headerText: string | null;
	headerVars: string[];
	bodyText: string;
	bodyVars: string[];
	footerText: string | null;
	buttons: unknown;
	smsBody: string;
	smsVars: string[];
	usageCount: number;
	channel: MessageChannel;
	lastUsedAt: Date | null;
	submittedAt: Date | null;
	approvedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: t.id,
		name: t.name,
		displayName: t.displayName,
		language: t.language,
		category: t.category as "MARKETING" | "UTILITY" | "AUTHENTICATION",
		status: t.status as
			| "DRAFT"
			| "PENDING"
			| "APPROVED"
			| "REJECTED"
			| "PAUSED"
			| "DISABLED",
		waTemplateId: t.waTemplateId,
		waAccountId: t.waAccountId,
		rejectionReason: t.rejectionReason,
		headerFormat: t.headerFormat as
			| "TEXT"
			| "IMAGE"
			| "VIDEO"
			| "DOCUMENT"
			| "LOCATION"
			| null,
		headerText: t.headerText,
		headerVars: t.headerVars,
		bodyText: t.bodyText,
		bodyVars: t.bodyVars,
		footerText: t.footerText,
		buttons: t.buttons as WaButton[],
		channel: t.channel,
		smsBody: t.smsBody,
		smsVars: t.smsVars,
		usageCount: t.usageCount,
		lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
		submittedAt: t.submittedAt?.toISOString() ?? null,
		approvedAt: t.approvedAt?.toISOString() ?? null,
		createdAt: t.createdAt.toISOString(),
		updatedAt: t.updatedAt.toISOString(),
	};
}

// ─── list ─────────────────────────────────────────────────────────────────────

export const listTemplates = protectedProcedure
	.route({
		method: "GET",
	})
	.input(
		z.object({
			status: z
				.enum([
					"DRAFT",
					"PENDING",
					"APPROVED",
					"REJECTED",
					"PAUSED",
					"DISABLED",
				])
				.optional(),
			category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
			channel: z.enum(["whatsapp", "sms"]).optional(),
			search: z.string().optional(),
		})
	)
	.handler(
		withCache("template.list", 30_000, async ({ input, context }) => {
			const rows = await context.db.messageTemplate.findMany({
				where: {
					userId: context.session?.user.id,
					...(input.status ? { status: input.status } : {}),
					...(input.category ? { category: input.category } : {}),
					...(input.channel ? { channel: input.channel } : {}),
					...(input.search
						? {
								OR: [
									{
										displayName: {
											contains: input.search,
											mode: "insensitive",
										},
									},
									{ name: { contains: input.search, mode: "insensitive" } },
								],
							}
						: {}),
				},
				orderBy: [{ updatedAt: "desc" }],
			});
			return rows.map((t) => mapTemplate(t));
		})
	);

// ─── get ──────────────────────────────────────────────────────────────────────

export const getTemplate = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(
		withCache("template.get", 30_000, async ({ input, context }) => {
			const t = await context.db.messageTemplate.findUnique({
				where: { id: input.id },
			});
			if (!t || t.userId !== context.session?.user.id) {
				throw new ORPCError("NOT_FOUND", { message: "Template not found." });
			}
			return mapTemplate(t);
		})
	);

// ─── create ───────────────────────────────────────────────────────────────────

export const createTemplate = protectedProcedure
	.input(TemplateInput)
	.handler(async ({ input, context }) => {
		// Enforce unique name per user
		const existing = await context.db.messageTemplate.findFirst({
			where: { userId: context.session.user.id, name: input.name },
		});
		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "You already have a template with this name.",
			});
		}

		const t = await context.db.messageTemplate.create({
			data: {
				userId: context.session.user.id,
				name: input.name,
				displayName: input.displayName,
				language: input.language,
				category: input.category,
				// SMS-only templates are auto-approved — no Meta submission needed
				status: input.channel === "sms" ? "APPROVED" : "DRAFT",
				channel: input.channel,
				headerFormat:
					input.channel === "sms" ? null : (input.headerFormat ?? null),
				headerText: input.channel === "sms" ? null : (input.headerText ?? null),
				headerVars: input.channel === "sms" ? [] : input.headerVars,
				bodyText: input.channel === "sms" ? input.smsBody : input.bodyText,
				bodyVars: input.channel === "sms" ? input.smsVars : input.bodyVars,
				footerText: input.channel === "sms" ? null : (input.footerText ?? null),
				buttons: input.channel === "sms" ? [] : input.buttons,
				smsBody: input.smsBody,
				smsVars: input.smsVars,
				...(input.channel === "sms" ? { approvedAt: new Date() } : {}),
			},
		});
		invalidateMany(context.session.user.id, [
			"template.list",
			"template.getScenarioDefaults",
		]);
		return mapTemplate(t);
	});

// ─── update ───────────────────────────────────────────────────────────────────

export const updateTemplate = protectedProcedure
	.input(z.object({ id: z.string().uuid() }).merge(TemplateInput))
	.handler(async ({ input, context }) => {
		const existing = await context.db.messageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!existing || existing.userId !== context.session.user.id) {
			throw new ORPCError("NOT_FOUND", { message: "Template not found." });
		}

		// Can only edit DRAFT or REJECTED templates
		if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Only DRAFT or REJECTED templates can be edited. Delete and recreate if approved.",
			});
		}

		const t = await context.db.messageTemplate.update({
			where: { id: input.id },
			data: {
				name: input.name,
				displayName: input.displayName,
				language: input.language,
				category: input.category,
				// SMS-only stays APPROVED on edit; WA resets to DRAFT
				status: existing.channel === "sms" ? "APPROVED" : "DRAFT",
				headerFormat:
					existing.channel === "sms" ? null : (input.headerFormat ?? null),
				headerText:
					existing.channel === "sms" ? null : (input.headerText ?? null),
				headerVars: existing.channel === "sms" ? [] : input.headerVars,
				bodyText: existing.channel === "sms" ? input.smsBody : input.bodyText,
				bodyVars: existing.channel === "sms" ? input.smsVars : input.bodyVars,
				footerText:
					existing.channel === "sms" ? null : (input.footerText ?? null),
				buttons: existing.channel === "sms" ? [] : input.buttons,
				smsBody: input.smsBody,
				smsVars: input.smsVars,
				rejectionReason: null,
			},
		});
		invalidateMany(context.session.user.id, [
			"template.list",
			"template.get",
			"template.getScenarioDefaults",
		]);
		return mapTemplate(t);
	});

// ─── delete ───────────────────────────────────────────────────────────────────

export const deleteTemplate = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const existing = await context.db.messageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!existing || existing.userId !== context.session.user.id) {
			throw new ORPCError("NOT_FOUND", { message: "Template not found." });
		}

		// If already submitted to Meta, delete there too (best-effort)
		if (existing.waTemplateId || existing.name) {
			try {
				await deleteMetaTemplate(existing.name);
			} catch {
				// Non-fatal — the template may not exist on Meta side
			}
		}

		await context.db.messageTemplate.delete({ where: { id: input.id } });
		invalidateMany(context.session.user.id, [
			"template.list",
			"template.get",
			"template.getScenarioDefaults",
		]);
		return { success: true };
	});

// ─── submit ───────────────────────────────────────────────────────────────────

export const submitTemplateForApproval = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const t = await context.db.messageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!t || t.userId !== context.session.user.id) {
			throw new ORPCError("NOT_FOUND", { message: "Template not found." });
		}

		if (t.status !== "DRAFT" && t.status !== "REJECTED") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Template is ${t.status} — only DRAFT or REJECTED templates can be submitted.`,
			});
		}

		const payload: WaTemplatePayload = {
			name: t.name,
			displayName: t.displayName,
			language: t.language,
			category: t.category as WaTemplatePayload["category"],
			headerFormat:
				(t.headerFormat as WaTemplatePayload["headerFormat"]) ?? undefined,
			headerText: t.headerText ?? undefined,
			headerVars: t.headerVars,
			bodyText: t.bodyText,
			bodyVars: t.bodyVars,
			footerText: t.footerText ?? undefined,
			buttons: (t.buttons as unknown as WaTemplatePayload["buttons"]) ?? [],
			smsBody: t.smsBody,
			smsVars: t.smsVars,
		};

		const result = await submitTemplate(payload);

		const updated = await context.db.messageTemplate.update({
			where: { id: input.id },
			data: {
				status: "PENDING",
				waTemplateId: result.id,
				waAccountId: process.env.META_WABA_ID ?? null,
				submittedAt: new Date(),
				rejectionReason: null,
			},
		});

		invalidateMany(context.session.user.id, ["template.list", "template.get"]);
		return mapTemplate(updated);
	});

// ─── syncStatus ───────────────────────────────────────────────────────────────

export const syncTemplateStatus = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const t = await context.db.messageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!t || t.userId !== context.session.user.id) {
			throw new ORPCError("NOT_FOUND", { message: "Template not found." });
		}

		if (!t.waTemplateId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Template has not been submitted yet.",
			});
		}

		const result = await fetchTemplateStatus(t.waTemplateId);

		// Map WaStatus → WaTemplateStatus enum
		const statusMap: Record<string, WaStatus> = {
			PENDING: "PENDING",
			APPROVED: "APPROVED",
			REJECTED: "REJECTED",
			PAUSED: "PAUSED",
			DISABLED: "DISABLED",
		};

		const updated = await context.db.messageTemplate.update({
			where: { id: input.id },
			data: {
				status: statusMap[result.status] ?? t.status,
				rejectionReason: result.rejectionReason ?? null,
				approvedAt:
					result.status === "APPROVED" && !t.approvedAt
						? new Date()
						: t.approvedAt,
			},
		});

		invalidateMany(context.session.user.id, ["template.list", "template.get"]);
		return mapTemplate(updated);
	});

// ─── recordUsage ──────────────────────────────────────────────────────────────

export const recordTemplateUsage = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const existing = await context.db.messageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!existing || existing.userId !== context.session.user.id) {
			return { success: false };
		}

		await context.db.messageTemplate.update({
			where: { id: input.id },
			data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
		});
		return { success: true };
	});

// ─── getScenarioDefaults ──────────────────────────────────────────────────────
//
// Returns the user's default WA + SMS template body for every scenario.
// The wizard uses this to pre-fill message previews per scenario, instead of
// reading hardcoded seed content from app code.
// Falls back to SCENARIO_SEED_TEMPLATES if the user has no row yet.

export const getScenarioDefaults = protectedProcedure.handler(
	withCache("template.getScenarioDefaults", 60_000, async ({ context }) => {
		const { SCENARIOS, SCENARIO_SEED_TEMPLATES } = await import(
			"#/features/miscellaneous/scenario"
		);

		const rows = await context.db.messageTemplate.findMany({
			where: {
				userId: context.session?.user.id,
				isDefault: true,
				scenarioId: { not: null },
			},
			select: { scenarioId: true, channel: true, bodyText: true },
		});

		// Build lookup: scenarioId → { whatsapp, sms }
		const map: Record<string, { whatsapp: string; sms: string }> = {};
		for (const s of SCENARIOS) {
			const seed = SCENARIO_SEED_TEMPLATES[s.id];
			map[s.id] = { whatsapp: seed.whatsapp, sms: seed.sms };
		}
		for (const row of rows) {
			if (!row.scenarioId) {
				continue;
			}
			if (!map[row.scenarioId]) {
				map[row.scenarioId] = { whatsapp: "", sms: "" };
			}
			if (row.channel === "whatsapp") {
				map[row.scenarioId].whatsapp = row.bodyText;
			} else {
				map[row.scenarioId].sms = row.bodyText;
			}
		}

		return map;
	})
);

// ─── seedFromLibrary ──────────────────────────────────────────────────────────
// Creates Meta-ready templates from the library for the user's org type.
// Safe to call multiple times — skips templates whose name already exists.
// Useful for: existing users who predate onboarding seeding, or users who
// want to re-seed after changing org type.

export const seedFromLibrary = protectedProcedure.handler(
	async ({ context }) => {
		const { getAllMetaTemplatesForOrg } = await import(
			"#/features/miscellaneous/meta-templates"
		);
		const profile = await context.db.userProfile.findUnique({
			where: { userId: context.session.user.id },
			select: { orgType: true },
		});

		const templates = getAllMetaTemplatesForOrg(profile?.orgType);

		// Only create templates whose name doesn't exist yet for this user
		const existingNames = new Set(
			(
				await context.db.messageTemplate.findMany({
					where: { userId: context.session.user.id },
					select: { name: true },
				})
			).map((t) => t.name)
		);

		const toCreate = templates.filter((t) => !existingNames.has(t.name));

		if (toCreate.length === 0) {
			return { created: 0 };
		}

		await context.db.messageTemplate.createMany({
			data: toCreate.map((t) => ({
				userId: context.session.user.id,
				name: t.name,
				displayName: t.displayName,
				category: t.category,
				bodyText: t.bodyText,
				bodyVars: t.bodyVars,
				smsBody: t.smsBody,
				footerText: t.footerText ?? null,
				channel: "whatsapp" as const,
				purpose: "general" as const,
				status: "DRAFT" as const,
			})),
		});

		invalidateMany(context.session.user.id, [
			"template.list",
			"template.getScenarioDefaults",
		]);
		return { created: toCreate.length };
	}
);
