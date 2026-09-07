import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, themeScript, useTheme } from "./theme";

vi.mock("@tanstack/react-router", () => ({
	ScriptOnce: ({ children }: { children: React.ReactNode }) => (
		<script data-testid="script-once">{children}</script>
	),
}));

describe("Theme provider and script", () => {
	beforeEach(() => {
		localStorage.clear();
		// biome-ignore lint/suspicious/noDocumentCookie: resets cookies in test environment
		document.cookie =
			"ui-theme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
		document.documentElement.classList.remove("light", "dark", "system");
	});

	// covers: AC-5
	it("exports a serialized theme script for head injection", () => {
		expect(typeof themeScript).toBe("string");
		expect(themeScript.length).toBeGreaterThan(20);
		expect(themeScript).toContain("ui-theme");
	});

	// covers: AC-5
	it("throws descriptive error when useTheme is called outside ThemeProvider", () => {
		expect(() => {
			renderHook(() => useTheme());
		}).toThrow("useTheme must be used within a ThemeProvider");
	});

	// covers: AC-5
	it("provides initial system theme preference", () => {
		function Consumer() {
			const { userTheme } = useTheme();
			return <span data-testid="theme-val">{userTheme}</span>;
		}

		render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>
		);

		expect(screen.getByTestId("theme-val").textContent).toBe("system");
	});

	// covers: AC-5
	it("updates theme state, local storage, and cookies on setTheme", () => {
		function Consumer() {
			const { setTheme, userTheme } = useTheme();
			const handleSetDark = React.useCallback(() => {
				setTheme("dark");
			}, [setTheme]);

			return (
				<div>
					<span data-testid="theme-val">{userTheme}</span>
					<button onClick={handleSetDark} type="button">
						Set Dark
					</button>
				</div>
			);
		}

		render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>
		);

		const button = screen.getByRole("button", { name: "Set Dark" });
		act(() => {
			button.click();
		});

		expect(screen.getByTestId("theme-val").textContent).toBe("dark");
		expect(localStorage.getItem("ui-theme")).toBe("dark");
		expect(document.cookie).toContain("ui-theme=dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});
});
