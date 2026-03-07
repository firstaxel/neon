import type { Scenario, ScenarioId } from "#/lib/types";

/**
 * Base scenario templates — org-agnostic wording.
 * Display labels/icons come from src/lib/org.ts so they flex per orgType.
 * Templates use {name} for recipient first name.
 */
export const SCENARIOS: Scenario[] = [
	{
		id: "first_timer",
		label: "First-Time Welcome",
		icon: "✨",
		description: "Warm welcome for someone engaging for the first time",
		template: {
			whatsapp: `Hi {name}, 👋 It was so wonderful connecting with you for the first time! We'd love to get to know you better — feel free to reply anytime. Is there anything we can help you with? We're here for you! 😊`,
			sms: `Hi {name}, Great connecting with you for the first time. We'd love to stay in touch. Reply anytime. From {orgName}`,
		},
	},
	{
		id: "follow_up",
		label: "Follow-Up",
		icon: "🔄",
		description: "Check in with an existing contact or member",
		template: {
			whatsapp: `Hi {name}, 😊 Just checking in. You've been on our minds. How are you doing? We'd love to hear from you and are here if there's anything we can do for you!`,
			sms: `Hi {name}, hope you're well. We've been thinking of you. Feel free to reach out anytime. from {orgName}`,
		},
	},
	{
		id: "event_invite",
		label: "Event Invitation",
		icon: "🎉",
		description: "Invite contacts to an upcoming event or gathering",
		template: {
			whatsapp: `Hi {name}! 🎉 We have something exciting coming up and would *love* to have you join us! Reply *YES* to confirm your spot or ask us for more details. Can't wait to see you there!`,
			sms: `Hi {name}, You're invited to our upcoming event. Reply YES to confirm. More details coming soon. From {orgName}`,
		},
	},
	{
		id: "request",
		label: "Care & Support",
		icon: "🙏",
		description: "Reach out to offer support or check on someone's wellbeing",
		template: {
			whatsapp: `Hi {name}! 🙏 You've been on our hearts and we just wanted to reach out. We hope you're doing well — please know we're here for you. Is there anything we can do to support you right now?`,
			sms: `Hi {name}, you're in our thoughts! We're here for you — please reach out if you need anything. From {orgName}`,
		},
	},
	{
		id: "general",
		label: "General Announcement",
		icon: "📢",
		description: "Broadcast an update or announcement to your contacts",
		template: {
			whatsapp:
				"Hi {name}! 📢 We have an important update to share with you. More details are coming very soon — thank you for being such a valued part of our community!",
			sms: "Hi {name}, Important update coming soon — stay tuned. Thank you, From {orgName}",
		},
	},
];

export const SCENARIO_MAP = new Map<ScenarioId, Scenario>(
	SCENARIOS.map((s) => [s.id, s])
);

export function getTemplate(scenarioId: ScenarioId) {
	return SCENARIO_MAP.get(scenarioId)?.template;
}

/**
 * Variables that are automatically resolved from user/contact data
 * and never need to be filled in manually by the user in the wizard.
 */
export const AUTO_RESOLVED_VARS = new Set(["name", "firstName", "first_name"]);

/**
 * Human-readable labels shown in the wizard "Fill variables" step.
 */
export const VAR_LABELS: Record<string, string> = {
	org: "Organisation name",
	orgName: "Organisation name",
	org_name: "Organisation name",
	date: "Date",
	time: "Time",
	event: "Event name",
	amount: "Amount",
	code: "Code / reference",
	phone: "Phone number",
	location: "Location / venue",
	url: "Link / URL",
	deadline: "Deadline",
	pastor: "Pastor / leader name",
};

/**
 * Extract all {varName} and {{varName}} placeholders from a template string.
 * Returns deduplicated list preserving document order of first appearance.
 *
 * Uses a single-pass alternation regex so both formats are found in the order
 * they appear in the text (not double-braces first, then single-braces).
 *
 * Correctly handles:
 *   {name}            → ["name"]
 *   {{name}}          → ["name"]
 *   {name} {{org}}    → ["name", "org"]  (document order preserved)
 *   {{org}} {org}     → ["org"]          (deduped across both formats)
 *   {{1}}             → []               (numeric placeholders ignored)
 *   { name }          → []               (spaces not allowed)
 */
export function extractTemplateVars(text: string): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	// Alternation: try double-brace before single-brace at each position
	const regex =
		/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}|\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
	for (const m of text.matchAll(regex)) {
		const varName = m[1] ?? m[2]; // m[1] = double-brace, m[2] = single-brace
		if (!seen.has(varName)) {
			seen.add(varName);
			result.push(varName);
		}
	}
	return result;
}

/**
 * Return vars from both WA and SMS template bodies that the user must fill in
 * (i.e. not auto-resolved from contact/org data).
 */
export function getManualVars(whatsapp: string, sms: string): string[] {
	const all = new Set([
		...extractTemplateVars(whatsapp),
		...extractTemplateVars(sms),
	]);
	return [...all].filter((v) => !AUTO_RESOLVED_VARS.has(v));
}

/**
 * Personalise a message for a single contact.
 *
 * Handles both {var} (internal scenario format) and {{var}} (Meta/saved template format).
 *
 * Auto-resolved from contact data (cannot be overridden by templateVars):
 *   {name} / {{name}} / {firstName} / {{firstName}} / {first_name}
 *   → contact's first name, extracted robustly (trimmed, splits on any whitespace)
 *
 * Auto-resolved server-side from user profile (via campaign.router.ts):
 *   {org} / {{org}} / {orgName} / {{orgName}} / {org_name}
 *
 * User-supplied per-campaign (passed in templateVars):
 *   {date} / {{date}}, {event} / {{event}}, {location}, {amount}, {code}, {url}, etc.
 *
 * Unknown vars with no value are left as-is ({var} / {{var}}) so the contact
 * receives a visible placeholder rather than a silent blank.
 *
 * Edge cases handled:
 *   - null / undefined contactName → firstName = ""
 *   - Leading/trailing whitespace in name ("  John  " → "John")
 *   - Multi-space names ("John  Smith" → "John")
 *   - templateVars cannot override {name} — contact's real name always wins
 *   - {{var}} processed before {var} to avoid partial matches inside double-braces
 *   - Numeric Meta placeholders ({{1}}) are never touched (no [a-zA-Z_] start)
 *   - Spaces inside braces ({ name }) are not matched — intentional
 */

const firstNameRegex = /\s+/;
export function personalizeMessage(
	template: string,
	contactName: string | null | undefined,
	templateVars: Record<string, string> = {}
): string {
	// Robust first-name extraction: trim, split on any whitespace run, take first token
	const firstName =
		(contactName ?? "").trim().split(firstNameRegex).filter(Boolean)[0] ?? "";

	// Merge order: templateVars first so contact name aliases always win
	const vars: Record<string, string> = {
		...templateVars,
		// Name aliases — always resolved from the actual contact, not user input
		name: firstName,
		firstName,
		first_name: firstName,
	};

	let result = template;

	// Pass 1: {{var}} — double-brace (Meta / saved template format)
	// Must run before single-brace pass to avoid {var} matching inside {{var}}
	result = result.replace(
		/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
		(match, varName) => (varName in vars ? vars[varName] : match)
	);

	// Pass 2: {var} — single-brace (internal scenario format)
	result = result.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, varName) =>
		varName in vars ? vars[varName] : match
	);

	return result;
}
