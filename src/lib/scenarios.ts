import type { MessageTemplate, Scenario, ScenarioId } from "./types";

export const SCENARIOS: Scenario[] = [
	{
		id: "first_timer",
		label: "First Timer Welcome",
		icon: "✨",
		description: "Warm welcome for first-time visitors",
		template: {
			whatsapp: `Hi {name}! 👋 It was so wonderful having you with us for the first time! We'd love to get to know you better. Is there anything we can help you with, or would you like to connect with one of our team members? Feel free to reply anytime — we're here for you! 😊`,
			sms: `Hi {name}! Great having you with us for the first time! We'd love to connect. Reply anytime or call us at our office. God bless! - The Team`,
		},
	},
	{
		id: "follow_up",
		label: "Follow-Up",
		icon: "🔄",
		description: "Check in with previous contacts",
		template: {
			whatsapp: `Hi {name}! 😊 Just wanted to check in and let you know you've been on our minds. How are you doing? We'd love to hear from you. Please don't hesitate to reach out if there's anything at all we can do for you!`,
			sms: `Hi {name}, we've been thinking about you and hope you're doing well! We'd love to hear from you. - The Team`,
		},
	},
	{
		id: "event_invite",
		label: "Event Invitation",
		icon: "🎉",
		description: "Invite people to an upcoming event",
		template: {
			whatsapp: `Hi {name}! 🎉 We have something special coming up and we'd *love* to have you join us! Our upcoming event is going to be amazing and we truly believe it will be a blessing. Reply *YES* to confirm your attendance or let us know if you need more details. Can't wait to see you there!`,
			sms: `Hi {name}! You're invited to our special upcoming event! Reply YES to confirm attendance. Details coming soon. - The Team`,
		},
	},
	{
		id: "request",
		label: "Prayer & Support",
		icon: "🙏",
		description: "Offer prayer and spiritual support",
		template: {
			whatsapp: `Hi {name}! 🙏 You've been on our hearts and we've been praying for you and your family. We just wanted you to know that you're not alone — we're here for you always. Is there anything specific we can be praying about or any way we can support you right now?`,
			sms: `Hi {name}, you're in our thoughts and prayers! We're here for you. Please reach out if you need anything. - The Team`,
		},
	},
	{
		id: "general",
		label: "General Announcement",
		icon: "📢",
		description: "Broadcast a general announcement",
		template: {
			whatsapp: `Hi {name}! 📢 We have an important update we'd love to share with you. Stay tuned — more details coming very soon. Thank you for being such a valued part of our community! 🙏`,
			sms: "Hi {name}! Important update coming your way soon. Stay tuned for more details. - The Team",
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
