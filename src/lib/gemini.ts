import {
	GoogleGenerativeAI,
	HarmBlockThreshold,
	HarmCategory,
} from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import { env } from "#/env";
import { normalizePhoneNumber } from "#/features/contacts/utils/phone";
import { downloadFromR2 } from "#/features/upload/lib/s3";

export interface GeminiContact {
	channel: "whatsapp" | "sms";
	confidence?: number;
	name: string;
	notes?: string;
	phone: string;
	type: "new_contact" | "returning" | "contact" | "prospect";
}

export interface CandidateContact {
	channel: "whatsapp" | "sms";
	confidence: number;
	hasWarning: boolean;
	id: string;
	included: boolean;
	name: string;
	notes?: string;
	phone: string;
	rawRow?: string;
	type: "new_contact" | "returning" | "contact" | "prospect";
	warnings: string[];
}

export interface GeminiParseResult {
	confidence: number;
	contacts: CandidateContact[];
	rawText: string;
	warnings: string[];
}

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const PARSE_PROMPT = `You are an expert at extracting structured contact data from images.

Analyze this image carefully. It contains a list of people with their contact details.

Extract ALL contacts and return a JSON object with this exact structure:
{
  "contacts": [
    {
      "name": "Full Name",
      "phone": "+234XXXXXXXXXX",
      "channel": "whatsapp" | "sms",
      "type": "new_contact" | "returning" | "contact" | "prospect",
      "notes": "any additional notes visible"
    }
  ],
  "rawText": "all visible text from the image",
  "confidence": 0.0-1.0,
  "warnings": ["list of any ambiguities or issues found"]
}

Rules for extraction:
- "channel": Look for columns/labels like "WA", "WhatsApp", "WhatsApp Number", "SMS", "Text". If a number appears under a WhatsApp column → "whatsapp". If under SMS/Text column → "sms". If ambiguous, default to "whatsapp".
- "type": Map any label meaning "new" or "first contact" (e.g. "First Timer", "First Time", "FT", "New", "New Customer", "New Member", "New Student", "New Beneficiary", "New Contact") → "new_contact". Any label meaning "came back" or "repeated visit" (e.g. "Returning", "Return", "Repeat") → "returning". Any label meaning "regular", "established contact", or "ongoing relationship" (e.g. "Member", "Regular", "Client", "Student", "Partner", "Contact") → "contact". Default to "prospect" if the type is unclear or no type column exists.
- "phone": Normalize to international format with country code. If Nigerian numbers without +234, add it.
- "name": Use the full name as written.
- Return ONLY valid JSON with no markdown, no backticks, no explanation.`;

/**
 * Download the image from R2 (by key) then pass to Gemini Vision API.
 * This keeps the Inngest payload small — only the R2 key is stored, not the full image.
 */
export async function parseContactImageFromR2(
	r2Key: string,
	mimeType: string
): Promise<GeminiParseResult> {
	// 1. Fetch image bytes from R2
	const imageBuffer = await downloadFromR2(r2Key);
	const imageBase64 = imageBuffer.toString("base64");

	// 2. Call Gemini
	const model = genAI.getGenerativeModel({
		generationConfig: {
			responseMimeType: "application/json",
			temperature: 0.1,
		},
		model: "gemini-3.6-flash",
		safetySettings: [
			{
				category: HarmCategory.HARM_CATEGORY_HARASSMENT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
		],
	});

	const imagePart = {
		inlineData: { data: imageBase64, mimeType },
	};

	const result = await model.generateContent([PARSE_PROMPT, imagePart]);
	const responseText = result.response.text();

	// 3. Parse response
	let raw: {
		contacts: GeminiContact[];
		rawText: string;
		confidence: number;
		warnings: string[];
	};
	try {
		const cleaned = responseText
			.replace(/```json\n?/g, "")
			.replace(/```\n?/g, "")
			.trim();
		raw = JSON.parse(cleaned);
	} catch (error) {
		throw new Error(
			`Gemini returned invalid JSON: ${responseText.slice(0, 300)}`,
			{ cause: error }
		);
	}

	// 4. Enrich and validate contacts
	const contacts: CandidateContact[] = (raw.contacts ?? []).map((c) => {
		const warnings: string[] = [];
		const itemConfidence =
			typeof c.confidence === "number"
				? c.confidence
				: (raw.confidence ?? 0.85);

		// Validate phone number
		const normalized = normalizePhoneNumber(c.phone);
		let finalPhone = c.phone;

		if (normalized.success && normalized.phone) {
			finalPhone = normalized.phone;
		} else {
			warnings.push(normalized.error ?? `Invalid phone format: ${c.phone}`);
		}

		if (itemConfidence < 0.7) {
			warnings.push(
				`Low OCR confidence (${Math.round(itemConfidence * 100)}%)`
			);
		}

		return {
			channel: c.channel ?? "whatsapp",
			confidence: itemConfidence,
			hasWarning: warnings.length > 0,
			id: uuidv4(),
			included: true,
			name: c.name?.trim() || "Unknown",
			notes: c.notes,
			phone: finalPhone,
			rawRow: c.notes,
			type: c.type ?? "prospect",
			warnings,
		};
	});

	return {
		confidence: raw.confidence ?? 0.85,
		contacts,
		rawText: raw.rawText ?? "",
		warnings: raw.warnings ?? [],
	};
}
