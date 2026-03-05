import type React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageHeaderAction {
	disabled?: boolean;
	href?: string;
	icon?: React.ReactNode;
	label: React.ReactNode;
	onClick?: () => void;
	variant?: "primary" | "secondary" | "ghost";
}

interface PageHeaderProps {
	/** One primary action, or an array for multiple buttons */
	action?: PageHeaderAction | PageHeaderAction[];
	/** Extra content rendered inline with the buttons (e.g. a status badge) */
	aside?: React.ReactNode;
	className?: string;
	description?: string;
	title: string;
}

// ─── Button ───────────────────────────────────────────────────────────────────

function ActionButton({ action }: { action: PageHeaderAction }) {
	const base =
		"inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";

	const variants: Record<NonNullable<PageHeaderAction["variant"]>, string> = {
		primary:
			"bg-foreground text-background shadow-sm hover:opacity-90 active:scale-[.98] focus-visible:ring-foreground",
		secondary:
			"border border-border bg-background text-foreground shadow-sm hover:bg-muted active:scale-[.98] focus-visible:ring-foreground",
		ghost:
			"text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[.98] focus-visible:ring-foreground",
	};

	const className = `${base} ${variants[action.variant ?? "primary"]}`;

	if (action.href) {
		return (
			<a className={className} href={action.href}>
				{action.icon}
				{action.label}
			</a>
		);
	}

	return (
		<button
			className={className}
			disabled={action.disabled}
			onClick={action.onClick}
			type="button"
		>
			{action.icon}
			{action.label}
		</button>
	);
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
	title,
	description,
	action,
	aside,
	className = "",
}: PageHeaderProps) {
	// biome-ignore lint/style/noNestedTernary: <nested to work with perfect action declaration>
	const actions = action ? (Array.isArray(action) ? action : [action]) : [];

	return (
		<header
			className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
		>
			{/* ── Text ── */}
			<div className="min-w-0 flex-1">
				<h1
					className="truncate font-semibold text-2xl text-foreground tracking-tight"
					style={{ fontFamily: "'Space Grotesk', sans-serif" }}
				>
					{title}
				</h1>
				{description && (
					<p className="mt-1 max-w-prose text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				)}
			</div>

			{/* ── Actions ── */}
			{(actions.length > 0 || aside) && (
				<div className="flex shrink-0 items-center gap-2 sm:mt-0.5">
					{aside}
					{actions.map((a, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static action list
						<ActionButton action={a} key={i} />
					))}
				</div>
			)}
		</header>
	);
}
