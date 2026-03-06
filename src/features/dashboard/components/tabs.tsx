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

function isTabActive(pathname: string, tab: Tab): boolean {
	if (pathname === tab.href) {
		return true;
	}
	if (tab.href === "/" || tab.href === "/dashboard") {
		return false;
	}
	if (
		tab.subRoutes?.some((r) => pathname === r || pathname.startsWith(`${r}/`))
	) {
		return true;
	}
	return pathname.startsWith(`${tab.href}/`);
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

function MobileNav({ tabs }: { tabs: Tab[] }) {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;
	const [open, setOpen] = React.useState(false);

	const activeTab = tabs.find((tab) => isTabActive(pathname, tab));

	return (
		<div className="relative w-full md:hidden">
			<button
				aria-expanded={open}
				className="flex w-full items-center justify-between px-4 py-2 font-medium text-sm"
				onClick={() => setOpen((v) => !v)}
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
				{open && (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden border-border border-t bg-background"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
					>
						<div className="flex flex-col py-1">
							{tabs.map((tab) => {
								const isActive = isTabActive(pathname, tab);
								return (
									<Link
										className={cn(
											"px-4 py-2.5 text-sm transition-colors",
											isActive
												? "bg-muted/50 font-semibold text-foreground"
												: "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
										)}
										key={tab.value}
										onClick={() => setOpen(false)}
										to={tab.href}
									>
										{tab.label}
										{isActive && (
											<span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
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

function DesktopTabs({ tabs }: { tabs: Tab[] }) {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	const activeIndex = tabs.findIndex((tab) => isTabActive(pathname, tab));

	const [linkRefs, setLinkRefs] = React.useState<Array<HTMLElement | null>>([]);
	React.useEffect(() => {
		setLinkRefs((prev) => {
			const next = [...prev];
			next.length = tabs.length;
			return next;
		});
	}, [tabs.length]);

	const navRef = React.useRef<HTMLDivElement>(null);
	const navRect = navRef.current?.getBoundingClientRect();
	const selectedRect = linkRefs[activeIndex]?.getBoundingClientRect();

	const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
	const hoveredRect = linkRefs[hoveredIndex ?? -1]?.getBoundingClientRect();

	return (
		<nav
			className="relative hidden shrink-0 items-center justify-center py-2 md:flex"
			onPointerLeave={() => setHoveredIndex(null)}
			ref={navRef}
		>
			{tabs.map((tab, i) => {
				const isActive = activeIndex === i;

				return (
					<Link
						className="relative z-20 flex h-8 cursor-pointer select-none items-center rounded-md bg-transparent px-4 transition-colors"
						key={tab.value}
						onFocus={() => setHoveredIndex(i)}
						onPointerEnter={() => setHoveredIndex(i)}
						to={tab.href}
					>
						<motion.span
							className={cn("block whitespace-nowrap text-sm", {
								"text-muted-foreground": !isActive,
								"font-semibold text-foreground": isActive,
							})}
							ref={(el) => {
								linkRefs[i] = el;
							}}
						>
							{tab.label}
						</motion.span>
					</Link>
				);
			})}

			{/* Hover background pill */}
			<AnimatePresence>
				{hoveredRect && navRect && (
					<motion.div
						animate={{ ...getHoverProps(hoveredRect, navRect), opacity: 1 }}
						className="absolute top-0 left-0 z-10 rounded-md bg-muted"
						exit={{ ...getHoverProps(hoveredRect, navRect), opacity: 0 }}
						initial={{ ...getHoverProps(hoveredRect, navRect), opacity: 0 }}
						key="hover"
						transition={transition as Transition}
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
						className="absolute bottom-0 left-0 z-10 h-0.5 bg-primary"
						initial={false}
						key="underline"
						transition={transition as Transition}
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
			<DesktopTabs tabs={tabs} />
			<MobileNav tabs={tabs} />
		</div>
	);
}
