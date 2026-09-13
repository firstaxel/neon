import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "#/components/ui/sidebar";
import { ThemeProvider } from "#/providers/theme";
import { AppSidebar, isRouteActive } from "./app-sidebar";

let currentPath = "/dashboard";
const HOME_REGEX = /^Home$/i;
const CAMPAIGNS_REGEX = /^Campaigns$/i;
const CONTACTS_REGEX = /^Contacts$/i;
const BILLING_REGEX = /^Billing$/i;
const TOP_UP_REGEX = /Top up wallet balance/i;
const VELOCAST_HOME_REGEX = /Velocast home/i;

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		className,
		onClick,
		...props
	}: {
		children: React.ReactNode;
		to: string;
		className?: string;
		onClick?: (e: React.MouseEvent) => void;
	}) => (
		<a className={className} href={to} onClick={onClick} {...props}>
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

vi.mock("#/features/profile/hooks/use-profile", () => ({
	useProfile: () => ({
		data: {
			email: "coordinator@velocast.org",
			name: "Sarah Connor",
			orgName: "Grace Fellowship",
			orgType: "church",
		},
		isLoading: false,
	}),
}));

vi.mock("#/features/billing/hooks/use-billing", () => ({
	useInitDeposit: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
	useWallet: () => ({
		data: {
			balanceKobo: 500_000,
			heldKobo: 50_000,
		},
		isLoading: false,
	}),
}));

vi.mock("./user-menu", () => ({
	UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

vi.mock("#/features/billing/components/deposit-dialog", () => ({
	DepositDialog: ({ open }: { open: boolean }) =>
		open ? <div data-testid="deposit-dialog">DepositDialog</div> : null,
}));

describe("AppSidebar component", () => {
	beforeEach(() => {
		currentPath = "/dashboard";
	});

	it("renders brand logo linking to dashboard", () => {
		render(
			<ThemeProvider>
				<SidebarProvider defaultOpen={true}>
					<AppSidebar />
				</SidebarProvider>
			</ThemeProvider>
		);

		const logoLink = screen.getByRole("link", { name: VELOCAST_HOME_REGEX });
		expect(logoLink).toBeDefined();
		expect(logoLink.getAttribute("href")).toBe("/dashboard");
	});

	it("displays active organization name and org type label", () => {
		render(
			<ThemeProvider>
				<SidebarProvider defaultOpen={true}>
					<AppSidebar />
				</SidebarProvider>
			</ThemeProvider>
		);

		expect(screen.getByText("Grace Fellowship")).toBeDefined();
		expect(screen.getByText("Church / Ministry")).toBeDefined();
	});

	it("renders all primary navigation destinations", () => {
		render(
			<ThemeProvider>
				<SidebarProvider defaultOpen={true}>
					<AppSidebar />
				</SidebarProvider>
			</ThemeProvider>
		);

		expect(screen.getByRole("link", { name: HOME_REGEX })).toBeDefined();
		expect(screen.getByRole("link", { name: CAMPAIGNS_REGEX })).toBeDefined();
		expect(screen.getByRole("link", { name: CONTACTS_REGEX })).toBeDefined();
		expect(screen.getByRole("link", { name: BILLING_REGEX })).toBeDefined();
	});

	it("renders spendable wallet funds formatted in Naira", () => {
		render(
			<ThemeProvider>
				<SidebarProvider defaultOpen={true}>
					<AppSidebar />
				</SidebarProvider>
			</ThemeProvider>
		);

		// 500,000 balance minus 50,000 held = 450,000 kobo = ₦4,500.00
		expect(screen.getByText("₦4,500.00")).toBeDefined();
		expect(screen.getByText("Spendable funds")).toBeDefined();
		expect(screen.getByText("₦500.00 held in active dispatch")).toBeDefined();
	});

	it("opens deposit dialog when clicking top up button", () => {
		render(
			<ThemeProvider>
				<SidebarProvider defaultOpen={true}>
					<AppSidebar />
				</SidebarProvider>
			</ThemeProvider>
		);

		expect(screen.queryByTestId("deposit-dialog")).toBeNull();
		const topUpButton = screen.getByRole("button", { name: TOP_UP_REGEX });
		fireEvent.click(topUpButton);
		expect(screen.getByTestId("deposit-dialog")).toBeDefined();
	});

	it("correctly identifies active routes with isRouteActive helper", () => {
		expect(isRouteActive("/dashboard", "/dashboard")).toBe(true);
		expect(isRouteActive("/dashboard/overview", "/dashboard")).toBe(true);
		expect(isRouteActive("/campaigns", "/campaigns")).toBe(true);
		expect(isRouteActive("/campaigns/create", "/campaigns")).toBe(true);
		expect(isRouteActive("/contacts", "/campaigns")).toBe(false);
	});
});
