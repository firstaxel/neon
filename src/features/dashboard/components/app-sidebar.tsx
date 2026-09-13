import { Link, useRouterState } from "@tanstack/react-router";
import {
	CreditCard,
	FileText,
	LayoutDashboard,
	MessageSquare,
	Plus,
	Send,
	Settings,
	Users,
	Wallet,
} from "lucide-react";
import React, { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
	useSidebar,
} from "#/components/ui/sidebar";
import { UserAvatar } from "#/features/auth/components/user-avatar";
import { DepositDialog } from "#/features/billing/components/deposit-dialog";
import { useWallet } from "#/features/billing/hooks/use-billing";
import { formatNaira } from "#/features/billing/utils/format";
import { ModeToggle } from "#/features/dashboard/components/mode-toggle";
import { UserMenu } from "#/features/dashboard/components/user-menu";
import { ORG_TYPE_LABELS, type OrgType } from "#/features/miscellaneous/org";
import { useProfile } from "#/features/profile/hooks/use-profile";
import { cn } from "#/lib/utils";

// ─── Route Matching ───────────────────────────────────────────────────────────

export function isRouteActive(pathname: string, href: string): boolean {
	if (pathname === href) {
		return true;
	}
	if (href === "/dashboard") {
		return pathname.startsWith("/dashboard/");
	}
	return pathname.startsWith(`${href}/`) || pathname === href;
}

// ─── Navigation Items ─────────────────────────────────────────────────────────

export interface NavItem {
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
	{ href: "/dashboard", icon: LayoutDashboard, label: "Home" },
	{ href: "/campaigns", icon: Send, label: "Campaigns" },
	{ href: "/contacts", icon: Users, label: "Contacts" },
	{ href: "/messages", icon: MessageSquare, label: "Messages" },
	{ href: "/templates", icon: FileText, label: "Templates" },
	{ href: "/billing", icon: Wallet, label: "Billing" },
	{ href: "/settings", icon: Settings, label: "Settings" },
];

// ─── Brand Logo ───────────────────────────────────────────────────────────────

function BrandLogo() {
	return (
		<Link
			aria-label="Velocast home"
			className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
			to="/dashboard"
		>
			<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
				<svg
					className="size-5"
					fill="none"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Velocast</title>
					<path
						className="fill-current"
						d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.05 21.95a.5.5 0 00.6.6l4.782-1.388A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
					/>
					<path
						d="M8 11.5h8M8 14.5h5"
						stroke="currentColor"
						strokeLinecap="round"
						strokeWidth="1.5"
					/>
				</svg>
			</div>
			<div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
				<span className="font-bold text-base text-sidebar-foreground leading-tight tracking-tight">
					Velocast
				</span>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Dispatch Console
				</span>
			</div>
		</Link>
	);
}

// ─── Organization Badge Card ──────────────────────────────────────────────────

function OrgCard() {
	const { data: profile } = useProfile();
	const orgType = (profile?.orgType ?? "other") as OrgType;
	const orgMeta = ORG_TYPE_LABELS[orgType] ?? ORG_TYPE_LABELS.other;
	const orgName = profile?.orgName ?? "Active Workspace";

	return (
		<div className="mx-2 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-2.5 transition-colors group-data-[collapsible=icon]:hidden">
			<div className="flex min-w-0 items-center gap-2.5">
				<span
					aria-hidden="true"
					className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-background text-sm shadow-2xs"
				>
					{orgMeta.icon}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-sidebar-foreground text-xs">
						{orgName}
					</p>
					<p className="truncate text-[10px] text-muted-foreground">
						{orgMeta.label}
					</p>
				</div>
			</div>
		</div>
	);
}

// ─── Docked Wallet Card ───────────────────────────────────────────────────────

function SidebarWalletCard({ onOpenDeposit }: { onOpenDeposit: () => void }) {
	const { data: wallet, isLoading } = useWallet();
	const balanceKobo = wallet?.balanceKobo ?? 0;
	const heldKobo = wallet?.heldKobo ?? 0;
	const spendableKobo = Math.max(0, balanceKobo - heldKobo);

	return (
		<>
			{/* Expanded view */}
			<div className="mx-2 mb-2 space-y-2 rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-3 group-data-[collapsible=icon]:hidden">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
						<Wallet className="size-3.5 text-primary" />
						<span>Prepaid Balance</span>
					</div>
					<span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Live
					</span>
				</div>

				<div>
					{isLoading ? (
						<div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
					) : (
						<p className="font-bold font-mono text-lg text-sidebar-foreground tabular-nums tracking-tight">
							{formatNaira(spendableKobo)}
						</p>
					)}
					<p className="text-[11px] text-muted-foreground">Spendable funds</p>
				</div>

				{heldKobo > 0 && (
					<p className="font-mono text-[10px] text-amber-500">
						{formatNaira(heldKobo)} held in active dispatch
					</p>
				)}

				<Button
					aria-label="Top up wallet balance"
					className="w-full justify-center gap-1.5 rounded-stadium font-medium text-xs"
					onClick={onOpenDeposit}
					size="xs"
					type="button"
					variant="outline"
				>
					<CreditCard className="size-3" />
					<span>Top up wallet</span>
				</Button>
			</div>

			{/* Collapsed icon mode view */}
			<SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
				<SidebarMenuButton
					aria-label="Top up wallet"
					onClick={onOpenDeposit}
					tooltip={`Wallet: ${formatNaira(spendableKobo)}`}
				>
					<Wallet className="size-4" />
				</SidebarMenuButton>
			</SidebarMenuItem>
		</>
	);
}

// ─── Primary Sidebar Component ────────────────────────────────────────────────

export function AppSidebar({
	className,
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const { location } = useRouterState();
	const { pathname } = location;
	const { data: profile } = useProfile();
	const [depositOpen, setDepositOpen] = useState(false);
	const { setOpenMobile } = useSidebar();

	const handleOpenDeposit = React.useCallback(() => {
		setDepositOpen(true);
	}, []);

	const handleNavClick = React.useCallback(() => {
		setOpenMobile(false);
	}, [setOpenMobile]);

	const displayName = profile?.name ?? profile?.email ?? "Account";
	const email = profile?.email ?? "";

	return (
		<>
			<Sidebar
				className={cn("border-sidebar-border border-r", className)}
				collapsible="icon"
				variant="sidebar"
				{...props}
			>
				{/* ── Header ── */}
				<SidebarHeader className="gap-2 p-2">
					<BrandLogo />
					<OrgCard />
					<div className="px-2 pt-1 group-data-[collapsible=icon]:px-0">
						<Link
							className="w-full outline-hidden"
							onClick={handleNavClick}
							to="/campaigns/create"
						>
							<Button
								aria-label="Create new campaign"
								className="w-full justify-center gap-1.5 rounded-stadium font-medium shadow-xs group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
								size="sm"
								type="button"
							>
								<Plus className="size-4" />
								<span className="group-data-[collapsible=icon]:hidden">
									New Campaign
								</span>
							</Button>
						</Link>
					</div>
				</SidebarHeader>

				<SidebarSeparator />

				{/* ── Content Navigation ── */}
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Navigation</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{MAIN_NAV_ITEMS.map((item) => {
									const active = isRouteActive(pathname, item.href);
									return (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton
												isActive={active}
												onClick={handleNavClick}
												render={<Link to={item.href} />}
												tooltip={item.label}
											>
												<item.icon className="size-4" />
												<span>{item.label}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				{/* ── Docked Wallet Balance Card ── */}
				<SidebarMenu>
					<SidebarWalletCard onOpenDeposit={handleOpenDeposit} />
				</SidebarMenu>

				<SidebarSeparator />

				{/* ── Footer / Profile ── */}
				<SidebarFooter className="p-2">
					<div className="flex items-center justify-between rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-2 group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
						<div className="flex min-w-0 items-center gap-2.5 group-data-[collapsible=icon]:hidden">
							<UserAvatar image={profile?.image} name={displayName} size={32} />
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold text-sidebar-foreground text-xs leading-tight">
									{displayName}
								</p>
								{Boolean(email) && (
									<p className="truncate text-[10px] text-muted-foreground leading-tight">
										{email}
									</p>
								)}
							</div>
						</div>
						<div className="flex items-center gap-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
							<ModeToggle />
							<UserMenu />
						</div>
					</div>
				</SidebarFooter>

				<SidebarRail />
			</Sidebar>

			{/* Modal deposit dialog triggered anywhere from sidebar */}
			<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
		</>
	);
}
