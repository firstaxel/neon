import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import React from "react";
import { cn } from "#/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tab {
	href: string;
	label: string;
	subRoutes?: string[];
	value: string;
}

interface AnimatedTabsProps {
	tabs: Tab[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTabActive(pathname: string, tab: Tab): boolean {
	if (pathname === tab.href) {
		return true;
	}
	if (
		tab.subRoutes?.some((r) => pathname === r || pathname.startsWith(`${r}/`))
	) {
		return true;
	}
	if (tab.href !== "/" && pathname.startsWith(`${tab.href}/`)) {
		return true;
	}
	return false;
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

export function MobileNav({ tabs }: { tabs: Tab[] }) {
	const { location } = useRouterState();
	const { pathname } = location;
	const [open, setOpen] = React.useState(false);

	const activeTab = tabs.find((tab) => isTabActive(pathname, tab));

	const handleToggleOpen = React.useCallback(() => {
		setOpen((v) => !v);
	}, []);

	const handleClose = React.useCallback(() => {
		setOpen(false);
	}, []);

	// Close on Escape key
	React.useEffect(() => {
		if (!open) {
			return;
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	return (
		<div className="relative w-full max-w-full overflow-hidden md:hidden">
			<button
				aria-controls="mobile-nav-drawer"
				aria-expanded={open}
				aria-label="Toggle navigation drawer"
				className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-2.5 font-medium text-foreground text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
				onClick={handleToggleOpen}
				type="button"
			>
				<span className="font-semibold text-foreground">
					{activeTab?.label ?? "Navigate"}
				</span>
				<motion.svg
					animate={{ rotate: open ? 180 : 0 }}
					className="h-4 w-4 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					transition={{ duration: 0.2 }}
					viewBox="0 0 24 24"
				>
					<path
						d="M19 9l-7 7-7-7"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</motion.svg>
			</button>

			<AnimatePresence>
				{Boolean(open) && (
					<motion.div
						animate={{ height: "auto", opacity: 1 }}
						aria-label="Mobile navigation"
						className="mt-1 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md"
						exit={{ height: 0, opacity: 0 }}
						id="mobile-nav-drawer"
						initial={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
					>
						<div className="flex flex-col space-y-0.5 p-1.5">
							{tabs.map((tab) => {
								const isActive = isTabActive(pathname, tab);
								return (
									<Link
										className={cn(
											"flex min-h-[44px] items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											isActive
												? "bg-muted font-semibold text-foreground"
												: "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted"
										)}
										key={tab.value}
										onClick={handleClose}
										to={tab.href}
									>
										<span>{tab.label}</span>
										{isActive && (
											<span className="h-2 w-2 rounded-full bg-primary" />
										)}
									</Link>
								);
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ─── Desktop Tabs ─────────────────────────────────────────────────────────────

interface DesktopTabItemProps {
	index: number;
	isActive: boolean;
	isHovered: boolean;
	onHover: (index: number) => void;
	tab: Tab;
}

function DesktopTabItem({
	index,
	isActive,
	isHovered,
	onHover,
	tab,
}: DesktopTabItemProps) {
	const handleHover = React.useCallback(() => {
		onHover(index);
	}, [index, onHover]);

	return (
		<Link
			className="relative z-20 flex h-8 items-center justify-center rounded-full px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
			key={tab.value}
			onFocus={handleHover}
			onPointerEnter={handleHover}
			to={tab.href}
		>
			{/* Active background pill */}
			{Boolean(isActive) && (
				<motion.span
					className="absolute inset-0 rounded-full bg-background shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10"
					layoutId="active-nav-pill"
					transition={{ damping: 30, stiffness: 380, type: "spring" }}
				/>
			)}

			{/* Active bottom indicator line */}
			{Boolean(isActive) && (
				<motion.span
					className="absolute right-3 bottom-1 left-3 h-0.5 rounded-full bg-primary"
					layoutId="active-nav-underline"
					transition={{ damping: 30, stiffness: 380, type: "spring" }}
				/>
			)}

			{/* Hover highlight */}
			{Boolean(isHovered && !isActive) && (
				<motion.span
					className="absolute inset-0 rounded-full bg-background/50 dark:bg-muted"
					layoutId="hover-nav-pill"
					transition={{ damping: 35, stiffness: 400, type: "spring" }}
				/>
			)}

			<span
				className={cn("relative z-10 block whitespace-nowrap text-sm", {
					"font-semibold text-foreground": isActive,
					"text-muted-foreground hover:text-foreground": !isActive,
				})}
			>
				{tab.label}
			</span>
		</Link>
	);
}

export function DesktopTabs({ tabs }: { tabs: Tab[] }) {
	const { location } = useRouterState();
	const { pathname } = location;
	const activeIndex = tabs.findIndex((tab) => isTabActive(pathname, tab));
	const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

	const handleLeave = React.useCallback(() => {
		setHoveredIndex(null);
	}, []);

	const handleHover = React.useCallback((index: number) => {
		setHoveredIndex(index);
	}, []);

	return (
		<nav
			aria-label="Main dashboard navigation"
			className="relative hidden shrink-0 items-center justify-center rounded-full bg-muted/70 p-1 ring-1 ring-foreground/5 md:flex dark:ring-foreground/10"
			onPointerLeave={handleLeave}
		>
			{tabs.map((tab, i) => (
				<DesktopTabItem
					index={i}
					isActive={activeIndex === i}
					isHovered={hoveredIndex === i}
					key={tab.value}
					onHover={handleHover}
					tab={tab}
				/>
			))}
		</nav>
	);
}

// ─── AnimatedTabs ─────────────────────────────────────────────────────────────

export function AnimatedTabs({ tabs }: AnimatedTabsProps) {
	return (
		<div className="relative flex w-full items-center justify-center">
			<DesktopTabs tabs={tabs} />
			<MobileNav tabs={tabs} />
		</div>
	);
}
