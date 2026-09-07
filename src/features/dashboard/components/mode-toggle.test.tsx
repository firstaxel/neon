import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "#/providers/theme";
import { ModeToggle } from "./mode-toggle";

vi.mock("@tanstack/react-router", () => ({
	ScriptOnce: ({ children }: { children: React.ReactNode }) => (
		<script data-testid="script-once">{children}</script>
	),
}));

describe("ModeToggle component", () => {
	beforeEach(() => {
		localStorage.clear();
		// biome-ignore lint/suspicious/noDocumentCookie: resets cookies in test environment
		document.cookie =
			"ui-theme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
		document.documentElement.classList.remove("light", "dark", "system");
	});

	// covers: AC-5
	it("renders an accessible theme toggle trigger button", () => {
		render(
			<ThemeProvider>
				<ModeToggle />
			</ThemeProvider>
		);

		const button = screen.getByRole("button", { name: "Toggle theme" });
		expect(button).toBeDefined();
		expect(button.getAttribute("aria-label")).toBe("Toggle theme");
	});

	// covers: AC-5
	it("opens the dropdown menu displaying light, dark, and system options", async () => {
		render(
			<ThemeProvider>
				<ModeToggle />
			</ThemeProvider>
		);

		const trigger = screen.getByRole("button", { name: "Toggle theme" });
		fireEvent.click(trigger);

		expect(await screen.findByText("Light")).toBeDefined();
		expect(screen.getByText("Dark")).toBeDefined();
		expect(screen.getByText("System")).toBeDefined();
	});

	// covers: AC-5
	it("switches to dark theme when selecting the dark option", async () => {
		render(
			<ThemeProvider>
				<ModeToggle />
			</ThemeProvider>
		);

		const trigger = screen.getByRole("button", { name: "Toggle theme" });
		fireEvent.click(trigger);

		const darkItem = await screen.findByText("Dark");
		act(() => {
			fireEvent.click(darkItem);
		});

		expect(localStorage.getItem("ui-theme")).toBe("dark");
		expect(document.cookie).toContain("ui-theme=dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	// covers: AC-5
	it("switches to light theme when selecting the light option", async () => {
		render(
			<ThemeProvider>
				<ModeToggle />
			</ThemeProvider>
		);

		const trigger = screen.getByRole("button", { name: "Toggle theme" });
		fireEvent.click(trigger);

		const lightItem = await screen.findByText("Light");
		act(() => {
			fireEvent.click(lightItem);
		});

		expect(localStorage.getItem("ui-theme")).toBe("light");
		expect(document.cookie).toContain("ui-theme=light");
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});
});
