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
 *
 * FIX: Previously used getAllMetaTemplatesForOrg() + t.name.includes(s.id) to
 * build a lookup Map. That was broken because:
 *   1. getAllMetaTemplatesForOrg() returns both MARKETING and UTILITY templates
 *      for the same org type (from META_TEMPLATE_LIBRARY and UTILITY_TEMPLATES),
 *      but only META_TEMPLATE_LIBRARY is keyed by scenario correctly.
 *   2. The name-based matching (t.name.includes(s.id)) caused false positives —
 *      e.g. "church_consent_first_timer" matched "first_timer" and overwrote the
 *      real marketing template in the Map, leaving some scenarios unseeded.
 *
 * Now we call getMetaTemplate(orgType, scenario.id) directly per scenario,
 * which does a clean keyed lookup with no string-matching or Map collisions.
 */

import type { PrismaClient } from "#/generated/prisma/client";
import type { MessageTemplateCreateManyArgs } from "#/generated/prisma/models";
import type { ScenarioId } from "#/lib/types";
import { getMetaTemplate } from "./meta-templates";
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

	const toCreate: MessageTemplateCreateManyArgs["data"] = [];

	for (const scenario of SCENARIOS) {
		// Direct keyed lookup — no string matching, no Map collisions.
		// getMetaTemplate falls back to "other" if the orgType is unknown.
		const meta = getMetaTemplate(orgType, scenario.id as ScenarioId);

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

		// SMS default — body is the smsBody; keep only vars that appear in it
		if (!existingSet.has(`${scenario.id}:sms`)) {
			// Derive which named vars the smsBody actually uses so we don't
			// prompt the user to fill in variables that the SMS body doesn't reference.
			const smsVarPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
			const smsBodyVars: string[] = [];
			const seenVars = new Set<string>();
			for (const m of meta.smsBody.matchAll(smsVarPattern)) {
				if (!seenVars.has(m[1])) {
					seenVars.add(m[1]);
					smsBodyVars.push(m[1]);
				}
			}

			toCreate.push({
				userId,
				scenarioId: scenario.id,
				isDefault: true,
				channel: "sms",
				name: `${meta.name}_sms`,
				displayName: `${meta.displayName} (SMS)`,
				bodyText: meta.smsBody,
				bodyVars: smsBodyVars.length > 0 ? smsBodyVars : meta.bodyVars.filter((v) => ["name", "orgName"].includes(v)),
				smsBody: meta.smsBody,
				footerText: null,
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
