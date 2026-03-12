import type { ScenarioId } from "#/lib/types";

/**
 * Scenarios are stable app-level metadata — category identity, icon, display label.
 * They are NOT template bodies. Template bodies live in the DB as user-owned
 * MessageTemplate rows, seeded from SCENARIO_SEED_TEMPLATES on first onboarding.
 *
 * Separation of concerns:
 *   - ScenarioMeta  → what kind of outreach is this? (app-level, never changes)
 *   - Template body → what does the message say? (DB, user editable)
 */

// ─── Scenario metadata ────────────────────────────────────────────────────────

export interface ScenarioMeta {
	description: string;
	icon: string;
	id: ScenarioId;
	label: string;
}

export const SCENARIOS: ScenarioMeta[] = [
	{
		id: "first_timer",
		icon: "✨",
		label: "First-Time Welcome",
		description: "Warm welcome for someone engaging for the first time",
	},
	{
		id: "follow_up",
		icon: "🔄",
		label: "Follow-Up",
		description: "Check in with an existing contact",
	},
	{
		id: "event_invite",
		icon: "🎉",
		label: "Event Invitation",
		description: "Invite contacts to an upcoming event or gathering",
	},
	{
		id: "request",
		icon: "🙏",
		label: "Care & Support",
		description: "Reach out to offer support or check on someone's wellbeing",
	},
	{
		id: "general",
		icon: "📢",
		label: "General Announcement",
		description: "Broadcast an update or announcement to your contacts",
	},
];

export const SCENARIO_MAP = new Map<ScenarioId, ScenarioMeta>(
	SCENARIOS.map((s) => [s.id, s])
);

// ─── Seed template bodies ─────────────────────────────────────────────────────
//
// Written to each new user's MessageTemplate rows during onboarding completion.
// After seeding the user owns and can edit those rows freely.
// NEVER used at send-time — campaign router always fetches from DB.

export const SCENARIO_SEED_TEMPLATES: Record<
	ScenarioId,
	{ whatsapp: string; sms: string }
> = {
	first_timer: {
		whatsapp: `Hi {name}! 👋 Welcome — we're really glad to have you on board with {orgName}. Feel free to reply anytime if you have questions or need a hand. We're here to help! 😊`,
		sms: "Hi {name}, welcome to {orgName}! Glad to have you with us. Reach out anytime. Reply STOP to opt out.",
	},
	follow_up: {
		whatsapp: `Hi {name}, 😊 just checking in from the team at {orgName}. How are things going? We'd love to hear from you — let us know if there's anything we can do for you.`,
		sms: `Hi {name}, following up from {orgName}. How are things? We're here if you need anything. Reply STOP to opt out.`,
	},
	event_invite: {
		whatsapp: `Hi {name}! 🎉 {orgName} has something coming up and we'd love to have you join us. Reply *YES* to confirm your spot or ask us for more details!`,
		sms: `Hi {name}, you're invited to an upcoming event from {orgName}. Reply YES to confirm. More details coming soon. Reply STOP to opt out.`,
	},
	request: {
		whatsapp: `Hi {name}, 💬 the team at {orgName} is reaching out to check in. We hope you're doing well — is there anything we can help you with or any way we can support you right now?`,
		sms: `Hi {name}, checking in from {orgName}. We're here if you need anything — don't hesitate to reply. Reply STOP to opt out.`,
	},
	general: {
		whatsapp:
			"Hi {name}! 📢 {orgName} has an important update to share with you. Stay tuned — more details are on the way. Thank you for being a valued part of what we do!",
		sms: "Hi {name}, important update from {orgName} coming soon. Thank you. Reply STOP to opt out.",
	},
};

// ─── Variable helpers ─────────────────────────────────────────────────────────

export const AUTO_RESOLVED_VARS = new Set([
	"name",
	"firstName",
	"first_name",
	"org",
	"orgName",
	"org_name",
]);

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
	leader: "Leader / contact name",
};

export function extractTemplateVars(text: string): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	const regex =
		/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}|\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
	for (const m of text.matchAll(regex)) {
		const varName = m[1] ?? m[2];
		if (!seen.has(varName)) {
			seen.add(varName);
			result.push(varName);
		}
	}
	return result;
}

export function getManualVars(whatsapp: string, sms: string): string[] {
	const all = new Set([
		...extractTemplateVars(whatsapp),
		...extractTemplateVars(sms),
	]);
	return [...all].filter((v) => !AUTO_RESOLVED_VARS.has(v));
}

const firstNameRegex = /\s+/;

export function personalizeMessage(
	template: string,
	contactName: string | null | undefined,
	templateVars: Record<string, string> = {}
): string {
	const firstName =
		(contactName ?? "").trim().split(firstNameRegex).filter(Boolean)[0] ?? "";

	const vars: Record<string, string> = {
		...templateVars,
		name: firstName,
		firstName,
		first_name: firstName,
	};

	let result = template;

	result = result.replace(
		/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
		(match, varName) => (varName in vars ? vars[varName] : match)
	);

	result = result.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, varName) =>
		varName in vars ? vars[varName] : match
	);

	return result;
}
