import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./textarea";

describe("Textarea primitive", () => {
	// covers: AC-1, AC-2
	it("renders an accessible textarea with stadium radius token", () => {
		render(<Textarea aria-label="Campaign message" placeholder="Type here" />);

		const textarea = screen.getByRole("textbox", { name: "Campaign message" });
		expect(textarea).toBeDefined();
		expect(textarea.getAttribute("placeholder")).toBe("Type here");
		expect(textarea.className).toContain("rounded-3xl");
		expect(textarea.getAttribute("data-slot")).toBe("textarea");
	});

	// covers: AC-2
	it("receives typed input and triggers change events", () => {
		let value = "";
		const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
			({ value } = e.target);
		};

		render(<Textarea aria-label="Message template" onChange={handleChange} />);

		const textarea = screen.getByRole("textbox", { name: "Message template" });
		fireEvent.change(textarea, { target: { value: "Hello community" } });

		expect(value).toBe("Hello community");
	});

	// covers: AC-2
	it("respects disabled state when deactivated", () => {
		render(<Textarea aria-label="Locked input" disabled />);

		const textarea = screen.getByRole("textbox", { name: "Locked input" });
		expect(textarea.hasAttribute("disabled")).toBe(true);
	});

	// covers: AC-2
	it("supports aria-invalid when validation fails", () => {
		render(<Textarea aria-invalid="true" aria-label="Invalid input" />);

		const textarea = screen.getByRole("textbox", { name: "Invalid input" });
		expect(textarea.getAttribute("aria-invalid")).toBe("true");
	});
});
