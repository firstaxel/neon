"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, type Transition } from "motion/react";
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

const transition = {
	type: "tween",
	ease: "easeOut",
	duration: 0.15,
};

const getHoverProps = (hoveredRect: DOMRect, navRect: DOMRect) => ({
	x: hoveredRect.left - navRect.left - 10,
	y: hoveredRect.top - navRect.top - 4,
	width: hoveredRect.width + 20,
	height: hoveredRect.height + 10,
});

/**
 * Determine whether a tab is "active" for the current pathname.
 *
 * Rules (evaluated in order — first match wins):
 *  1. Exact match on href — always active.
 *  2. href is "/" or "/dashboard" — only active on exact match (avoids
 *     matching every route that starts with "/").
 *  3. Any explicitly listed subRoute matches the current path exactly.
 *  4. pathname starts with href + "/" — catches /campaigns/create,
 *     /campaigns/123, etc. without activating /contacts for /contacts-import.
 */
function isTabActive(pathname: string, tab: Tab): boolean {
	// 1. Exact match
	if (pathname === tab.href) {
		return true;
	}

	// 2. Root-ish routes — don't use prefix matching
	if (tab.href === "/" || tab.href === "/dashboard") {
		return false;
	}

	// 3. Explicit sub-routes declared on the tab
	if (
		tab.subRoutes?.some((r) => pathname === r || pathname.startsWith(`${r}/`))
	) {
		return true;
	}

	// 4. Prefix match — pathname must start with href + "/" to avoid
	//    /campaigns matching /campaigns-old or /campaignsXYZ
	return pathname.startsWith(`${tab.href}/`);
}

// ─── Inner Tabs ───────────────────────────────────────────────────────────────

function Tabs({ tabs }: { tabs: Tab[] }) {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	// Derive active index purely from the URL — no state needed
	const activeIndex = tabs.findIndex((tab) => isTabActive(pathname, tab));

	// Ref array for measuring DOM rects
	const [linkRefs, setLinkRefs] = React.useState<
		Array<HTMLAnchorElement | null>
	>([]);
	React.useEffect(() => {
		setLinkRefs((prev) => prev.slice(0, tabs.length));
	}, [tabs.length]);

	const navRef = React.useRef<HTMLDivElement>(null);
	const navRect = navRef.current?.getBoundingClientRect();

	const selectedRect = linkRefs[activeIndex]?.getBoundingClientRect();

	const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
	const hoveredRect = linkRefs[hoveredIndex ?? -1]?.getBoundingClientRect();

	const dangerIndex = tabs.findIndex(({ value }) => value === "danger-zone");

	return (
		<nav
			className="relative flex shrink-0 items-center justify-center py-2"
			onPointerLeave={() => setHoveredIndex(null)}
			ref={navRef}
		>
			{tabs.map((tab, i) => {
				const isActive = activeIndex === i;
				const isDanger = tab.value === "danger-zone";

				return (
					<Link
						className="relative z-20 flex h-8 cursor-pointer select-none items-center rounded-md bg-transparent px-4 transition-colors"
						key={tab.value}
						onFocus={() => setHoveredIndex(i)}
						onPointerEnter={() => setHoveredIndex(i)}
						to={tab.href}
					>
						<motion.span
							className={cn("block text-sm", {
								"text-zinc-500 dark:text-zinc-400": !isActive,
								"font-semibold text-black dark:text-white": isActive,
							})}
							ref={(el) => {
								linkRefs[i] = el as HTMLAnchorElement;
							}}
						>
							<span className={isDanger ? "text-red-500" : ""}>
								{tab.label}
							</span>
						</motion.span>
					</Link>
				);
			})}

			{/* Hover background pill */}
			<AnimatePresence>
				{hoveredRect && navRect && (
					<motion.div
						animate={{ ...getHoverProps(hoveredRect, navRect), opacity: 1 }}
						className={cn(
							"absolute top-0 left-0 z-10 rounded-md",
							hoveredIndex === dangerIndex
								? "bg-red-100 dark:bg-red-500/30"
								: "bg-zinc-100 dark:bg-zinc-800"
						)}
						exit={{ ...getHoverProps(hoveredRect, navRect), opacity: 0 }}
						initial={{ ...getHoverProps(hoveredRect, navRect), opacity: 0 }}
						key="hover"
						transition={transition as Transition<Record<string, unknown>>}
					/>
				)}
			</AnimatePresence>

			{/* Active underline */}
			<AnimatePresence>
				{selectedRect && navRect && (
					<motion.div
						animate={{
							width: selectedRect.width + 18,
							x: `calc(${selectedRect.left - navRect.left - 9}px)`,
							opacity: 1,
						}}
						className={cn(
							"absolute bottom-0 left-0 z-10 h-0.5",
							activeIndex === dangerIndex
								? "bg-red-500"
								: "bg-black dark:bg-white"
						)}
						initial={false}
						key="underline"
						transition={transition as Transition<Record<string, unknown>>}
					/>
				)}
			</AnimatePresence>
		</nav>
	);
}

// ─── AnimatedTabs ─────────────────────────────────────────────────────────────

export function AnimatedTabs({ tabs }: AnimatedTabsProps) {
	return (
		<div className="relative flex w-full items-start justify-start overflow-x-auto overflow-y-hidden">
			<Tabs tabs={tabs} />
		</div>
	);
}
