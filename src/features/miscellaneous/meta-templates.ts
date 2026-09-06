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
	event_invite: {
		bodyText:
			"Hi {{name}}! 🎉 You're warmly invited to *{{event}}* at {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe would love to have you with us. Please reply YES to confirm or ask us any questions!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		category: "MARKETING",
		displayName: "Service / Event Invitation",
		footerText: "{{orgName}}",
		language: "en",
		name: "church_event_invite",
		smsBody:
			"Hi {{name}}, you're invited to {{event}} at {{orgName}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
	},
	first_timer: {
		bodyText:
			"Hi {{name}}! 👋 We're so glad you joined us at {{orgName}} for the first time. Your presence meant so much to us!\n\nWe'd love to stay connected and support your journey. Feel free to reply anytime — we're here for you. 😊\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "First Timer Welcome",
		footerText: "{{orgName}}",
		language: "en",
		name: "church_first_timer_welcome",
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're glad you joined us. Feel free to reach out anytime. Reply STOP to opt out.",
	},

	follow_up: {
		bodyText:
			"Hi {{name}}, 😊 you've been on our hearts at {{orgName}} and we just wanted to check in.\n\nHow are you doing? Is there anything we can pray for or support you with? We're always here.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Member Follow-Up",
		footerText: "{{orgName}}",
		language: "en",
		name: "church_follow_up",
		smsBody:
			"Hi {{name}}, the team at {{orgName}} has been thinking of you. How are you doing? Reply anytime. Reply STOP to opt out.",
	},

	general: {
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has an important update to share with you.\n\n{{event}}\n\nThank you for being a valued part of our community. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		category: "MARKETING",
		displayName: "General Announcement",
		footerText: "{{orgName}}",
		language: "en",
		name: "church_general_announcement",
		smsBody:
			"Hi {{name}}, announcement from {{orgName}}: {{event}}. Reply STOP to opt out.",
	},

	request: {
		bodyText:
			"Hi {{name}}, 🙏 the team at {{orgName}} has been holding you in prayer and wanted to reach out.\n\nWe hope you're doing well. Please know we're here for you — whatever you may be walking through. Is there anything specific we can pray for?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Prayer & Support",
		footerText: "{{orgName}}",
		language: "en",
		name: "church_prayer_support",
		smsBody:
			"Hi {{name}}, the team at {{orgName}} is praying for you. We're here if you need anything. Reply STOP to opt out.",
	},
};

// ─── NGO / Charity ─────────────────────────────────────────────────────────────

const ngo: Record<ScenarioId, MetaTemplateDefinition> = {
	event_invite: {
		bodyText:
			"Hi {{name}}! 🎉 You're invited to *{{event}}*, brought to you by {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nThis programme is designed for you. We'd love your participation — reply YES to confirm your spot.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		category: "MARKETING",
		displayName: "Programme / Workshop Invite",
		footerText: "{{orgName}}",
		language: "en",
		name: "ngo_programme_invite",
		smsBody:
			"Hi {{name}}, you're invited to {{event}} by {{orgName}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
	},
	first_timer: {
		bodyText:
			"Hi {{name}}! 👋 Welcome to {{orgName}}. We're so glad you've connected with us.\n\nOur team is here to support you every step of the way. Don't hesitate to reach out — we're just a message away. 😊\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "New Beneficiary Welcome",
		footerText: "{{orgName}}",
		language: "en",
		name: "ngo_new_beneficiary_welcome",
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're here to support you. Reach out anytime. Reply STOP to opt out.",
	},

	follow_up: {
		bodyText:
			"Hi {{name}}, 🤝 the team at {{orgName}} is checking in on you.\n\nHow are things going? We want to make sure you have everything you need. Please reply anytime — your wellbeing matters to us.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Beneficiary Follow-Up",
		footerText: "{{orgName}}",
		language: "en",
		name: "ngo_beneficiary_follow_up",
		smsBody:
			"Hi {{name}}, checking in from {{orgName}}. How are you? We want to make sure you're supported. Reply STOP to opt out.",
	},

	general: {
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has an update for our network.\n\n{{event}}\n\nThank you for being part of what we do together. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		category: "MARKETING",
		displayName: "Network Announcement",
		footerText: "{{orgName}}",
		language: "en",
		name: "ngo_network_update",
		smsBody:
			"Hi {{name}}, update from {{orgName}}: {{event}}. Reply STOP to opt out.",
	},

	request: {
		bodyText:
			"Hi {{name}}, 🌟 we at {{orgName}} have been thinking about you and wanted to check in.\n\nYour wellbeing matters to us. Is there anything we can do to help or support you right now? We're here.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Welfare Check",
		footerText: "{{orgName}}",
		language: "en",
		name: "ngo_welfare_check",
		smsBody:
			"Hi {{name}}, welfare check from {{orgName}}. We care about how you're doing. Is there anything we can help with? Reply STOP to opt out.",
	},
};

// ─── School / Academy ─────────────────────────────────────────────────────────

const school: Record<ScenarioId, MetaTemplateDefinition> = {
	event_invite: {
		bodyText:
			"Hi {{name}}! 🎓 You're invited to *{{event}}* at {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe look forward to seeing you there. Reply YES to confirm attendance.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		category: "MARKETING",
		displayName: "School Event Invitation",
		footerText: "{{orgName}}",
		language: "en",
		name: "school_event_invite",
		smsBody:
			"Hi {{name}}, you're invited to {{event}} at {{orgName}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
	},
	first_timer: {
		bodyText:
			"Hi {{name}}! 👋 A warm welcome to {{orgName}}! We're delighted to have you join our school community.\n\nOur team is here to support you and answer any questions you may have. Feel free to reach out anytime.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "New Student / Parent Welcome",
		footerText: "{{orgName}}",
		language: "en",
		name: "school_new_student_welcome",
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're glad to have you. Contact us anytime. Reply STOP to opt out.",
	},

	follow_up: {
		bodyText:
			"Hi {{name}}, 📚 the team at {{orgName}} is checking in.\n\nWe'd love to know how things are going for you. Is there anything we can do to support your experience with us?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Student / Parent Check-In",
		footerText: "{{orgName}}",
		language: "en",
		name: "school_student_follow_up",
		smsBody:
			"Hi {{name}}, checking in from {{orgName}}. How are things? We're here if you need anything. Reply STOP to opt out.",
	},

	general: {
		bodyText:
			"Hi {{name}}! 📢 Important notice from {{orgName}}.\n\n{{event}}\n\nThank you for being part of our school community. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		category: "MARKETING",
		displayName: "School Announcement",
		footerText: "{{orgName}}",
		language: "en",
		name: "school_announcement",
		smsBody:
			"Hi {{name}}, notice from {{orgName}}: {{event}}. Reply STOP to opt out.",
	},

	request: {
		bodyText:
			"Hi {{name}}, 🏫 our team at {{orgName}} has been thinking of you and wanted to reach out.\n\nWe want to make sure you're doing well and feeling supported. Please don't hesitate to reply — we're here to help.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Pastoral / Welfare Check-In",
		footerText: "{{orgName}}",
		language: "en",
		name: "school_pastoral_checkin",
		smsBody:
			"Hi {{name}}, pastoral check from {{orgName}}. We hope you're well — please reach out if you need support. Reply STOP to opt out.",
	},
};

// ─── Business ─────────────────────────────────────────────────────────────────

const business: Record<ScenarioId, MetaTemplateDefinition> = {
	event_invite: {
		bodyText:
			"Hi {{name}}! 🎉 {{orgName}} is hosting *{{event}}* and you're invited!\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe'd love to see you there. Reply YES to save your spot.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		category: "MARKETING",
		displayName: "Event / Promotion Invite",
		footerText: "{{orgName}}",
		language: "en",
		name: "business_event_promotion",
		smsBody:
			"Hi {{name}}, {{orgName}} invites you to {{event}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
	},
	first_timer: {
		bodyText:
			"Hi {{name}}! 👋 Welcome to {{orgName}} — we're thrilled to have you as a new customer.\n\nIf you ever have questions or need assistance, we're just a message away. We look forward to serving you!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "New Customer Welcome",
		footerText: "{{orgName}}",
		language: "en",
		name: "business_new_customer_welcome",
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! We're glad to have you. Message us anytime. Reply STOP to opt out.",
	},

	follow_up: {
		bodyText:
			"Hi {{name}}, 😊 the team at {{orgName}} is checking in.\n\nWe hope your experience with us has been great. Is there anything we can help you with or improve for you?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Customer Follow-Up",
		footerText: "{{orgName}}",
		language: "en",
		name: "business_customer_follow_up",
		smsBody:
			"Hi {{name}}, following up from {{orgName}}. How has your experience been? We'd love to hear from you. Reply STOP to opt out.",
	},

	general: {
		bodyText:
			"Hi {{name}}! 📢 Important update from {{orgName}}.\n\n{{event}}\n\nThank you for choosing {{orgName}}. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		category: "MARKETING",
		displayName: "Business Update",
		footerText: "{{orgName}}",
		language: "en",
		name: "business_general_update",
		smsBody:
			"Hi {{name}}, update from {{orgName}}: {{event}}. Reply STOP to opt out.",
	},

	request: {
		bodyText:
			"Hi {{name}}, 💬 our team at {{orgName}} is reaching out to make sure you're completely satisfied.\n\nIs there anything we can do better for you, or any way we can help? Your feedback is very important to us.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Customer Care Outreach",
		footerText: "{{orgName}}",
		language: "en",
		name: "business_customer_care",
		smsBody:
			"Hi {{name}}, care check from {{orgName}}. Are you satisfied with our service? We'd love your feedback. Reply STOP to opt out.",
	},
};

// ─── Community ─────────────────────────────────────────────────────────────────

const community: Record<ScenarioId, MetaTemplateDefinition> = {
	event_invite: {
		bodyText:
			"Hi {{name}}! 🎉 {{orgName}} is bringing the community together for *{{event}}*!\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nCome connect with your community. Reply YES to confirm you're coming!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		category: "MARKETING",
		displayName: "Community Event Invite",
		footerText: "{{orgName}}",
		language: "en",
		name: "community_event_invite",
		smsBody:
			"Hi {{name}}, community event from {{orgName}}: {{event}} on {{date}} at {{time}}, {{location}}. Reply YES to confirm. Reply STOP to opt out.",
	},
	first_timer: {
		bodyText:
			"Hi {{name}}! 🌍 Welcome to {{orgName}}! We're so glad to have you as part of our community.\n\nWe're here to connect, support, and grow together. Feel free to reach out anytime!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "New Member Welcome",
		footerText: "{{orgName}}",
		language: "en",
		name: "community_new_member_welcome",
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! Glad to have you with us. Reply anytime. Reply STOP to opt out.",
	},

	follow_up: {
		bodyText:
			"Hi {{name}}, 🤝 the team at {{orgName}} is thinking of you!\n\nHow have you been? We'd love to stay connected and hear how things are going for you.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Member Check-In",
		footerText: "{{orgName}}",
		language: "en",
		name: "community_member_follow_up",
		smsBody:
			"Hi {{name}}, check-in from {{orgName}}. How are you doing? We'd love to hear from you. Reply STOP to opt out.",
	},

	general: {
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has a community update to share.\n\n{{event}}\n\nThank you for being part of our community. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		category: "MARKETING",
		displayName: "Community Update",
		footerText: "{{orgName}}",
		language: "en",
		name: "community_update",
		smsBody:
			"Hi {{name}}, update from {{orgName}}: {{event}}. Reply STOP to opt out.",
	},

	request: {
		bodyText:
			"Hi {{name}}, 🌟 we at {{orgName}} are reaching out to check in on you.\n\nWe want to make sure you feel supported and connected. Is there anything we can do for you?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Member Support Outreach",
		footerText: "{{orgName}}",
		language: "en",
		name: "community_member_support",
		smsBody:
			"Hi {{name}}, support check from {{orgName}}. We want to make sure you're doing well — reply if you need anything. Reply STOP to opt out.",
	},
};

// ─── Other ─────────────────────────────────────────────────────────────────────

const other: Record<ScenarioId, MetaTemplateDefinition> = {
	event_invite: {
		bodyText:
			"Hi {{name}}! 🎉 You're invited to *{{event}}* from {{orgName}}.\n\n📅 {{date}}\n⏰ {{time}}\n📍 {{location}}\n\nWe'd love to see you there — reply YES to confirm!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "event", "orgName", "date", "time", "location"],
		category: "MARKETING",
		displayName: "Event Invitation",
		footerText: "{{orgName}}",
		language: "en",
		name: "general_event_invite",
		smsBody:
			"Hi {{name}}, invitation from {{orgName}}: {{event}} on {{date}} at {{time}}, {{location}}. Reply YES. Reply STOP to opt out.",
	},
	first_timer: {
		bodyText:
			"Hi {{name}}! 👋 Welcome — we're so glad you connected with {{orgName}} for the first time.\n\nFeel free to reach out anytime. We're here to help!\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "First-Time Welcome",
		footerText: "{{orgName}}",
		language: "en",
		name: "general_first_time_welcome",
		smsBody:
			"Hi {{name}}, welcome to {{orgName}}! Glad to have you. Reply anytime. Reply STOP to opt out.",
	},

	follow_up: {
		bodyText:
			"Hi {{name}}, 😊 just checking in from {{orgName}}.\n\nHow are you doing? We'd love to hear from you and make sure you have everything you need.\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Contact Follow-Up",
		footerText: "{{orgName}}",
		language: "en",
		name: "general_contact_follow_up",
		smsBody:
			"Hi {{name}}, checking in from {{orgName}}. How are you? Reply anytime. Reply STOP to opt out.",
	},

	general: {
		bodyText:
			"Hi {{name}}! 📢 {{orgName}} has an important announcement.\n\n{{event}}\n\nThank you. Reply STOP to unsubscribe.",
		bodyVars: ["name", "orgName", "event"],
		category: "MARKETING",
		displayName: "General Announcement",
		footerText: "{{orgName}}",
		language: "en",
		name: "general_announcement",
		smsBody: "Hi {{name}}, from {{orgName}}: {{event}}. Reply STOP to opt out.",
	},

	request: {
		bodyText:
			"Hi {{name}}, 🙏 the team at {{orgName}} is reaching out to check in on you.\n\nWe hope you're doing well. Is there anything we can help you with?\n\nReply STOP to unsubscribe.",
		bodyVars: ["name", "orgName"],
		category: "MARKETING",
		displayName: "Care & Support Outreach",
		footerText: "{{orgName}}",
		language: "en",
		name: "general_care_outreach",
		smsBody:
			"Hi {{name}}, care check from {{orgName}}. We hope you're well. Reply if you need anything. Reply STOP to opt out.",
	},
};

// ─── Utility consent template (shared across all org types) ───────────────────
//
// Pre-screen message sent before the real marketing body.
//
// UTILITY category requires: direct opt-in confirmation, no promotional/
// engagement language, no check-ins, no curiosity-drivers.
// Meta approved use-case: "Confirm opt-ins or opt-outs for WhatsApp messages."
// Bold (*YES*) is allowed in BODY text but keep it plain for max compatibility.

export const UTILITY_CONSENT_TEMPLATE: MetaTemplateDefinition = {
	bodyText:
		"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a WhatsApp message. Reply YES to receive it or STOP to opt out.",
	bodyVars: ["name", "orgName"],
	category: "UTILITY",
	displayName: "Message Consent Request",
	footerText: undefined,
	language: "en",
	name: "Velocast_consent_v1",
	smsBody: "",
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const META_TEMPLATE_LIBRARY: TemplateLibrary = {
	business,
	church,
	community,
	ngo,
	other,
	school,
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
// These are sent as the UTILITY pre-screen / consent message before the real
// marketing body. Meta UTILITY rules (confirmed from Meta docs + July 2025 update):
//
//   ✅ Must be a direct opt-in/opt-out confirmation
//   ✅ Must name what the user is opting into
//   ✅ Must give clear YES / STOP instruction
//   ❌ No check-ins ("how are you?")
//   ❌ No curiosity-drivers ("something exciting is coming up")
//   ❌ No re-engagement prompts ("we've been thinking of you")
//   ❌ No mixed content (no promotional language whatsoever)
//
// Approved Meta use-case: "Confirm opt-ins or opt-outs for WhatsApp messages."
// Every template below is strictly an opt-in confirmation — nothing more.

export const UTILITY_TEMPLATES: Record<
	OrgType,
	Record<ScenarioId, MetaTemplateDefinition>
> = {
	business: {
		event_invite: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you details about an upcoming event. Reply YES to receive them or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Event — Consent",
			language: "en",
			name: "business_consent_event",
			smsBody: "",
		},
		first_timer: {
			bodyText:
				"Hi {{name}}, following your recent visit to {{orgName}}, we would like to send you a welcome message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "New Customer — Consent",
			language: "en",
			name: "business_consent_first_timer",
			smsBody: "",
		},
		follow_up: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Customer Follow-Up — Consent",
			language: "en",
			name: "business_consent_follow_up",
			smsBody: "",
		},
		general: {
			bodyText:
				"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a business update. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Business Update — Consent",
			language: "en",
			name: "business_consent_general",
			smsBody: "",
		},
		request: {
			bodyText:
				"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a message from the team. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Customer Care — Consent",
			language: "en",
			name: "business_consent_request",
			smsBody: "",
		},
	},
	church: {
		event_invite: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you details about an upcoming event. Reply YES to receive them or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Event — Consent",
			language: "en",
			name: "church_consent_event",
			smsBody: "",
		},
		first_timer: {
			bodyText:
				"Hi {{name}}, following your recent visit to {{orgName}}, we would like to send you a welcome message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "First Timer — Consent",
			language: "en",
			name: "church_consent_first_timer",
			smsBody: "",
		},
		follow_up: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Follow-Up — Consent",
			language: "en",
			name: "church_consent_follow_up",
			smsBody: "",
		},
		general: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you an announcement. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "General — Consent",
			language: "en",
			name: "church_consent_general",
			smsBody: "",
		},
		request: {
			bodyText:
				"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a message from the team. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Prayer & Support — Consent",
			language: "en",
			name: "church_consent_request",
			smsBody: "",
		},
	},

	community: {
		event_invite: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you details about an upcoming community event. Reply YES to receive them or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Community Event — Consent",
			language: "en",
			name: "community_consent_event",
			smsBody: "",
		},
		first_timer: {
			bodyText:
				"Hi {{name}}, following your recent visit to {{orgName}}, we would like to send you a welcome message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "New Member — Consent",
			language: "en",
			name: "community_consent_first_timer",
			smsBody: "",
		},
		follow_up: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Member Follow-Up — Consent",
			language: "en",
			name: "community_consent_follow_up",
			smsBody: "",
		},
		general: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a community update. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Community Update — Consent",
			language: "en",
			name: "community_consent_general",
			smsBody: "",
		},
		request: {
			bodyText:
				"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a message from the team. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Member Support — Consent",
			language: "en",
			name: "community_consent_request",
			smsBody: "",
		},
	},

	ngo: {
		event_invite: {
			bodyText:
				"Hi {{name}}, following your enrolment with {{orgName}}, we would like to send you details about an upcoming programme. Reply YES to receive them or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Programme — Consent",
			language: "en",
			name: "ngo_consent_event",
			smsBody: "",
		},
		first_timer: {
			bodyText:
				"Hi {{name}}, following your recent visit to {{orgName}}, we would like to send you a welcome message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "New Beneficiary — Consent",
			language: "en",
			name: "ngo_consent_first_timer",
			smsBody: "",
		},
		follow_up: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Follow-Up — Consent",
			language: "en",
			name: "ngo_consent_follow_up",
			smsBody: "",
		},
		general: {
			bodyText:
				"Hi {{name}}, following your registration with {{orgName}}, we would like to send you an update. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "General — Consent",
			language: "en",
			name: "ngo_consent_general",
			smsBody: "",
		},
		request: {
			bodyText:
				"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a message from the team. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Welfare Check — Consent",
			language: "en",
			name: "ngo_consent_request",
			smsBody: "",
		},
	},

	other: {
		event_invite: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you details about an upcoming event. Reply YES to receive them or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Event — Consent",
			language: "en",
			name: "general_consent_event",
			smsBody: "",
		},
		first_timer: {
			bodyText:
				"Hi {{name}}, following your recent visit to {{orgName}}, we would like to send you a welcome message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "First-Time — Consent",
			language: "en",
			name: "general_consent_first_timer",
			smsBody: "",
		},
		follow_up: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Follow-Up — Consent",
			language: "en",
			name: "general_consent_follow_up",
			smsBody: "",
		},
		general: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you an announcement. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "General — Consent",
			language: "en",
			name: "general_consent_general",
			smsBody: "",
		},
		request: {
			bodyText:
				"Hi {{name}}, following your recent interaction with {{orgName}}, we would like to send you a message from the team. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Care Outreach — Consent",
			language: "en",
			name: "general_consent_request",
			smsBody: "",
		},
	},

	school: {
		event_invite: {
			bodyText:
				"Hi {{name}}, as a member of the {{orgName}} community, we would like to send you details about an upcoming school event. Reply YES to receive them or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "School Event — Consent",
			language: "en",
			name: "school_consent_event",
			smsBody: "",
		},
		first_timer: {
			bodyText:
				"Hi {{name}}, following your recent visit to {{orgName}}, we would like to send you a welcome message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "New Student — Consent",
			language: "en",
			name: "school_consent_first_timer",
			smsBody: "",
		},
		follow_up: {
			bodyText:
				"Hi {{name}}, as a member of {{orgName}}, we would like to send you a message. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Student Follow-Up — Consent",
			language: "en",
			name: "school_consent_follow_up",
			smsBody: "",
		},
		general: {
			bodyText:
				"Hi {{name}}, as a member of the {{orgName}} community, we would like to send you a school notice. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "School Notice — Consent",
			language: "en",
			name: "school_consent_general",
			smsBody: "",
		},
		request: {
			bodyText:
				"Hi {{name}}, as a member of the {{orgName}} community, we would like to send you a message from the pastoral team. Reply YES to receive it or STOP to opt out.",
			bodyVars: ["name", "orgName"],
			category: "UTILITY",
			displayName: "Pastoral — Consent",
			language: "en",
			name: "school_consent_request",
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
