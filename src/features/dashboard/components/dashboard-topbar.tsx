import { Link, useRouterState } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import React, { useState } from "react";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import { SidebarTrigger } from "#/components/ui/sidebar";
import { DepositDialog } from "#/features/billing/components/deposit-dialog";
import { useWallet } from "#/features/billing/hooks/use-billing";
import { formatNaira } from "#/features/billing/utils/format";

const ROUTE_LABELS: Record<string, string> = {
	"/billing": "Billing",
	"/campaigns": "Campaigns",
	"/contacts": "Contacts",
	"/dashboard": "Dashboard",
	"/messages": "Messages",
	"/onboarding": "Onboarding",
	"/settings": "Settings",
	"/templates": "Templates",
};

export function DashboardBreadcrumb() {
	const { location } = useRouterState();
	const { pathname } = location;

	const label =
		ROUTE_LABELS[pathname] ??
		Object.entries(ROUTE_LABELS)
			.filter(([route]) => pathname.startsWith(`${route}/`))
			.sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
		"Velocast";

	return (
		<div className="flex min-w-0 items-center gap-1.5 font-mono text-sm">
			<span className="shrink-0 text-muted-foreground">/</span>
			<span className="truncate font-medium text-foreground">{label}</span>
		</div>
	);
}

export function DashboardTopbar() {
	const { data: wallet } = useWallet();
	const [depositOpen, setDepositOpen] = useState(false);

	const balanceKobo = wallet?.balanceKobo ?? 0;
	const heldKobo = wallet?.heldKobo ?? 0;
	const spendableKobo = Math.max(0, balanceKobo - heldKobo);

	const handleOpenDeposit = React.useCallback(() => {
		setDepositOpen(true);
	}, []);

	return (
		<>
			<header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-border border-b bg-background/95 px-4 backdrop-blur-sm">
				<SidebarTrigger
					aria-label="Toggle navigation sidebar"
					className="-ml-1"
				/>
				<Separator className="mr-2 h-4" orientation="vertical" />
				<DashboardBreadcrumb />

				<div className="ml-auto flex items-center gap-2">
					<button
						aria-label="View prepaid wallet balance"
						className="flex items-center gap-1.5 rounded-stadium border border-border/80 bg-card px-2.5 py-1 font-medium font-mono text-foreground text-xs shadow-2xs transition-colors hover:bg-muted/40"
						onClick={handleOpenDeposit}
						type="button"
					>
						<Wallet className="size-3.5 text-primary" />
						<span className="tabular-nums">{formatNaira(spendableKobo)}</span>
					</button>

					<Link className="hidden sm:inline-flex" to="/campaigns/create">
						<Button
							aria-label="New Campaign"
							className="gap-1 rounded-stadium font-medium text-xs"
							size="xs"
							type="button"
						>
							<Plus className="size-3.5" />
							<span>New Campaign</span>
						</Button>
					</Link>
				</div>
			</header>

			<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
		</>
	);
}
