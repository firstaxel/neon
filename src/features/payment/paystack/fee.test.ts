import { describe, expect, it } from "vitest";
import { calculatePaystackFee } from "./fee";

describe("calculatePaystackFee", () => {
	// covers: AC-1
	it("waives the 100 Naira flat fee for transactions under 2500 Naira", () => {
		// 1000 Naira = 100,000 kobo
		const fee = calculatePaystackFee(100_000);
		// 100,000 / 0.985 = 101,523 kobo gross => 1,523 kobo fee
		expect(fee).toBe(1523);
	});

	// covers: AC-1
	it("adds the 100 Naira flat fee for transactions at or above 2500 Naira", () => {
		// 5000 Naira = 500,000 kobo
		const fee = calculatePaystackFee(500_000);
		// (500,000 + 10,000) / 0.985 = 517,766 kobo gross => 17,766 kobo fee
		expect(fee).toBe(17_766);
	});

	// covers: AC-1
	it("caps the maximum gateway fee at 2000 Naira (200000 kobo)", () => {
		// 1,000,000 Naira = 100,000,000 kobo
		const fee = calculatePaystackFee(100_000_000);
		expect(fee).toBe(200_000);

		// Maximum deposit 5,000,000 Naira = 500,000,000 kobo
		const maxFee = calculatePaystackFee(500_000_000);
		expect(maxFee).toBe(200_000);
	});

	// covers: AC-1
	it("handles minimum deposit threshold of 500 Naira correctly", () => {
		// 500 Naira = 50,000 kobo
		const fee = calculatePaystackFee(50_000);
		// 50,000 / 0.985 = 50,761 kobo gross => 761 kobo fee
		expect(fee).toBe(761);
	});
});
