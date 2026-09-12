import { describe, expect, it } from "vitest";
import {
	appendOptOutNotice,
	calculateMaxSegmentsForAudience,
	calculateSmsSegments,
	getGsm7Length,
	isGsm7String,
	OPT_OUT_NOTICE,
} from "./sms";

describe("GSM character set analysis and segment calculator", () => {
	it("identifies basic GSM 7 characters correctly", () => {
		expect(isGsm7String("Hello World 123! @£$¥")).toBe(true);
		expect(isGsm7String("Nigerian mobile broadcast test")).toBe(true);
	});

	it("identifies GSM 7 extension characters and counts them as 2 septets", () => {
		expect(isGsm7String("Special: [bracket] {brace} | €")).toBe(true);
		// '[' and ']' are extension characters, so 'a[b' is 1 + 2 + 1 = 4
		expect(getGsm7Length("a[b")).toBe(4);
		expect(getGsm7Length("€")).toBe(2);
	});

	it("detects Unicode characters such as emojis and smart quotes", () => {
		expect(isGsm7String("Hello 🎉")).toBe(false);
		expect(isGsm7String("It’s a smart quote")).toBe(false); // right single quotation mark
		expect(isGsm7String("“quoted”")).toBe(false);
	});

	it("appends opt out notice when missing and avoids duplicate notice when present", () => {
		const raw = "Hello from Church";
		const withOptOut = appendOptOutNotice(raw);
		expect(withOptOut).toBe(`${raw}${OPT_OUT_NOTICE}`);

		// Already contains Reply STOP
		const alreadyHas = "Hello from Church\n\nReply STOP to opt out";
		expect(appendOptOutNotice(alreadyHas)).toBe(alreadyHas);
	});

	it("calculates single and multi part segments for GSM 7", () => {
		// Opt out notice is 23 chars. A 100 char message + 23 = 123 chars -> 1 segment (limit 160)
		const msg100 = "A".repeat(100);
		const calc1 = calculateSmsSegments(msg100, true);
		expect(calc1.encoding).toBe("GSM_7");
		expect(calc1.segments).toBe(1);
		expect(calc1.totalCharacterCount).toBe(123);
		expect(calc1.costPerSegmentKobo).toBe(600);
		expect(calc1.totalCostKobo).toBe(600);

		// 140 chars + 23 opt out = 163 chars -> 2 segments (163 / 153 = 2)
		const msg140 = "A".repeat(140);
		const calc2 = calculateSmsSegments(msg140, true);
		expect(calc2.encoding).toBe("GSM_7");
		expect(calc2.segments).toBe(2);
		expect(calc2.totalCharacterCount).toBe(163);
		expect(calc2.totalCostKobo).toBe(1200);
	});

	it("calculates single and multi part segments for Unicode", () => {
		// Unicode message with emoji
		// 30 chars + 24 opt out = 54 chars -> 1 segment (limit 70)
		const unicodeShort = "Join us this Sunday! 🎉";
		const calc1 = calculateSmsSegments(unicodeShort, true);
		expect(calc1.encoding).toBe("UNICODE");
		expect(calc1.segments).toBe(1);

		// 50 chars + 24 opt out = 74 chars -> 2 segments (limit 70, multi part 67)
		const unicodeLong = `${"A".repeat(49)}🎉`;
		const calc2 = calculateSmsSegments(unicodeLong, true);
		expect(calc2.encoding).toBe("UNICODE");
		expect(calc2.segments).toBe(2);
		expect(calc2.totalCostKobo).toBe(1200);
	});

	it("calculates maximum segments across audience with variable expansion", () => {
		// Template with {{name}} close to the 160 char boundary
		// 130 chars + 24 opt out = 154 chars.
		// A short name (5 chars) keeps it <= 160 chars -> 1 segment.
		// A long name (15 chars) pushes it to 164 chars -> 2 segments.
		const template = `${"A".repeat(128)} {{name}}`;
		const contacts = [
			{ name: "Ada" },
			{ name: "Oluwaseun-Babatunde" }, // 19 chars
			{ name: null }, // falls back to Friend
		];

		const audienceCalc = calculateMaxSegmentsForAudience({
			contacts,
			template,
		});

		expect(audienceCalc.totalContacts).toBe(3);
		expect(audienceCalc.maxSegments).toBe(2);
		expect(audienceCalc.totalEstimatedCostKobo).toBe(3 * 2 * 600);
	});
});
