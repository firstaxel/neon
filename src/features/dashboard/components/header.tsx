import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import React from "react";
import { ModeToggle } from "./mode-toggle";
import { AnimatedTabs } from "./tabs";
import { UserMenu } from "./user-menu";

// ─── Logo / Wordmark ──────────────────────────────────────────────────────────

function Logo() {
	return (
		<svg
			className="size-5"
			fill="none"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<title>MessageDesk</title>
			{/* WhatsApp-ish message icon tinted with primary green */}
			<path
				className="fill-primary"
				d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.05 21.95a.5.5 0 00.6.6l4.782-1.388A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
			/>
			<path
				d="M8 11.5h8M8 14.5h5"
				stroke="white"
				strokeLinecap="round"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
	"/dashboard": "Dashboard",
	"/campaigns": "Campaigns",
	"/contacts": "Contacts",
	"/messages": "Messages",
	"/templates": "Templates",
	"/billing": "Billing",
	"/settings": "Settings",
	"/onboarding": "Onboarding",
};

function Breadcrumb() {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	// Find the best matching label (longest prefix match)
	const label =
		ROUTE_LABELS[pathname] ??
		Object.entries(ROUTE_LABELS)
			.filter(([route]) => pathname.startsWith(`${route}/`))
			.sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
		"MessageDesk";

	return (
		<div className="flex min-w-0 items-center gap-1.5 font-mono text-sm">
			<span className="shrink-0 text-muted-foreground">/</span>
			<span className="truncate font-medium text-foreground">{label}</span>
		</div>
	);
}

// ─── Header Actions ───────────────────────────────────────────────────────────

function HeaderActions() {
	return (
		<div className="flex shrink-0 items-center gap-2">
			<UserMenu />
			<ModeToggle />
		</div>
	);
}

// ─── Nav Tabs Config ──────────────────────────────────────────────────────────

const TABS = [
	{ label: "Home", value: "home", href: "/dashboard" },
	{ label: "Campaigns", value: "campaigns", href: "/campaigns" },
	{ label: "Contacts", value: "contacts", href: "/contacts" },
	{ label: "Messages", value: "messages", href: "/messages" },
	{ label: "Templates", value: "templates", href: "/templates" },
	{ label: "Billing", value: "billing", href: "/billing" },
] as const;

// ─── AnimatedHeader ───────────────────────────────────────────────────────────

export default function AnimatedHeader() {
	const [scrollY, setScrollY] = React.useState(0);

	React.useEffect(() => {
		const handleScroll = () => setScrollY(window.scrollY);
		// Passive listener for performance
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Clamp scroll-driven values so they don't go wild
	const logoScale = Math.max(0.75, 1 - scrollY * 0.006);
	// On mobile we skip the horizontal shift (feels odd on small screens)
	const tabsShiftX = Math.min(scrollY * 0.5, 40);

	return (
		<nav className="w-full overflow-hidden">
			{/* ── Top bar ── */}
			<header className="relative w-full bg-background">
				{/* Logo — fixed, shrinks on scroll */}
				<motion.div
					animate={{ scale: logoScale }}
					className="fixed top-0 left-0 z-50 origin-top-left pl-5"
					transition={{ duration: 0.1, ease: "linear" }}
				>
					<Link
						aria-label="MessageDesk home"
						className="flex items-center gap-2 py-3"
						to="/dashboard"
					>
						<Logo />
					</Link>
				</motion.div>

				{/* Top bar content */}
				<div className="flex items-center justify-between px-4 pt-3 pb-0 pl-14 sm:pl-14">
					{/* Breadcrumb — hidden on very small screens if needed */}
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<Breadcrumb />
					</div>

					<HeaderActions />
				</div>
			</header>

			{/* ── Sticky nav bar ── */}
			<div className="sticky top-0 z-40 border-border border-b bg-background/95 backdrop-blur-sm">
				<div className="flex items-center justify-center">
					{/* Desktop: animate position on scroll. Mobile: no shift. */}
					<motion.div
						animate={{
							// Only shift on md+ — but motion doesn't know breakpoints,
							// so we gate it via CSS (the inner DesktopTabs is hidden on mobile)
							x: tabsShiftX,
						}}
						className="hidden flex-1 justify-center md:flex"
						transition={{ duration: 0.05, ease: "linear" }}
					>
						<AnimatedTabs tabs={[...TABS]} />
					</motion.div>

					{/* Mobile nav — no scroll-shift, full width */}
					<div className="flex w-full md:hidden">
						<AnimatedTabs tabs={[...TABS]} />
					</div>
				</div>
			</div>
		</nav>
	);
}
