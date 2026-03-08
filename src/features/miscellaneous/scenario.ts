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
	id: ScenarioId;
	icon: string;
	label: string;
	description: string;
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
		whatsapp: `Hi {name}, 👋 It was so wonderful connecting with you for the first time! We'd love to get to know you better — feel free to reply anytime. Is there anything we can help you with? We're here for you! 😊`,
		sms: `Hi {name}, Great connecting with you for the first time. We'd love to stay in touch. Reply anytime. From {orgName}`,
	},
	follow_up: {
		whatsapp: `Hi {name}, 😊 Just checking in. You've been on our minds. How are you doing? We'd love to hear from you and are here if there's anything we can do for you!`,
		sms: `Hi {name}, hope you're well. We've been thinking of you. Feel free to reach out anytime. From {orgName}`,
	},
	event_invite: {
		whatsapp: `Hi {name}! 🎉 We have something exciting coming up and would *love* to have you join us! Reply *YES* to confirm your spot or ask us for more details. Can't wait to see you there!`,
		sms: `Hi {name}, You're invited to our upcoming event. Reply YES to confirm. More details coming soon. From {orgName}`,
	},
	request: {
		whatsapp: `Hi {name}! 🙏 You've been on our hearts and we just wanted to reach out. We hope you're doing well — please know we're here for you. Is there anything we can do to support you right now?`,
		sms: `Hi {name}, you're in our thoughts! We're here for you — please reach out if you need anything. From {orgName}`,
	},
	general: {
		whatsapp: `Hi {name}! 📢 We have an important update to share with you. More details are coming very soon — thank you for being such a valued part of our community!`,
		sms: `Hi {name}, Important update coming soon — stay tuned. Thank you, From {orgName}`,
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
	pastor: "Pastor / leader name",
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

	result = result.replace(
		/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
		(match, varName) => (varName in vars ? vars[varName] : match)
	);

	return result;
}
