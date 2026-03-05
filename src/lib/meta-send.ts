/**
 * src/lib/meta-send.ts
 *
 * Meta WhatsApp Cloud API — message sending.
 *
 * Sends text messages directly via the Cloud API, no Twilio involved.
 * For template messages (approved WA templates), use sendTemplateMessage.
 * For freeform text (within 24h session window), use sendTextMessage.
 *
 * Env vars required:
 *   META_PHONE_NUMBER_ID   — the registered phone number ID in Meta App Dashboard
 *   META_ACCESS_TOKEN      — system user permanent access token
 *   META_API_VERSION       — e.g. "v20.0" (defaults to v20.0)
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

export interface MetaSendResult {
	error?: string;
	messageId?: string; // Meta's wamid — used for delivery tracking
	success: boolean;
}

interface MetaMessageResponse {
	contacts: Array<{ input: string; wa_id: string }>;
	messages: Array<{ id: string }>;
}

interface MetaErrorResponse {
	error: {
		message: string;
		type: string;
		code: number;
		error_data?: { messaging_product: string; details: string };
		fbtrace_id: string;
	};
}

function phoneNumberId() {
	const id = process.env.META_PHONE_NUMBER_ID;
	if (!id) {
		throw new Error("META_PHONE_NUMBER_ID is not set");
	}
	return id;
}

function accessToken() {
	const t = process.env.META_ACCESS_TOKEN;
	if (!t) {
		throw new Error("META_ACCESS_TOKEN is not set");
	}
	return t;
}

function apiVersion() {
	return process.env.META_API_VERSION ?? "v20.0";
}

function baseUrl() {
	return `https://graph.facebook.com/${apiVersion()}/${phoneNumberId()}/messages`;
}

/**
 * Normalise a phone number to E.164 without the leading '+'.
 * Meta Cloud API expects numbers without '+'.
 * e.g. "+2348012345678" → "2348012345678"
 *      "08012345678"    → "2348012345678" (Nigerian local → E.164)
 */
function normalisePhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	// Nigerian local numbers starting with 0 — prefix with 234
	if (digits.startsWith("0") && digits.length === 11) {
		return `234${digits.slice(1)}`;
	}
	// Already has country code (no leading +)
	return digits;
}

/**
 * Send a freeform text message.
 * Only works within 24h of the contact messaging you first (session window).
 * For bulk campaigns, use sendTemplateMessage instead.
 */
export async function sendTextMessage(
	to: string,
	text: string
): Promise<MetaSendResult> {
	try {
		const res = await fetch(baseUrl(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken()}`,
			},
			body: JSON.stringify({
				messaging_product: "whatsapp",
				recipient_type: "individual",
				to: normalisePhone(to),
				type: "text",
				text: {
					preview_url: false,
					body: text,
				},
			}),
		});

		const data = (await res.json()) as MetaMessageResponse | MetaErrorResponse;

		if (!res.ok || "error" in data) {
			const msg = "error" in data ? data.error.message : `HTTP ${res.status}`;
			console.error("[Meta Send] Text failed:", msg);
			return { success: false, error: msg };
		}

		const messageId = (data as MetaMessageResponse).messages?.[0]?.id;
		return { success: true, messageId };
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error("[Meta Send] Text error:", error);
		return { success: false, error };
	}
}

/**
 * Send an approved WhatsApp template message.
 * This is the correct method for bulk campaigns — no 24h restriction.
 *
 * Variables in bodyText are positional: {{1}}, {{2}}, …
 * Pass them in order as the `variables` array.
 */
export async function sendTemplateMessage(
	to: string,
	templateName: string,
	language: string,
	variables: string[] = []
): Promise<MetaSendResult> {
	const components: object[] = [];

	if (variables.length > 0) {
		components.push({
			type: "body",
			parameters: variables.map((v) => ({ type: "text", text: v })),
		});
	}

	try {
		const res = await fetch(baseUrl(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken()}`,
			},
			body: JSON.stringify({
				messaging_product: "whatsapp",
				recipient_type: "individual",
				to: normalisePhone(to),
				type: "template",
				template: {
					name: templateName,
					language: { code: language },
					components: components.length ? components : undefined,
				},
			}),
		});

		const data = (await res.json()) as MetaMessageResponse | MetaErrorResponse;

		if (!res.ok || "error" in data) {
			const msg = "error" in data ? data.error.message : `HTTP ${res.status}`;
			console.error(
				"[Meta Send] Template failed:",
				msg,
				"template:",
				templateName
			);
			return { success: false, error: msg };
		}

		const messageId = (data as MetaMessageResponse).messages?.[0]?.id;
		return { success: true, messageId };
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error("[Meta Send] Template error:", error);
		return { success: false, error };
	}
}

/**
 * Unified dispatcher — chooses text vs template based on whether
 * a template name is provided. For campaigns, always pass templateName.
 */
export function sendWhatsAppMessage(
	to: string,
	body: string,
	templateName?: string,
	language?: string,
	variables?: string[]
): Promise<MetaSendResult> {
	if (templateName) {
		return sendTemplateMessage(to, templateName, language ?? "en", variables);
	}
	return sendTextMessage(to, body);
}
