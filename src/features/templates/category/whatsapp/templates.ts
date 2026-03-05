/**
 * src/lib/whatsapp-templates.ts
 *
 * Meta WhatsApp Business Cloud API — template management.
 *
 * Environment variables required:
 *   META_WABA_ID          — WhatsApp Business Account ID
 *   META_ACCESS_TOKEN     — System user permanent access token
 *   META_API_VERSION      — e.g. "v20.0"  (defaults to v20.0)
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type WaHeaderFmt = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
export type WaButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
export type WaStatus =
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "PAUSED"
	| "DISABLED";
export type WaLang = string; // BCP-47

// Button definitions (stored in DB as JSON)
export interface WaButton {
	example?: string[]; // example values for URL vars
	phoneNumber?: string; // PHONE_NUMBER button only
	text: string;
	type: WaButtonType;
	url?: string; // URL button only — supports {{1}} for dynamic suffix
}

// Internal representation of a full template (used in form + router)
export interface WaTemplatePayload {
	// Body (required)
	bodyText: string;
	bodyVars: string[]; // ordered named vars: ["name","date","amount"]

	// Buttons (optional)
	buttons: WaButton[];
	category: WaCategory;
	displayName: string;

	// Footer (optional)
	footerText?: string;

	// Header (optional)
	headerFormat?: WaHeaderFmt;
	headerText?: string; // only for TEXT format
	headerVars?: string[]; // named vars used in header text
	language: WaLang;
	name: string; // snake_case, globally unique per WABA

	// SMS fallback
	smsBody: string;
	smsVars: string[];
}

// Meta API response shape
interface MetaTemplateResponse {
	id: string;
	status: WaStatus;
}

interface MetaErrorResponse {
	error: {
		message: string;
		type: string;
		code: number;
		fbtrace_id: string;
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = "https://graph.facebook.com";

function apiVersion() {
	return process.env.META_API_VERSION ?? "v20.0";
}

function wabaId() {
	const id = process.env.META_WABA_ID;
	if (!id) {
		throw new Error("META_WABA_ID is not set");
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

/**
 * Convert named variables like {{name}}, {{date}} into numbered Meta-style
 * placeholders {{1}}, {{2}}, … and return the mapped variable list.
 *
 * e.g.  "Hi {{name}}, your order {{orderId}} is ready"
 *   →   { text: "Hi {{1}}, your order {{2}} is ready", vars: ["name","orderId"] }
 */
export function toNumberedVars(
	text: string,
	vars: string[]
): { text: string; exampleValues: string[] } {
	let result = text;
	const exampleValues: string[] = [];

	vars.forEach((varName, i) => {
		const placeholder = `{{${varName}}}`;
		result = result.replace(
			new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
			`{{${i + 1}}}`
		);
		exampleValues.push(exampleValueFor(varName));
	});

	return { text: result, exampleValues };
}

/** Sensible example values for common variable names */
function exampleValueFor(varName: string): string {
	const lower = varName.toLowerCase();
	if (lower.includes("name")) {
		return "Sarah";
	}
	if (lower.includes("date")) {
		return "Sunday, 15 Dec";
	}
	if (lower.includes("time")) {
		return "10:00 AM";
	}
	if (
		lower.includes("amount") ||
		lower.includes("price") ||
		lower.includes("cost")
	) {
		return "₦5,000";
	}
	if (
		lower.includes("order") ||
		lower.includes("id") ||
		lower.includes("ref")
	) {
		return "ORD-12345";
	}
	if (lower.includes("link") || lower.includes("url")) {
		return "https://example.com/link";
	}
	if (lower.includes("code")) {
		return "ABC123";
	}
	if (lower.includes("phone") || lower.includes("number")) {
		return "+2348000000000";
	}
	if (
		lower.includes("org") ||
		lower.includes("church") ||
		lower.includes("school")
	) {
		return "Grace Assembly";
	}
	if (lower.includes("event")) {
		return "Easter Sunday Service";
	}
	if (lower.includes("location") || lower.includes("venue")) {
		return "Lagos, Nigeria";
	}
	return `[${varName}]`;
}

// ─── Build Meta API payload ───────────────────────────────────────────────────

export function buildMetaPayload(tpl: WaTemplatePayload) {
	const components: object[] = [];

	// ── Header ──
	if (tpl.headerFormat) {
		if (tpl.headerFormat === "TEXT" && tpl.headerText) {
			const vars = tpl.headerVars ?? [];
			const { text, exampleValues } = toNumberedVars(tpl.headerText, vars);
			components.push({
				type: "HEADER",
				format: "TEXT",
				text,
				...(vars.length > 0 && {
					example: { header_text: exampleValues },
				}),
			});
		} else {
			// IMAGE / VIDEO / DOCUMENT / LOCATION — example handle required
			components.push({
				type: "HEADER",
				format: tpl.headerFormat,
				...(tpl.headerFormat !== "LOCATION" && {
					example: {
						header_handle: ["https://example.com/placeholder.jpg"],
					},
				}),
			});
		}
	}

	// ── Body ──
	const { text: bodyText, exampleValues: bodyExamples } = toNumberedVars(
		tpl.bodyText,
		tpl.bodyVars
	);
	components.push({
		type: "BODY",
		text: bodyText,
		...(tpl.bodyVars.length > 0 && {
			example: { body_text: [bodyExamples] },
		}),
	});

	// ── Footer ──
	if (tpl.footerText) {
		components.push({ type: "FOOTER", text: tpl.footerText });
	}

	// ── Buttons ──
	if (tpl.buttons.length > 0) {
		components.push({
			type: "BUTTONS",
			buttons: tpl.buttons.map((btn) => {
				const base = { type: btn.type, text: btn.text };
				if (btn.type === "URL" && btn.url) {
					// URL may have a dynamic {{1}} suffix
					const hasDynamic = btn.url.includes("{{");
					return {
						...base,
						url: btn.url,
						...(hasDynamic && { example: btn.example ?? ["example"] }),
					};
				}
				if (btn.type === "PHONE_NUMBER" && btn.phoneNumber) {
					return { ...base, phone_number: btn.phoneNumber };
				}
				return base;
			}),
		});
	}

	return {
		name: tpl.name,
		language: tpl.language,
		category: tpl.category,
		components,
	};
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Submit a new template to Meta for approval */
export async function submitTemplate(
	tpl: WaTemplatePayload
): Promise<{ id: string; status: WaStatus }> {
	const payload = buildMetaPayload(tpl);
	const url = `${BASE}/${apiVersion()}/${wabaId()}/message_templates`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken()}`,
		},
		body: JSON.stringify(payload),
	});

	const data = (await res.json()) as MetaTemplateResponse | MetaErrorResponse;

	if (!res.ok || "error" in data) {
		const msg = "error" in data ? data.error.message : `HTTP ${res.status}`;
		throw new Error(`Meta API error: ${msg}`);
	}

	return { id: data.id, status: data.status };
}

/** Fetch current approval status for a template by its Meta ID */
export async function fetchTemplateStatus(
	waTemplateId: string
): Promise<{ status: WaStatus; rejectionReason?: string }> {
	const url = `${BASE}/${apiVersion()}/${waTemplateId}?fields=status,rejected_reason`;

	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken()}` },
	});

	const data = (await res.json()) as
		| {
				status: WaStatus;
				rejected_reason?: string;
		  }
		| MetaErrorResponse;

	if (!res.ok || "error" in data) {
		const msg = "error" in data ? data.error.message : `HTTP ${res.status}`;
		throw new Error(`Meta API error: ${msg}`);
	}

	return {
		status: data.status,
		rejectionReason:
			"rejected_reason" in data ? data.rejected_reason : undefined,
	};
}

/** Delete a template from Meta (also needed to re-submit with fixes) */
export async function deleteMetaTemplate(templateName: string): Promise<void> {
	const url = `${BASE}/${apiVersion()}/${wabaId()}/message_templates?name=${encodeURIComponent(templateName)}`;

	const res = await fetch(url, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${accessToken()}` },
	});

	if (!res.ok) {
		const data = (await res.json()) as MetaErrorResponse;
		throw new Error(
			`Meta API error: ${"error" in data ? data.error.message : res.status}`
		);
	}
}

// ─── Variable utilities (used in frontend too) ────────────────────────────────

/** Extract all {{varName}} placeholders from a text string */
export function extractVars(text: string): string[] {
	const matches = text.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
	const seen = new Set<string>();
	const result: string[] = [];
	for (const m of matches) {
		if (!seen.has(m[1])) {
			seen.add(m[1]);
			result.push(m[1]);
		}
	}
	return result;
}

/** Replace named vars with example values for preview */
export function previewText(
	text: string,
	vars: string[],
	values: Record<string, string>
): string {
	let result = text;
	for (const v of vars) {
		const val = values[v] ?? exampleValueFor(v);
		result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), val);
	}
	return result;
}

// ─── Supported languages ──────────────────────────────────────────────────────

export const WA_LANGUAGES: { code: string; label: string }[] = [
	{ code: "en", label: "English" },
	{ code: "en_US", label: "English (US)" },
	{ code: "en_GB", label: "English (UK)" },
	{ code: "pt_BR", label: "Portuguese (Brazil)" },
	{ code: "pt_PT", label: "Portuguese (Portugal)" },
	{ code: "es", label: "Spanish" },
	{ code: "es_AR", label: "Spanish (Argentina)" },
	{ code: "es_MX", label: "Spanish (Mexico)" },
	{ code: "fr", label: "French" },
	{ code: "de", label: "German" },
	{ code: "it", label: "Italian" },
	{ code: "nl", label: "Dutch" },
	{ code: "ru", label: "Russian" },
	{ code: "ar", label: "Arabic" },
	{ code: "hi", label: "Hindi" },
	{ code: "yo", label: "Yoruba" },
	{ code: "ig", label: "Igbo" },
	{ code: "ha", label: "Hausa" },
	{ code: "sw", label: "Swahili" },
	{ code: "zu", label: "Zulu" },
	{ code: "af", label: "Afrikaans" },
	{ code: "id", label: "Indonesian" },
	{ code: "ms", label: "Malay" },
	{ code: "zh_CN", label: "Chinese (Simplified)" },
	{ code: "zh_TW", label: "Chinese (Traditional)" },
	{ code: "ja", label: "Japanese" },
	{ code: "ko", label: "Korean" },
	{ code: "tr", label: "Turkish" },
	{ code: "pl", label: "Polish" },
	{ code: "uk", label: "Ukrainian" },
];
