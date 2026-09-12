import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "./phone";

describe("normalizePhoneNumber", () => {
	it("normalizes local Nigerian 11 digit numbers with leading 0 to E.164", () => {
		const result = normalizePhoneNumber("08031234567");
		expect(result.success).toBe(true);
		expect(result.phone).toBe("+2348031234567");
	});

	it("normalizes 234 prefix without plus sign", () => {
		const result = normalizePhoneNumber("2348031234567");
		expect(result.success).toBe(true);
		expect(result.phone).toBe("+2348031234567");
	});

	it("handles numbers already formatted with plus country code", () => {
		const result = normalizePhoneNumber("+2348031234567");
		expect(result.success).toBe(true);
		expect(result.phone).toBe("+2348031234567");
	});

	it("supports valid international numbers", () => {
		const result = normalizePhoneNumber("+14155552671");
		expect(result.success).toBe(true);
		expect(result.phone).toBe("+14155552671");
	});

	it("trims whitespace and ignores inner spaces", () => {
		const result = normalizePhoneNumber("  0803 123 4567  ");
		expect(result.success).toBe(true);
		expect(result.phone).toBe("+2348031234567");
	});

	it("rejects invalid or gibberish inputs", () => {
		const result = normalizePhoneNumber("not-a-number");
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects incomplete short numbers", () => {
		const result = normalizePhoneNumber("080312");
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects empty strings", () => {
		const result = normalizePhoneNumber("");
		expect(result.success).toBe(false);
	});
});
