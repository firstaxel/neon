/**
 * meta-templates.ts
 *
 * Ready-to-submit WhatsApp Business API template definitions.
 * One template per: orgType × scenario × channel (WA marketing, WA utility, SMS).
 *
 * Rules for Meta MARKETING approval:
 *  - Must include opt-out language (we use "Reply STOP to unsubscribe")
 *  - Variables must be in {{1}} positional format for Meta submission
 *    (we store named vars internally; the submit helper maps them)
 *  - Body <= 1024 chars
 *  - No URLs in first message to cold audiences (Meta rejects these)
 *
 * Rules for Meta UTILITY approval:
 *  - Must relate to an ongoing transaction / service the user opted into
 *  - Cannot contain promotional language ("sale", "discount", "offer")
 *  - Consent / confirmation framing works well
 *
 * Variable convention (internal named format):
 *   {{name}}    → contact first name
 *   {{orgName}} → organisation name
 *   {{event}}   → event name (user fills in wizard)
 *   {{date}}    → date (user fills in wizard)
 *   {{time}}    → time (user fills in wizard)
 *   {{location}} → location / venue (user fills in wizard)
 */

import type { ScenarioId } from "#/lib/types";
import type { OrgType } from "./org";

export interface MetaTemplateDefinition {
	bodyText: string; // named-var format for internal use
	bodyVars: string[]; // ordered list matching {{1}}, {{2}} … for Meta
	category: "MARKETING" | "UTILITY";
	displayName: string;
	footerText?: string;
	language: "en";
	/** Internal snake_case name — submitted to Meta as-is */
	name: string;
	smsBody: string; // SMS fallback (no opt-out required by Termii)
}

type TemplateLibrary = Record<
	OrgType,
	Record<ScenarioId, MetaTemplateDefinition>
>;

// ─── Church / Ministry ─────────────────────────────────────────────────────────

const church: Record<ScenarioId, MetaTemplateDefinition> = {
	first_timer: {
		name: "church_first_timer_welcome",
		displayName: "First Timer Welcome",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 👋 We're so glad you joined us at {{orgName}} for the first time. Your presence meant so much to us!\n\nWe'd love to stay connected and support your journey. Feel free to reply anytime — we're here for you. 😊\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're glad you joined us. Feel free to reach out anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	follow_up: {
		name: "church_follow_up",
		displayName: "Member Follow-Up",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 😊 you've been on our hearts at {{orgName}} and we just wanted to check in.\n\nHow are you doing? Is there anything we can pray for or support you with? We're always here.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, the team at {{orgName}} has been thinking of you. How are you doing? Reply anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	event_invite: {
		name: "church_event_invite",
		displayName: "Service / Event Invitation",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🎉 You're warmly invited to *{{event}}* at {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe would love to have you with us. Please reply YES to confirm or ask us any questions!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		smsBody:
			"Hi {{name}}, you're invited to {{event}} at {{orgName}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	request: {
		name: "church_prayer_support",
		displayName: "Prayer & Support",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🙏 the team at {{orgName}} has been holding you in prayer and wanted to reach out.\n\nWe hope you're doing well. Please know we're here for you — whatever you may be walking through. Is there anything specific we can pray for?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, the team at {{orgName}} is praying for you. We're here if you need anything. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	general: {
		name: "church_general_announcement",
		displayName: "General Announcement",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has an important update to share with you.\n\n{{event}}\n\nThank you for being a valued part of our community. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		smsBody:
			"Hi {{name}}, announcement from {{orgName}}: {{event}}. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},
};

// ─── NGO / Charity ─────────────────────────────────────────────────────────────

const ngo: Record<ScenarioId, MetaTemplateDefinition> = {
	first_timer: {
		name: "ngo_new_beneficiary_welcome",
		displayName: "New Beneficiary Welcome",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 👋 Welcome to {{orgName}}. We're so glad you've connected with us.\n\nOur team is here to support you every step of the way. Don't hesitate to reach out — we're just a message away. 😊\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're here to support you. Reach out anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	follow_up: {
		name: "ngo_beneficiary_follow_up",
		displayName: "Beneficiary Follow-Up",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🤝 the team at {{orgName}} is checking in on you.\n\nHow are things going? We want to make sure you have everything you need. Please reply anytime — your wellbeing matters to us.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, checking in from {{orgName}}. How are you? We want to make sure you're supported. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	event_invite: {
		name: "ngo_programme_invite",
		displayName: "Programme / Workshop Invite",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🎉 You're invited to *{{event}}*, brought to you by {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nThis programme is designed for you. We'd love your participation — reply YES to confirm your spot.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		smsBody:
			"Hi {{name}}, you're invited to {{event}} by {{orgName}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	request: {
		name: "ngo_welfare_check",
		displayName: "Welfare Check",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🌟 we at {{orgName}} have been thinking about you and wanted to check in.\n\nYour wellbeing matters to us. Is there anything we can do to help or support you right now? We're here.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welfare check from {{orgName}}. We care about how you're doing. Is there anything we can help with? Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	general: {
		name: "ngo_network_update",
		displayName: "Network Announcement",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has an update for our network.\n\n{{event}}\n\nThank you for being part of what we do together. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		smsBody:
			"Hi {{name}}, update from {{orgName}}: {{event}}. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},
};

// ─── School / Academy ─────────────────────────────────────────────────────────

const school: Record<ScenarioId, MetaTemplateDefinition> = {
	first_timer: {
		name: "school_new_student_welcome",
		displayName: "New Student / Parent Welcome",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 👋 A warm welcome to {{orgName}}! We're delighted to have you join our school community.\n\nOur team is here to support you and answer any questions you may have. Feel free to reach out anytime.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're glad to have you. Contact us anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	follow_up: {
		name: "school_student_follow_up",
		displayName: "Student / Parent Check-In",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 📚 the team at {{orgName}} is checking in.\n\nWe'd love to know how things are going for you. Is there anything we can do to support your experience with us?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, checking in from {{orgName}}. How are things? We're here if you need anything. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	event_invite: {
		name: "school_event_invite",
		displayName: "School Event Invitation",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🎓 You're invited to *{{event}}* at {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe look forward to seeing you there. Reply YES to confirm attendance.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		smsBody:
			"Hi {{name}}, you're invited to {{event}} at {{orgName}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	request: {
		name: "school_pastoral_checkin",
		displayName: "Pastoral / Welfare Check-In",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🏫 our team at {{orgName}} has been thinking of you and wanted to reach out.\n\nWe want to make sure you're doing well and feeling supported. Please don't hesitate to reply — we're here to help.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, pastoral check from {{orgName}}. We hope you're well — please reach out if you need support. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	general: {
		name: "school_announcement",
		displayName: "School Announcement",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 📢 Important notice from {{orgName}}.\n\n{{event}}\n\nThank you for being part of our school community. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		smsBody:
			"Hi {{name}}, notice from {{orgName}}: {{event}}. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},
};

// ─── Business ─────────────────────────────────────────────────────────────────

const business: Record<ScenarioId, MetaTemplateDefinition> = {
	first_timer: {
		name: "business_new_customer_welcome",
		displayName: "New Customer Welcome",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 👋 Welcome to {{orgName}} — we're thrilled to have you as a new customer.\n\nIf you ever have questions or need assistance, we're just a message away. We look forward to serving you!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're glad to have you. Message us anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	follow_up: {
		name: "business_customer_follow_up",
		displayName: "Customer Follow-Up",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 😊 the team at {{orgName}} is checking in.\n\nWe hope your experience with us has been great. Is there anything we can help you with or improve for you?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, following up from {{orgName}}. How has your experience been? We'd love to hear from you. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	event_invite: {
		name: "business_event_promotion",
		displayName: "Event / Promotion Invite",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🎉 {{orgName}} is hosting *{{event}}* and you're invited!\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe'd love to see you there. Reply YES to save your spot.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		smsBody:
			"Hi {{name}}, {{orgName}} invites you to {{event}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	request: {
		name: "business_customer_care",
		displayName: "Customer Care Outreach",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 💬 our team at {{orgName}} is reaching out to make sure you're completely satisfied.\n\nIs there anything we can do better for you, or any way we can help? Your feedback is very important to us.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, care check from {{orgName}}. Are you satisfied with our service? We'd love your feedback. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	general: {
		name: "business_general_update",
		displayName: "Business Update",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 📢 Important update from {{orgName}}.\n\n{{event}}\n\nThank you for choosing {{orgName}}. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		smsBody:
			"Hi {{name}}, update from {{orgName}}: {{event}}. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},
};

// ─── Community ─────────────────────────────────────────────────────────────────

const community: Record<ScenarioId, MetaTemplateDefinition> = {
	first_timer: {
		name: "community_new_member_welcome",
		displayName: "New Member Welcome",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🌍 Welcome to {{orgName}}! We're so glad to have you as part of our community.\n\nWe're here to connect, support, and grow together. Feel free to reach out anytime!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! Glad to have you with us. Reply anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	follow_up: {
		name: "community_member_follow_up",
		displayName: "Member Check-In",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🤝 the team at {{orgName}} is thinking of you!\n\nHow have you been? We'd love to stay connected and hear how things are going for you.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, check-in from {{orgName}}. How are you doing? We'd love to hear from you. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	event_invite: {
		name: "community_event_invite",
		displayName: "Community Event Invite",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🎉 {{orgName}} is bringing the community together for *{{event}}*!\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nCome connect with your community. Reply YES to confirm you're coming!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		smsBody:
			"Hi {{name}}, community event from {{orgName}}: {{event}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	request: {
		name: "community_member_support",
		displayName: "Member Support Outreach",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🌟 we at {{orgName}} are reaching out to check in on you.\n\nWe want to make sure you feel supported and connected. Is there anything we can do for you?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, support check from {{orgName}}. We want to make sure you're doing well — reply if you need anything. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	general: {
		name: "community_update",
		displayName: "Community Update",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has a community update to share.\n\n{{event}}\n\nThank you for being part of our community. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		smsBody:
			"Hi {{name}}, update from {{orgName}}: {{event}}. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},
};

// ─── Other ─────────────────────────────────────────────────────────────────────

const other: Record<ScenarioId, MetaTemplateDefinition> = {
	first_timer: {
		name: "general_first_time_welcome",
		displayName: "First-Time Welcome",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 👋 Welcome — we're so glad you connected with {{orgName}} for the first time.\n\nFeel free to reach out anytime. We're here to help!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! Glad to have you. Reply anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	follow_up: {
		name: "general_contact_follow_up",
		displayName: "Contact Follow-Up",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 😊 just checking in from {{orgName}}.\n\nHow are you doing? We'd love to hear from you and make sure you have everything you need.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, checking in from {{orgName}}. How are you? Reply anytime. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	event_invite: {
		name: "general_event_invite",
		displayName: "Event Invitation",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 🎉 You're invited to *{{event}}* from {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe'd love to see you there — reply YES to confirm!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		smsBody:
			"Hi {{name}}, invitation from {{orgName}}: {{event}} on {{date}} at {{time}}, {{location}}. Reply YES. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	request: {
		name: "general_care_outreach",
		displayName: "Care & Support Outreach",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}, 🙏 the team at {{orgName}} is reaching out to check in on you.\n\nWe hope you're doing well. Is there anything we can help you with?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		smsBody:
			"Hi {{name}}, care check from {{orgName}}. We hope you're well. Reply if you need anything. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},

	general: {
		name: "general_announcement",
		displayName: "General Announcement",
		category: "MARKETING",
		language: "en",
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has an important announcement.\n\n{{event}}\n\nThank you. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		smsBody: "Hi {{name}}, from {{orgName}}: {{event}}. Reply STOP to opt out.",
		footerText: "{{orgName}}",
	},
};

// ─── Utility consent template (shared across all org types) ───────────────────
//
// One utility template is registered per app install — this is the pre-screen
// consent message sent before the real marketing body.
// Must be pre-approved by Meta under the UTILITY category.

export const UTILITY_CONSENT_TEMPLATE: MetaTemplateDefinition = {
	name: "messagedesk_consent_v1",
	displayName: "Message Consent Request",
	category: "UTILITY",
	language: "en",
	bodyText:
		"Hi {{name}}, {{orgName}} would like to send you a message. Reply *YES* to receive it, or STOP to opt out.",
	bodyVars: ["name", "orgName"],
	smsBody: "", // utility templates are WA-only
	footerText: undefined,
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const META_TEMPLATE_LIBRARY: TemplateLibrary = {
	church,
	ngo,
	school,
	business,
	community,
	other,
};

/**
 * Get the Meta-ready template definition for a given orgType + scenario.
 * Falls back to "other" if orgType is unknown.
 */
export function getMetaTemplate(
	orgType: string | null | undefined,
	scenarioId: ScenarioId
): MetaTemplateDefinition {
	const org = (orgType as OrgType) ?? "other";
	return (
		META_TEMPLATE_LIBRARY[org]?.[scenarioId] ??
		META_TEMPLATE_LIBRARY.other[scenarioId]
	);
}

/**
 * Get all templates for a given orgType — useful for bulk seeding
 * or displaying the full template library to a user.
 */
export function getAllMetaTemplatesForOrg(
	orgType: string | null | undefined
): MetaTemplateDefinition[] {
	const org = (orgType as OrgType) ?? "other";
	return Object.values(
		META_TEMPLATE_LIBRARY[org] ?? META_TEMPLATE_LIBRARY.other
	);
}

// ─── Utility consent templates — per orgType × scenario ───────────────────────
//
// These are sent as the UTILITY pre-screen message — cheap (~₦8) and warm.
// The goal is to make people naturally want to reply — any reply triggers the
// real message. They must NOT contain promotional language.
// Each template is a warm check-in / curiosity-driver, not "reply YES to receive".

export const UTILITY_TEMPLATES: Record<
	OrgType,
	Record<ScenarioId, MetaTemplateDefinition>
> = {
	church: {
		first_timer: {
			name: "church_consent_first_timer",
			displayName: "First Timer — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! 😊 The team at {{orgName}} has been thinking about you since your first visit. How are you settling in?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		follow_up: {
			name: "church_consent_follow_up",
			displayName: "Follow-Up — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, it's been a while since we've connected at {{orgName}}. We've been thinking of you — how have you been?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		event_invite: {
			name: "church_consent_event",
			displayName: "Event — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! Something special is coming up at {{orgName}} that we think you'd really enjoy. Can we share the details with you?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		request: {
			name: "church_consent_request",
			displayName: "Prayer & Support — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the team at {{orgName}} has been holding you in prayer lately. How are you doing?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		general: {
			name: "church_consent_general",
			displayName: "General — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! We have something important to share with you from {{orgName}}. Is now a good time?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
	},

	ngo: {
		first_timer: {
			name: "ngo_consent_first_timer",
			displayName: "New Beneficiary — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, welcome to the {{orgName}} family! We'd love to check in on how you're settling in. How are things going?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		follow_up: {
			name: "ngo_consent_follow_up",
			displayName: "Follow-Up — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the team at {{orgName}} has been thinking about you. How have things been since we last connected?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		event_invite: {
			name: "ngo_consent_event",
			displayName: "Programme — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! We have an upcoming programme at {{orgName}} that might be perfect for you. Can we share the details?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		request: {
			name: "ngo_consent_request",
			displayName: "Welfare Check — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the {{orgName}} team wanted to check in on you today. How are you getting on?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		general: {
			name: "ngo_consent_general",
			displayName: "General — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, we have an update from {{orgName}} to share with you. Do you have a moment?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
	},

	school: {
		first_timer: {
			name: "school_consent_first_timer",
			displayName: "New Student — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! The team at {{orgName}} wanted to check in as you settle in with us. How is everything going so far?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		follow_up: {
			name: "school_consent_follow_up",
			displayName: "Student Follow-Up — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the {{orgName}} team is thinking of you. How have things been going recently?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		event_invite: {
			name: "school_consent_event",
			displayName: "School Event — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! {{orgName}} has an upcoming event we think you and your family would enjoy. Can we share the details?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		request: {
			name: "school_consent_request",
			displayName: "Pastoral — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, someone from the {{orgName}} pastoral team wanted to reach out. How are you doing?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		general: {
			name: "school_consent_general",
			displayName: "School Notice — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, {{orgName}} has an important notice to share with you. Is this a good time?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
	},

	business: {
		first_timer: {
			name: "business_consent_first_timer",
			displayName: "New Customer — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! The {{orgName}} team wanted to check in after your first experience with us. How did everything go?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		follow_up: {
			name: "business_consent_follow_up",
			displayName: "Customer Follow-Up — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the team at {{orgName}} is checking in. How has your experience been with us recently?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		event_invite: {
			name: "business_consent_event",
			displayName: "Event / Promo — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! We have something coming up at {{orgName}} that we thought you might want to know about. Can we share it?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		request: {
			name: "business_consent_request",
			displayName: "Customer Care — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the {{orgName}} team wanted to reach out and make sure everything is going well for you. How are things?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		general: {
			name: "business_consent_general",
			displayName: "Business Update — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, {{orgName}} has an update we'd like to share with you. Do you have a moment?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
	},

	community: {
		first_timer: {
			name: "community_consent_first_timer",
			displayName: "New Member — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! The {{orgName}} community has been thinking about you since you joined. How are you finding things so far?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		follow_up: {
			name: "community_consent_follow_up",
			displayName: "Member Follow-Up — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the team at {{orgName}} is thinking of you. How have you been lately?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		event_invite: {
			name: "community_consent_event",
			displayName: "Community Event — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! Something exciting is happening in the {{orgName}} community soon. Can we share the details with you?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		request: {
			name: "community_consent_request",
			displayName: "Member Support — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the {{orgName}} team wanted to check in on you. Is there anything we can help with?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		general: {
			name: "community_consent_general",
			displayName: "Community Update — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, we have a community update from {{orgName}} to share with you. Got a minute?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
	},

	other: {
		first_timer: {
			name: "general_consent_first_timer",
			displayName: "First-Time — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! The team at {{orgName}} wanted to reach out and say hello. How are you doing?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		follow_up: {
			name: "general_consent_follow_up",
			displayName: "Follow-Up — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, just checking in from {{orgName}}. How have things been going for you?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		event_invite: {
			name: "general_consent_event",
			displayName: "Event — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}! {{orgName}} has something coming up we think you'd be interested in. Can we share the details?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		request: {
			name: "general_consent_request",
			displayName: "Care Outreach — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, the team at {{orgName}} wanted to check in on you. How are things going?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
		general: {
			name: "general_consent_general",
			displayName: "General — Consent",
			category: "UTILITY",
			language: "en",
			bodyText:
				"Hi {{name}}, we have something to share with you from {{orgName}}. Is now a good time?",
			bodyVars: ["name", "orgName"],
			smsBody: "",
		},
	},
};

/**
 * Get the utility consent template for a specific orgType + scenario.
 * This is sent as the pre-screen message — any reply triggers the real message.
 */
export function getUtilityTemplate(
	orgType: string | null | undefined,
	scenarioId: ScenarioId
): MetaTemplateDefinition {
	const org = (orgType as OrgType) ?? "other";
	return (
		UTILITY_TEMPLATES[org]?.[scenarioId] ?? UTILITY_TEMPLATES.other[scenarioId]
	);
}
