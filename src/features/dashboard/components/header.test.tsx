import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "#/providers/theme";
import AnimatedHeader from "./header";

let currentPath = "/dashboard";
const VELOCAST_HOME_REGEX = /Velocast home/i;

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		className,
		...props
	}: {
		children: React.ReactNode;
		to: string;
		className?: string;
	}) => (
		<a className={className} href={to} {...props}>
			{children}
		</a>
	),
	ScriptOnce: ({ children }: { children: React.ReactNode }) => (
		<script data-testid="script-once">{children}</script>
	),
	useRouterState: () => ({
		location: { pathname: currentPath },
	}),
}));

vi.mock("./user-menu", () => ({
	UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

describe("AnimatedHeader component", () => {
	beforeEach(() => {
		currentPath = "/dashboard";
	});

	// covers: AC-3
	it("renders persistent header with brand logo linking to dashboard", () => {
		render(
			<ThemeProvider>
				<AnimatedHeader />
			</ThemeProvider>
		);

		const logoLink = screen.getByRole("link", { name: VELOCAST_HOME_REGEX });
		expect(logoLink).toBeDefined();
		expect(logoLink.getAttribute("href")).toBe("/dashboard");
	});

	// covers: AC-3
	it("displays breadcrumb label matching active route pathname", () => {
		currentPath = "/campaigns";

		render(
			<ThemeProvider>
				<AnimatedHeader />
			</ThemeProvider>
		);

		const slashElement = screen.getByText("/", { exact: true });
		const breadcrumbContainer = slashElement.parentElement;
		expect(breadcrumbContainer?.textContent).toContain("Campaigns");
	});

	// covers: AC-3
	it("falls back to default label for unknown routes", () => {
		currentPath = "/unknown-path";

		render(
			<ThemeProvider>
				<AnimatedHeader />
			</ThemeProvider>
		);

		const slashElement = screen.getByText("/", { exact: true });
		const breadcrumbContainer = slashElement.parentElement;
		expect(breadcrumbContainer?.textContent).toContain("Velocast");
	});

	// covers: AC-3
	it("renders header action controls including user menu and theme toggle", () => {
		render(
			<ThemeProvider>
				<AnimatedHeader />
			</ThemeProvider>
		);

		expect(screen.getByTestId("user-menu")).toBeDefined();
		expect(screen.getByRole("button", { name: "Toggle theme" })).toBeDefined();
	});

	// covers: AC-3
	it("renders navigation tabs and handles window scroll events smoothly", () => {
		const { unmount } = render(
			<ThemeProvider>
				<AnimatedHeader />
			</ThemeProvider>
		);

		expect(
			screen.getByRole("navigation", { name: "Main dashboard navigation" })
		).toBeDefined();

		// Simulate scroll event
		fireEvent.scroll(window, { target: { scrollY: 120 } });

		// Cleans up cleanly on unmount
		unmount();
	});
});
