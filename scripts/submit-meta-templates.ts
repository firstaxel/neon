/**
 * scripts/submit-meta-templates.ts
 *
 * Bulk-submits all 60 WhatsApp message templates to Meta's Template API.
 *
 * Usage:
 *   META_WABA_ID=your_waba_id META_SYSTEM_TOKEN=your_token npx tsx scripts/submit-meta-templates.ts
 *
 * Options (env vars):
 *   META_WABA_ID        — required. Your WhatsApp Business Account ID.
 *   META_SYSTEM_TOKEN   — required. Permanent system user token with
 *                         whatsapp_business_management permission.
 *   META_API_VERSION    — optional. Default: v20.0
 *   DRY_RUN             — optional. Set to "true" to print payloads without submitting.
 *   FILTER_CATEGORY     — optional. "MARKETING" or "UTILITY" to submit only one category.
 *   FILTER_NAME         — optional. Partial name match to submit a single template.
 *
 * Notes:
 *   - Already-approved templates are skipped (Meta returns DUPLICATE error).
 *   - Rate limit: Meta allows ~10 template submissions per second per WABA.
 *     We add a 200ms delay between each submission to stay safe.
 *   - Variable format: Meta uses {{1}} positional vars. We convert from named
 *     vars ({{name}}, {{orgName}}) to positional automatically.
 *   - Footer text is submitted as a separate FOOTER component.
 *
 * Getting your WABA ID and System Token:
 *   1. Go to business.facebook.com → Business Settings → WhatsApp Accounts
 *   2. Select your WABA → copy the ID shown
 *   3. Business Settings → System Users → Add system user (Admin role)
 *   4. Generate token → check whatsapp_business_management + whatsapp_business_messaging
 *   5. Copy the token — it doesn't expire unless you revoke it
 */

import {
	META_TEMPLATE_LIBRARY,
	UTILITY_CONSENT_TEMPLATE,
	UTILITY_TEMPLATES,
} from "../src/features/miscellaneous/meta-templates";

// ─── Config ───────────────────────────────────────────────────────────────────

const WABA_ID = process.env.META_WABA_ID;
const TOKEN = process.env.META_SYSTEM_TOKEN;
const API_VERSION = process.env.META_API_VERSION ?? "v20.0";
const DRY_RUN = process.env.DRY_RUN === "true";
const FILTER_CATEGORY = process.env.FILTER_CATEGORY as
	| "MARKETING"
	| "UTILITY"
	| undefined;
const FILTER_NAME = process.env.FILTER_NAME;
const DELAY_MS = 220; // stay under Meta's rate limit

if (!DRY_RUN) {
	if (!WABA_ID) {
		console.error("❌  META_WABA_ID is required. Set it as an env var.");
		process.exit(1);
	}
	if (!TOKEN) {
		console.error("❌  META_SYSTEM_TOKEN is required. Set it as an env var.");
		process.exit(1);
	}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaTemplateComponent {
	format?: string;
	text?: string;
	type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
}

interface MetaTemplatePayload {
	category: "MARKETING" | "UTILITY";
	components: MetaTemplateComponent[];
	language: string;
	name: string;
}

interface MetaApiResult {
	error?: {
		message: string;
		code: number;
		error_subcode?: number;
		error_user_msg?: string;
	};
	id?: string;
	status?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert named variable format {{name}} → positional {{1}}, {{2}}...
 * Meta's template API requires positional vars in the body text.
 * The bodyVars array defines the mapping order.
 */
function toPositionalVars(text: string, bodyVars: string[]): string {
	let result = text;
	bodyVars.forEach((varName, index) => {
		// Replace all occurrences of {{varName}} with {{index+1}}
		const regex = new RegExp(`\\{\\{${varName}\\}\\}`, "g");
		result = result.replace(regex, `{{${index + 1}}}`);
	});
	return result;
}

/**
 * Build the Meta API payload for a single template.
 */
function buildPayload(tpl: {
	name: string;
	category: "MARKETING" | "UTILITY";
	language: string;
	bodyText: string;
	bodyVars: string[];
	footerText?: string;
}): MetaTemplatePayload {
	const positionalBody = toPositionalVars(tpl.bodyText, tpl.bodyVars);

	const components: MetaTemplateComponent[] = [
		{
			type: "BODY",
			text: positionalBody,
		},
	];

	if (tpl.footerText) {
		const positionalFooter = toPositionalVars(tpl.footerText, tpl.bodyVars);
		components.push({
			type: "FOOTER",
			text: positionalFooter,
		});
	}

	return {
		name: tpl.name,
		language: tpl.language,
		category: tpl.category,
		components,
	};
}

/**
 * Submit a single template to Meta's API.
 * Returns the API response (success or error).
 */
async function submitTemplate(
	payload: MetaTemplatePayload
): Promise<MetaApiResult> {
	const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${TOKEN}`,
		},
		body: JSON.stringify(payload),
	});

	return res.json() as Promise<MetaApiResult>;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Collect all templates ────────────────────────────────────────────────────

interface TemplateEntry {
	bodyText: string;
	bodyVars: string[];
	category: "MARKETING" | "UTILITY";
	footerText?: string;
	language: string;
	name: string;
	source: string; // e.g. "church/first_timer (MARKETING)"
}

const allTemplates: TemplateEntry[] = [];

// 1. Marketing templates — 30 total (6 org types × 5 scenarios)
for (const [orgType, scenarios] of Object.entries(META_TEMPLATE_LIBRARY)) {
	for (const [scenarioId, tpl] of Object.entries(scenarios)) {
		allTemplates.push({
			name: tpl.name,
			category: tpl.category,
			language: tpl.language,
			bodyText: tpl.bodyText,
			bodyVars: tpl.bodyVars,
			footerText: tpl.footerText,
			source: `${orgType}/${scenarioId} (MARKETING)`,
		});
	}
}

// 2. Utility consent templates — 30 total (6 org types × 5 scenarios)
for (const [orgType, scenarios] of Object.entries(UTILITY_TEMPLATES)) {
	for (const [scenarioId, tpl] of Object.entries(scenarios)) {
		allTemplates.push({
			name: tpl.name,
			category: tpl.category,
			language: tpl.language,
			bodyText: tpl.bodyText,
			bodyVars: tpl.bodyVars,
			footerText: tpl.footerText,
			source: `${orgType}/${scenarioId} (UTILITY)`,
		});
	}
}

// 3. Shared utility consent template (the generic fallback)
allTemplates.push({
	name: UTILITY_CONSENT_TEMPLATE.name,
	category: UTILITY_CONSENT_TEMPLATE.category,
	language: UTILITY_CONSENT_TEMPLATE.language,
	bodyText: UTILITY_CONSENT_TEMPLATE.bodyText,
	bodyVars: UTILITY_CONSENT_TEMPLATE.bodyVars,
	source: "shared/generic (UTILITY fallback)",
});

// ─── Apply filters ────────────────────────────────────────────────────────────

let filtered = allTemplates;

if (FILTER_CATEGORY) {
	filtered = filtered.filter((t) => t.category === FILTER_CATEGORY);
	console.log(
		`🔍  Filtering to ${FILTER_CATEGORY} only — ${filtered.length} templates`
	);
}

if (FILTER_NAME) {
	filtered = filtered.filter((t) => t.name.includes(FILTER_NAME));
	console.log(
		`🔍  Filtering to names containing "${FILTER_NAME}" — ${filtered.length} templates`
	);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
	console.log("\n📋  MessageDesk — Meta Template Bulk Submission");
	console.log("━".repeat(55));
	console.log(`   Templates to submit : ${filtered.length}`);
	console.log(`   WABA ID             : ${DRY_RUN ? "(dry run)" : WABA_ID}`);
	console.log(`   API version         : ${API_VERSION}`);
	console.log(
		`   Mode                : ${DRY_RUN ? "DRY RUN — no API calls will be made" : "LIVE"}`
	);
	console.log(`${"━".repeat(55)}\n`);

	const results = {
		submitted: 0,
		approved: 0,
		pending: 0,
		duplicate: 0,
		failed: 0,
		errors: [] as Array<{ name: string; error: string }>,
	};

	for (let i = 0; i < filtered.length; i++) {
		const tpl = filtered[i];
		const payload = buildPayload(tpl);
		const prefix = `[${String(i + 1).padStart(2, "0")}/${filtered.length}]`;

		if (DRY_RUN) {
			console.log(`${prefix} 📄  ${tpl.name}`);
			console.log(`        Source  : ${tpl.source}`);
			console.log(
				`        Body    : ${tpl.bodyText.slice(0, 80)}${tpl.bodyText.length > 80 ? "…" : ""}`
			);
			console.log(`        Vars    : ${tpl.bodyVars.join(", ") || "(none)"}`);
			console.log();
			continue;
		}

		process.stdout.write(`${prefix} ⏳  ${tpl.name} … `);

		try {
			let result = await submitTemplate(payload);

			// Meta returns this error when a template with the same name exists in a
			// different category and is mid-deletion. Wait 65s and retry once.
			const isDeletionPending = (r: MetaApiResult) =>
				(r.error?.message ?? "").includes("being deleted") ||
				(r.error?.message ?? "").includes("can't change the category");

			if (isDeletionPending(result)) {
				console.log("⏸️   deletion pending — waiting 65s then retrying…");
				await sleep(65_000);
				process.stdout.write(`${prefix} 🔄  ${tpl.name} (retry) … `);
				result = await submitTemplate(payload);
			}

			results.submitted++;

			if (result.error) {
				const errCode = result.error.code;
				const subCode = result.error.error_subcode;

				// Error 100 subcode 2388023 = duplicate template name
				if (errCode === 100 && subCode === 2_388_023) {
					console.log("⏭️   duplicate (already exists)");
					results.duplicate++;
				} else {
					const msg = result.error.error_user_msg ?? result.error.message;
					console.log(`❌  ${msg}`);
					results.failed++;
					results.errors.push({ name: tpl.name, error: msg });
				}
			} else if (result.status === "APPROVED") {
				console.log("✅  approved immediately");
				results.approved++;
			} else {
				console.log(`⏳  pending review (id: ${result.id})`);
				results.pending++;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`❌  network error: ${msg}`);
			results.failed++;
			results.errors.push({ name: tpl.name, error: msg });
		}

		// Respect Meta's rate limit
		if (i < filtered.length - 1) {
			await sleep(DELAY_MS);
		}
	}

	// ─── Summary ──────────────────────────────────────────────────────────────

	if (DRY_RUN) {
		console.log(
			`\n✅  Dry run complete — ${filtered.length} templates would be submitted.`
		);
		console.log("   Run without DRY_RUN=true to submit for real.\n");
		return;
	}

	console.log(`\n${"━".repeat(55)}`);
	console.log("   Submission Summary");
	console.log("━".repeat(55));
	console.log(`   ✅  Approved immediately : ${results.approved}`);
	console.log(`   ⏳  Pending review       : ${results.pending}`);
	console.log(`   ⏭️   Already existed      : ${results.duplicate}`);
	console.log(`   ❌  Failed               : ${results.failed}`);
	console.log("━".repeat(55));

	if (results.errors.length > 0) {
		console.log("\n⚠️   Failed templates:");
		for (const e of results.errors) {
			console.log(`   • ${e.name}: ${e.error}`);
		}
	}

	if (results.pending > 0) {
		console.log(`
📌  ${results.pending} templates are pending Meta review.
   Utility templates typically approve in minutes.
   Marketing templates can take 24–48 hours.
   Check status in Meta Business Manager → WhatsApp → Message Templates.
`);
	}

	if (results.failed > 0) {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("\n💥  Unexpected error:", err);
	process.exit(1);
});
