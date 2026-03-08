/**
 * seedScenarioTemplates
 *
 * Called once when a user completes onboarding. Writes one WA + one SMS
 * MessageTemplate row per scenario, tagged with scenarioId + isDefault=true.
 *
 * Uses the Meta-ready template library (meta-templates.ts) as the seed content
 * so each org type gets templates that are already suitable for Meta submission,
 * not generic placeholder text.
 *
 * Idempotent — skips any scenario/channel combo that already has a default.
 */

import type { PrismaClient } from "#/generated/prisma/client";
import type { MessageTemplateCreateManyArgs } from "#/generated/prisma/models";
import { getAllMetaTemplatesForOrg } from "./meta-templates";
import { SCENARIOS } from "./scenario";

export async function seedScenarioTemplates(
	db: PrismaClient,
	userId: string,
	orgType?: string | null
): Promise<{ seeded: number; skipped: number }> {
	// Find which scenarios already have defaults for this user
	const existing = await db.messageTemplate.findMany({
		where: { userId, isDefault: true, scenarioId: { not: null } },
		select: { scenarioId: true, channel: true },
	});

	const existingSet = new Set(
		existing.map((t) => `${t.scenarioId}:${t.channel}`)
	);

	const metaTemplates = getAllMetaTemplatesForOrg(orgType);
	// Build a lookup by scenario id
	const metaByScenario = new Map(
		metaTemplates.map((t) => {
			// Template names follow pattern: {orgtype}_{scenarioid}_... or general_{scenarioid}_...
			// We match by finding the scenario id in SCENARIOS
			const scenarioId = SCENARIOS.find((s) => t.name.includes(s.id))?.id;
			return [scenarioId, t] as const;
		})
	);

	const toCreate: MessageTemplateCreateManyArgs["data"] = [];

	for (const scenario of SCENARIOS) {
		const meta = metaByScenario.get(scenario.id);
		if (!meta) {
			continue;
		}

		// WhatsApp default
		if (!existingSet.has(`${scenario.id}:whatsapp`)) {
			toCreate.push({
				userId,
				scenarioId: scenario.id,
				isDefault: true,
				channel: "whatsapp",
				name: meta.name,
				displayName: meta.displayName,
				bodyText: meta.bodyText,
				bodyVars: meta.bodyVars,
				smsBody: meta.smsBody,
				footerText: meta.footerText ?? null,
				purpose: "general",
				category: meta.category,
				status: "DRAFT",
			});
		}

		// SMS default
		if (!existingSet.has(`${scenario.id}:sms`)) {
			toCreate.push({
				userId,
				scenarioId: scenario.id,
				isDefault: true,
				channel: "sms",
				name: `${meta.name}_sms`,
				displayName: `${meta.displayName} (SMS)`,
				bodyText: meta.smsBody,
				bodyVars: meta.bodyVars.filter((v) => ["name", "orgName"].includes(v)),
				smsBody: meta.smsBody,
				purpose: "general",
				category: "MARKETING",
				status: "DRAFT",
			});
		}
	}

	if (toCreate.length === 0) {
		return { seeded: 0, skipped: existing.length };
	}

	await db.messageTemplate.createMany({ data: toCreate });
	return { seeded: toCreate.length, skipped: existing.length };
}
