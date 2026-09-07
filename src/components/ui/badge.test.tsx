import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge primitive", () => {
	// covers: AC-2
	it("renders children with default role and styling classes", () => {
		render(<Badge>Active Status</Badge>);

		const badge = screen.getByText("Active Status");
		expect(badge).toBeDefined();
		expect(badge.tagName.toLowerCase()).toBe("span");
		expect(badge.className).toContain("rounded-3xl");
	});

	// covers: AC-6
	it("applies semantic whatsapp channel styling", () => {
		render(<Badge variant="whatsapp">WhatsApp Outreach</Badge>);

		const badge = screen.getByText("WhatsApp Outreach");
		expect(badge).toBeDefined();
		expect(badge.className).toContain("text-[#15803d]");
		expect(badge.className).toContain("font-mono");
	});

	// covers: AC-6
	it("applies semantic sms channel styling", () => {
		render(<Badge variant="sms">SMS Broadcast</Badge>);

		const badge = screen.getByText("SMS Broadcast");
		expect(badge).toBeDefined();
		expect(badge.className).toContain("text-[#1d4ed8]");
		expect(badge.className).toContain("font-mono");
	});

	// covers: AC-2
	it("merges custom class names without discarding core tokens", () => {
		render(<Badge className="custom-test-marker">Custom</Badge>);

		const badge = screen.getByText("Custom");
		expect(badge.className).toContain("custom-test-marker");
		expect(badge.className).toContain("rounded-3xl");
	});
});
