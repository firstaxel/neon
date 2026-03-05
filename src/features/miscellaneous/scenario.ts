import type { MessageTemplate, Scenario, ScenarioId } from "#/lib/types";

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
			whatsapp: `Hi {name}! 👋 It was so wonderful connecting with you for the first time! We'd love to get to know you better — feel free to reply anytime. Is there anything we can help you with? We're here for you! 😊`,
			sms: `Hi {name}! Great connecting with you for the first time. We'd love to stay in touch — reply anytime. — The Team`,
		},
	},
	{
		id: "follow_up",
		label: "Follow-Up",
		icon: "🔄",
		description: "Check in with an existing contact or member",
		template: {
			whatsapp: `Hi {name}! 😊 Just checking in — you've been on our minds. How are you doing? We'd love to hear from you and are here if there's anything we can do for you!`,
			sms: `Hi {name}, hope you're well! We've been thinking of you. Feel free to reach out anytime. — The Team`,
		},
	},
	{
		id: "event_invite",
		label: "Event Invitation",
		icon: "🎉",
		description: "Invite contacts to an upcoming event or gathering",
		template: {
			whatsapp: `Hi {name}! 🎉 We have something exciting coming up and would *love* to have you join us! Reply *YES* to confirm your spot or ask us for more details. Can't wait to see you there!`,
			sms: `Hi {name}! You're invited to our upcoming event! Reply YES to confirm. More details coming soon. — The Team`,
		},
	},
	{
		id: "request",
		label: "Care & Support",
		icon: "🙏",
		description: "Reach out to offer support or check on someone's wellbeing",
		template: {
			whatsapp: `Hi {name}! 🙏 You've been on our hearts and we just wanted to reach out. We hope you're doing well — please know we're here for you. Is there anything we can do to support you right now?`,
			sms: `Hi {name}, you're in our thoughts! We're here for you — please reach out if you need anything. — The Team`,
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
			sms: "Hi {name}! Important update coming soon — stay tuned. Thank you! — The Team",
		},
	},
];

export const SCENARIO_MAP = new Map<ScenarioId, Scenario>(
	SCENARIOS.map((s) => [s.id, s])
);

export function getTemplate(
	scenarioId: ScenarioId
): MessageTemplate | undefined {
	return SCENARIO_MAP.get(scenarioId)?.template;
}

export function personalizeMessage(template: string, name: string): string {
	return template.replace(/\{name\}/g, name.split(" ")[0]);
}
