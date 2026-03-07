/**
 * src/lib/termii.ts
 *
 * Termii SMS API — outbound SMS for Nigerian numbers.
 *
 * Termii is a Nigerian-first messaging provider with better delivery rates
 * on local numbers than Twilio. No Twilio dependency for SMS.
 *
 * Env vars required:
 *   TERMII_API_KEY    — your Termii API key
 *   TERMII_SENDER_ID  — your registered Termii sender ID (e.g. "MsgDesk")
 *
 * Docs: https://developers.termii.com/messaging
 */

export interface SmsSendResult {
	error?: string;
	messageId?: string;
	success: boolean;
}

interface TermiiResponse {
	balance: number;
	message: string;
	message_id: string;
	user: string;
}

interface TermiiErrorResponse {
	code?: string;
	message: string;
}

const BASE_URL = "https://v3.api.termii.com/api/sms/send";

function apiKey(): string {
	const key = process.env.TERMII_API_KEY;
	if (!key) {
		throw new Error("TERMII_API_KEY is not set");
	}
	return key;
}

function senderId(): string {
	return process.env.TERMII_SENDER_ID ?? "MessageDsk";
}

/**
 * Normalise a phone number for Termii.
 * Termii expects E.164 without '+': e.g. "2348012345678"
 */
function normalisePhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	// Nigerian local 08xxx → 2348xxx
	if (digits.startsWith("0") && digits.length === 11) {
		return `234${digits.slice(1)}`;
	}
	// Strip leading + if present (already E.164)
	return digits;
}

/**
 * Send a single SMS via Termii.
 * Appends opt-out instructions as required by Nigerian regulations.
 */
export async function sendSmsMessage(
	to: string,
	body: string
): Promise<SmsSendResult> {
	// Append STOP instruction if not already present
	const fullBody = body.includes("Reply STOP")
		? body
		: `${body}\n\nReply STOP to opt out`;

	try {
		const res = await fetch(BASE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: apiKey(),
				to: normalisePhone(to),
				from: senderId(),
				sms: fullBody,
				type: "plain",
				channel: "generic", // DND channel bypasses Nigerian DND registry
				media: { url: null, caption: null },
			}),
		});

		const data = (await res.json()) as TermiiResponse | TermiiErrorResponse;

		if (!res.ok || "code" in data) {
			const msg =
				"message" in data ? String(data.message) : `HTTP ${res.status}`;
			console.error("[Termii] Send failed:", msg);
			return { success: false, error: msg };
		}

		const ok = data as TermiiResponse;
		return { success: true, messageId: ok.message_id };
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error("[Termii] Send error:", error);
		return { success: false, error };
	}
}

/**
 * Mark a contact as opted out when we receive a STOP reply from Termii webhook.
 * Call this from /api/termii/inbound.
 */

const isStopRegex = /^\s*(stop|unsubscribe|quit|cancel|end|opt.?out)\s*$/i;
export function isStopKeyword(text: string): boolean {
	return isStopRegex.test(text.trim());
}

const isStartRegex = /^\s*(start|subscribe|unstop|yes)\s*$/i;
export function isStartKeyword(text: string): boolean {
	return isStartRegex.test(text.trim());
}
