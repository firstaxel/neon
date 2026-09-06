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

import { openapi } from "@orpc/openapi";
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
	example: z.array(z.string()).optional(),
	phoneNumber: z.string().optional(),
	text: z.string().min(1).max(25),
	type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE"]),
	url: z.string().optional(),
});

const TemplateInput = z.object({
	bodyText: z.string().min(1, "Body text is required").max(1024),
	bodyVars: z.array(z.string()).default([]),

	buttons: z.array(WaButtonSchema).max(10).default([]),
	category: z
		.enum(["MARKETING", "UTILITY", "AUTHENTICATION"])
		.default("MARKETING"),
	channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
	displayName: z.string().min(1).max(100),

	footerText: z.string().max(60).optional(),

	headerFormat: z
		.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"])
		.nullable()
		.optional(),
	headerText: z.string().max(60).optional(),
	headerVars: z.array(z.string()).default([]),
	language: z.string().default("en"),
	name: z
		.string()
		.min(1)
		.max(512)
		.regex(
			/^[a-z0-9_]+$/,
			"Name must be lowercase letters, numbers, and underscores only"
		),

	smsBody: z.string().min(1, "SMS body is required").max(918),
	smsVars: z.array(z.string()).default([]),
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
		approvedAt: t.approvedAt?.toISOString() ?? null,
		bodyText: t.bodyText,
		bodyVars: t.bodyVars,
		buttons: t.buttons as WaButton[],
		category: t.category as "MARKETING" | "UTILITY" | "AUTHENTICATION",
		channel: t.channel,
		createdAt: t.createdAt.toISOString(),
		displayName: t.displayName,
		footerText: t.footerText,
		headerFormat: t.headerFormat as
			| "TEXT"
			| "IMAGE"
			| "VIDEO"
			| "DOCUMENT"
			| "LOCATION"
			| null,
		headerText: t.headerText,
		headerVars: t.headerVars,
		id: t.id,
		language: t.language,
		lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
		name: t.name,
		rejectionReason: t.rejectionReason,
		smsBody: t.smsBody,
		smsVars: t.smsVars,
		status: t.status as
			| "DRAFT"
			| "PENDING"
			| "APPROVED"
			| "REJECTED"
			| "PAUSED"
			| "DISABLED",
		submittedAt: t.submittedAt?.toISOString() ?? null,
		updatedAt: t.updatedAt.toISOString(),
		usageCount: t.usageCount,
		waAccountId: t.waAccountId,
		waTemplateId: t.waTemplateId,
	};
}

// ─── list ─────────────────────────────────────────────────────────────────────

export const listTemplates = protectedProcedure
	.meta(
		openapi({
			method: "GET",
		})
	)
	.input(
		z.object({
			category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
			channel: z.enum(["whatsapp", "sms"]).optional(),
			search: z.string().optional(),
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
		})
	)
	.handler(
		withCache("template.list", 30_000, async ({ input, context }) => {
			const rows = await context.db.messageTemplate.findMany({
				orderBy: [{ updatedAt: "desc" }],
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
			where: { name: input.name, userId: context.session.user.id },
		});
		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "You already have a template with this name.",
			});
		}

		const t = await context.db.messageTemplate.create({
			data: {
				bodyText: input.channel === "sms" ? input.smsBody : input.bodyText,
				bodyVars: input.channel === "sms" ? input.smsVars : input.bodyVars,
				buttons: input.channel === "sms" ? [] : input.buttons,
				category: input.category,
				channel: input.channel,
				displayName: input.displayName,
				footerText: input.channel === "sms" ? null : (input.footerText ?? null),
				headerFormat:
					input.channel === "sms" ? null : (input.headerFormat ?? null),
				headerText: input.channel === "sms" ? null : (input.headerText ?? null),
				headerVars: input.channel === "sms" ? [] : input.headerVars,
				language: input.language,
				name: input.name,
				smsBody: input.smsBody,
				smsVars: input.smsVars,
				// SMS-only templates are auto-approved — no Meta submission needed
				status: input.channel === "sms" ? "APPROVED" : "DRAFT",
				userId: context.session.user.id,
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
			data: {
				bodyText: existing.channel === "sms" ? input.smsBody : input.bodyText,
				bodyVars: existing.channel === "sms" ? input.smsVars : input.bodyVars,
				buttons: existing.channel === "sms" ? [] : input.buttons,
				category: input.category,
				displayName: input.displayName,
				footerText:
					existing.channel === "sms" ? null : (input.footerText ?? null),
				headerFormat:
					existing.channel === "sms" ? null : (input.headerFormat ?? null),
				headerText:
					existing.channel === "sms" ? null : (input.headerText ?? null),
				headerVars: existing.channel === "sms" ? [] : input.headerVars,
				language: input.language,
				name: input.name,
				rejectionReason: null,
				smsBody: input.smsBody,
				smsVars: input.smsVars,
				// SMS-only stays APPROVED on edit; WA resets to DRAFT
				status: existing.channel === "sms" ? "APPROVED" : "DRAFT",
			},
			where: { id: input.id },
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
			bodyText: t.bodyText,
			bodyVars: t.bodyVars,
			buttons: (t.buttons as unknown as WaTemplatePayload["buttons"]) ?? [],
			category: t.category as WaTemplatePayload["category"],
			displayName: t.displayName,
			footerText: t.footerText ?? undefined,
			headerFormat:
				(t.headerFormat as WaTemplatePayload["headerFormat"]) ?? undefined,
			headerText: t.headerText ?? undefined,
			headerVars: t.headerVars,
			language: t.language,
			name: t.name,
			smsBody: t.smsBody,
			smsVars: t.smsVars,
		};

		const result = await submitTemplate(payload);

		const updated = await context.db.messageTemplate.update({
			data: {
				rejectionReason: null,
				status: "PENDING",
				submittedAt: new Date(),
				waAccountId: process.env.META_WABA_ID ?? null,
				waTemplateId: result.id,
			},
			where: { id: input.id },
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
			APPROVED: "APPROVED",
			DISABLED: "DISABLED",
			PAUSED: "PAUSED",
			PENDING: "PENDING",
			REJECTED: "REJECTED",
		};

		const updated = await context.db.messageTemplate.update({
			data: {
				approvedAt:
					result.status === "APPROVED" && !t.approvedAt
						? new Date()
						: t.approvedAt,
				rejectionReason: result.rejectionReason ?? null,
				status: statusMap[result.status] ?? t.status,
			},
			where: { id: input.id },
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
			data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
			where: { id: input.id },
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
			select: { bodyText: true, channel: true, scenarioId: true },
			where: {
				isDefault: true,
				scenarioId: { not: null },
				userId: context.session?.user.id,
			},
		});

		// Build lookup: scenarioId → { whatsapp, sms }
		const map: Record<string, { whatsapp: string; sms: string }> = {};
		for (const s of SCENARIOS) {
			const seed = SCENARIO_SEED_TEMPLATES[s.id];
			map[s.id] = { sms: seed.sms, whatsapp: seed.whatsapp };
		}
		for (const row of rows) {
			if (!row.scenarioId) {
				continue;
			}
			if (!map[row.scenarioId]) {
				map[row.scenarioId] = { sms: "", whatsapp: "" };
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
			select: { orgType: true },
			where: { userId: context.session.user.id },
		});

		const templates = getAllMetaTemplatesForOrg(profile?.orgType);

		// Only create templates whose name doesn't exist yet for this user
		const existingNames = new Set(
			(
				await context.db.messageTemplate.findMany({
					select: { name: true },
					where: { userId: context.session.user.id },
				})
			).map((t) => t.name)
		);

		const toCreate = templates.filter((t) => !existingNames.has(t.name));

		if (toCreate.length === 0) {
			return { created: 0 };
		}

		await context.db.messageTemplate.createMany({
			data: toCreate.map((t) => ({
				bodyText: t.bodyText,
				bodyVars: t.bodyVars,
				category: t.category,
				channel: "whatsapp" as const,
				displayName: t.displayName,
				footerText: t.footerText ?? null,
				name: t.name,
				purpose: "general" as const,
				smsBody: t.smsBody,
				status: "DRAFT" as const,
				userId: context.session.user.id,
			})),
		});

		invalidateMany(context.session.user.id, [
			"template.list",
			"template.getScenarioDefaults",
		]);
		return { created: toCreate.length };
	}
);
