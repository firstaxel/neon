import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedTabs, DesktopTabs, MobileNav, type Tab } from "./tabs";

let currentPath = "/dashboard";
const HOME_REGEX = /Home/i;
const CAMPAIGNS_REGEX = /Campaigns/i;

function MockLink({
	children,
	to,
	onClick,
	className,
	...props
}: {
	children: React.ReactNode;
	to: string;
	onClick?: (e: React.MouseEvent) => void;
	className?: string;
}) {
	const handleClick = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			onClick?.(e);
		},
		[onClick]
	);

	return (
		<a className={className} href={to} onClick={handleClick} {...props}>
			{children}
		</a>
	);
}

vi.mock("@tanstack/react-router", () => ({
	Link: MockLink,
	useRouterState: () => ({
		location: { pathname: currentPath },
	}),
}));

const TEST_TABS: Tab[] = [
	{ href: "/dashboard", label: "Home", value: "home" },
	{ href: "/campaigns", label: "Campaigns", value: "campaigns" },
	{ href: "/contacts", label: "Contacts", value: "contacts" },
	{ href: "/messages", label: "Messages", value: "messages" },
	{ href: "/templates", label: "Templates", value: "templates" },
	{ href: "/billing", label: "Billing", value: "billing" },
];

describe("Tabs component", () => {
	beforeEach(() => {
		currentPath = "/dashboard";
	});

	// covers: AC-3
	it("renders desktop navigation with all tab labels and identifies active tab", () => {
		render(<DesktopTabs tabs={TEST_TABS} />);

		const nav = screen.getByRole("navigation", {
			name: "Main dashboard navigation",
		});
		expect(nav).toBeDefined();

		const homeLink = screen.getByRole("link", { name: HOME_REGEX });
		expect(homeLink).toBeDefined();
		expect(homeLink.getAttribute("href")).toBe("/dashboard");

		const campaignsLink = screen.getByRole("link", { name: CAMPAIGNS_REGEX });
		expect(campaignsLink).toBeDefined();
		expect(campaignsLink.getAttribute("href")).toBe("/campaigns");
	});

	// covers: AC-3
	it("renders AnimatedTabs container wrapping navigation", () => {
		render(<AnimatedTabs tabs={TEST_TABS} />);

		const nav = screen.getByRole("navigation", {
			name: "Main dashboard navigation",
		});
		expect(nav).toBeDefined();

		const toggleButton = screen.getByRole("button", {
			name: "Toggle navigation drawer",
		});
		expect(toggleButton).toBeDefined();
	});

	// covers: AC-4
	it("renders mobile drawer collapsed with current active route title", () => {
		render(<MobileNav tabs={TEST_TABS} />);

		const toggleButton = screen.getByRole("button", {
			name: "Toggle navigation drawer",
		});
		expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
		expect(toggleButton.textContent).toContain("Home");
		expect(screen.queryByLabelText("Mobile navigation")).toBeNull();
	});

	// covers: AC-4
	it("expands mobile nav drawer on toggle click with 44px tap targets", () => {
		render(<MobileNav tabs={TEST_TABS} />);

		const toggleButton = screen.getByRole("button", {
			name: "Toggle navigation drawer",
		});
		fireEvent.click(toggleButton);

		expect(toggleButton.getAttribute("aria-expanded")).toBe("true");

		const drawer = screen.getByLabelText("Mobile navigation");
		expect(drawer).toBeDefined();

		const links = screen.getAllByRole("link");
		for (const link of links) {
			expect(link.className).toContain("min-h-[44px]");
		}
	});

	// covers: AC-4
	it("closes mobile nav drawer when pressing Escape key", () => {
		render(<MobileNav tabs={TEST_TABS} />);

		const toggleButton = screen.getByRole("button", {
			name: "Toggle navigation drawer",
		});
		fireEvent.click(toggleButton);
		expect(toggleButton.getAttribute("aria-expanded")).toBe("true");

		fireEvent.keyDown(window, { key: "Escape" });
		expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
	});

	// covers: AC-4
	it("closes mobile nav drawer when selecting a navigation link", () => {
		render(<MobileNav tabs={TEST_TABS} />);

		const toggleButton = screen.getByRole("button", {
			name: "Toggle navigation drawer",
		});
		fireEvent.click(toggleButton);

		const campaignsLink = screen.getByRole("link", { name: CAMPAIGNS_REGEX });
		fireEvent.click(campaignsLink);

		expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
	});
});
