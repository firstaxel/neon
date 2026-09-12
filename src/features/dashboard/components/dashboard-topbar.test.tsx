import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "#/components/ui/sidebar";
import { DashboardTopbar } from "./dashboard-topbar";

let currentPath = "/dashboard";
const NEW_CAMPAIGN_REGEX = /New Campaign/i;
const WALLET_BALANCE_REGEX = /View prepaid wallet balance/i;

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
	useRouterState: () => ({
		location: { pathname: currentPath },
	}),
}));

vi.mock("#/features/billing/hooks/use-billing", () => ({
	useInitDeposit: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
	useWallet: () => ({
		data: {
			balanceKobo: 200_000,
			heldKobo: 0,
		},
		isLoading: false,
	}),
}));

vi.mock("#/features/billing/components/deposit-dialog", () => ({
	DepositDialog: ({ open }: { open: boolean }) =>
		open ? <div data-testid="deposit-dialog">DepositDialog</div> : null,
}));

describe("DashboardTopbar component", () => {
	beforeEach(() => {
		currentPath = "/dashboard";
	});

	it("renders breadcrumb matching the current active route", () => {
		currentPath = "/campaigns";

		render(
			<SidebarProvider>
				<DashboardTopbar />
			</SidebarProvider>
		);

		const slash = screen.getByText("/", { exact: true });
		expect(slash.parentElement?.textContent).toContain("Campaigns");
	});

	it("renders quick spendable wallet balance badge", () => {
		render(
			<SidebarProvider>
				<DashboardTopbar />
			</SidebarProvider>
		);

		// 200,000 kobo = ₦2,000.00
		expect(screen.getByText("₦2,000.00")).toBeDefined();
	});

	it("opens deposit dialog when clicking wallet balance badge", () => {
		render(
			<SidebarProvider>
				<DashboardTopbar />
			</SidebarProvider>
		);

		expect(screen.queryByTestId("deposit-dialog")).toBeNull();
		const walletBtn = screen.getByRole("button", {
			name: WALLET_BALANCE_REGEX,
		});
		fireEvent.click(walletBtn);
		expect(screen.getByTestId("deposit-dialog")).toBeDefined();
	});

	it("renders quick action button linking to campaign creation", () => {
		render(
			<SidebarProvider>
				<DashboardTopbar />
			</SidebarProvider>
		);

		const newCampaignLink = screen.getByRole("link", {
			name: NEW_CAMPAIGN_REGEX,
		});
		expect(newCampaignLink.getAttribute("href")).toBe("/campaigns/create");
	});
});
