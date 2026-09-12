import { PRICING } from "#/features/billing/utils/format";
import { personalizeMessage } from "#/features/miscellaneous/scenario";

/**
 * Standard GSM 03.38 7 bit basic character set.
 * Characters outside this set switch the SMS encoding to Unicode (UCS-2).
 */
const GSM7_BASIC_CHARS = new Set(
	"@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);

/**
 * GSM 03.38 7 bit extension characters.
 * Each character requires an escape code, counting as 2 characters in GSM 7 mode.
 */
const GSM7_EXTENSION_CHARS = new Set("^{}\\[~]|€");

/**
 * Regulatory opt out notice mandated for promotional SMS in Nigeria.
 * 24 characters long, entirely in basic GSM 7.
 */
export const OPT_OUT_NOTICE = "\n\nReply STOP to opt out";

export type SmsEncoding = "GSM_7" | "UNICODE";

export interface SmsCalculationResult {
	charsPerSegment: number;
	charsRemainingInSegment: number;
	costPerSegmentKobo: number;
	encoding: SmsEncoding;
	rawCharacterCount: number;
	segments: number;
	textWithOptOut: string;
	totalCharacterCount: number;
	totalCostKobo: number;
}

/**
 * Checks if a string contains only GSM 7 (basic + extension) characters.
 */
export function isGsm7String(text: string): boolean {
	for (const char of text) {
		if (!(GSM7_BASIC_CHARS.has(char) || GSM7_EXTENSION_CHARS.has(char))) {
			return false;
		}
	}
	return true;
}

/**
 * Calculates the character count in GSM 7 units.
 * Extension characters count as 2 septets.
 */
export function getGsm7Length(text: string): number {
	let length = 0;
	for (const char of text) {
		if (GSM7_EXTENSION_CHARS.has(char)) {
			length += 2;
		} else {
			length += 1;
		}
	}
	return length;
}

/**
 * Appends the regulatory opt out notice if not already present.
 */
export function appendOptOutNotice(text: string): string {
	if (text.includes("Reply STOP") || text.includes("reply STOP")) {
		return text;
	}
	return `${text}${OPT_OUT_NOTICE}`;
}

/**
 * Analyzes character count, encoding, and segments for a message text.
 * By default appends the regulatory opt out notice to calculate true delivery cost.
 */
export function calculateSmsSegments(
	text: string,
	includeOptOut = true
): SmsCalculationResult {
	const finalBody = includeOptOut ? appendOptOutNotice(text) : text;
	const isGsm = isGsm7String(finalBody);
	const encoding: SmsEncoding = isGsm ? "GSM_7" : "UNICODE";

	const costPerSegmentKobo = PRICING.PER_MESSAGE.sms;

	if (encoding === "GSM_7") {
		const totalCharacterCount = getGsm7Length(finalBody);
		const rawCharacterCount = getGsm7Length(text);

		let segments = 1;
		let charsPerSegment = 160;
		let charsRemainingInSegment = 160 - totalCharacterCount;

		if (totalCharacterCount === 0) {
			segments = 0;
			charsRemainingInSegment = 160;
		} else if (totalCharacterCount > 160) {
			charsPerSegment = 153;
			segments = Math.ceil(totalCharacterCount / 153);
			charsRemainingInSegment = segments * 153 - totalCharacterCount;
		}

		return {
			charsPerSegment,
			charsRemainingInSegment,
			costPerSegmentKobo,
			encoding,
			rawCharacterCount,
			segments,
			textWithOptOut: finalBody,
			totalCharacterCount,
			totalCostKobo: segments * costPerSegmentKobo,
		};
	}

	// Unicode mode (UCS-2)
	// JavaScript string length counts UTF-16 code units
	const totalCharacterCount = finalBody.length;
	const rawCharacterCount = text.length;

	let segments = 1;
	let charsPerSegment = 70;
	let charsRemainingInSegment = 70 - totalCharacterCount;

	if (totalCharacterCount === 0) {
		segments = 0;
		charsRemainingInSegment = 70;
	} else if (totalCharacterCount > 70) {
		charsPerSegment = 67;
		segments = Math.ceil(totalCharacterCount / 67);
		charsRemainingInSegment = segments * 67 - totalCharacterCount;
	}

	return {
		charsPerSegment,
		charsRemainingInSegment,
		costPerSegmentKobo,
		encoding,
		rawCharacterCount,
		segments,
		textWithOptOut: finalBody,
		totalCharacterCount,
		totalCostKobo: segments * costPerSegmentKobo,
	};
}

/**
 * Calculates the maximum segments across an audience when variable placeholders expand.
 * Protects against wallet under-holding if recipient names are long.
 */
export function calculateMaxSegmentsForAudience({
	template,
	contacts,
	templateVars = {},
}: {
	template: string;
	contacts: Array<{ name?: string | null; phone?: string }>;
	templateVars?: Record<string, string>;
}): {
	baseCalculation: SmsCalculationResult;
	maxSegments: number;
	totalContacts: number;
	totalEstimatedCostKobo: number;
} {
	const baseCalculation = calculateSmsSegments(template, true);

	if (contacts.length === 0) {
		return {
			baseCalculation,
			maxSegments: baseCalculation.segments,
			totalContacts: 0,
			totalEstimatedCostKobo: 0,
		};
	}

	let maxSegments = baseCalculation.segments;

	for (const contact of contacts) {
		const personalized = personalizeMessage(
			template,
			contact.name ?? "Friend",
			templateVars
		);
		const calc = calculateSmsSegments(personalized, true);
		if (calc.segments > maxSegments) {
			maxSegments = calc.segments;
		}
	}

	const totalContacts = contacts.length;
	const totalEstimatedCostKobo =
		totalContacts * maxSegments * PRICING.PER_MESSAGE.sms;

	return {
		baseCalculation,
		maxSegments,
		totalContacts,
		totalEstimatedCostKobo,
	};
}
