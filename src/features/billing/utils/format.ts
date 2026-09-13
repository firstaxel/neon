/**
 * src/features/billing/utils/format.ts
 *
 * Client safe formatting helpers and pricing definitions.
 * Safe to import in browser components without server environment dependencies.
 */

export type MessageType =
	| "whatsapp_marketing"
	| "whatsapp_utility"
	| "whatsapp_service"
	| "sms";

export const PRICING = {
	/**
	 * Per message costs in kobo (1 Naira = 100 kobo).
	 * Source: Meta Nigeria conversation pricing and Termii SMS rate.
	 */
	PER_MESSAGE: {
		sms: 600, // 6.00 Naira Termii SMS
		whatsapp_marketing: 9000, // 90.00 Naira Meta marketing conversation
		whatsapp_service: 0, // 0.00 Naira Meta service conversation within 24h
		whatsapp_utility: 800, // 8.00 Naira Meta utility conversation
	} as const satisfies Record<MessageType, number>,
} as const;

/**
 * Resolve the MessageType for a contact based on channel and delivery mode.
 */
export function resolveMessageType(
	channel: "whatsapp" | "sms",
	deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback"
): MessageType {
	if (channel === "sms" || deliveryMode === "sms_fallback") {
		return "sms";
	}
	if (deliveryMode === "utility_prescreen") {
		return "whatsapp_utility";
	}
	return "whatsapp_marketing";
}

/** Convert kobo integer to a formatted Naira string. e.g. 50000 produces "₦500.00" */
export function formatNaira(kobo: number): string {
	return new Intl.NumberFormat("en-NG", {
		currency: "NGN",
		minimumFractionDigits: 2,
		style: "currency",
	}).format(kobo / 100);
}

/** Convert a Naira integer or number to kobo. e.g. 500 produces 50000 */
export function nairaToKobo(naira: number): number {
	return Math.round(naira * 100);
}
