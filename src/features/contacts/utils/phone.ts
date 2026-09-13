import { type CountryCode, parsePhoneNumber } from "libphonenumber-js";

export interface PhoneNormalizationResult {
	error?: string;
	phone?: string;
	success: boolean;
}

/**
 * Normalizes a raw phone number input to strict E.164 format.
 * Defaults to Nigeria ("NG") country prefix if no international code is present.
 */
export function normalizePhoneNumber(
	raw: string,
	defaultCountry: CountryCode = "NG"
): PhoneNormalizationResult {
	if (!raw || typeof raw !== "string") {
		return {
			error: "Phone number is empty or missing",
			success: false,
		};
	}

	const cleaned = raw.trim();
	if (cleaned.length === 0) {
		return {
			error: "Phone number is empty",
			success: false,
		};
	}

	// If the user entered digits starting with 234 without a plus sign, prepend plus
	const candidate =
		cleaned.startsWith("234") && !cleaned.startsWith("+")
			? `+${cleaned}`
			: cleaned;

	try {
		const parsed = parsePhoneNumber(candidate, defaultCountry);

		if (!parsed?.isValid()) {
			return {
				error: `Invalid phone number: "${raw}"`,
				success: false,
			};
		}

		return {
			phone: parsed.format("E.164"),
			success: true,
		};
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Failed to parse phone number";
		return {
			error: `Invalid phone number: ${message}`,
			success: false,
		};
	}
}
