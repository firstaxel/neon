/**
 * src/routes/index.tsx — Velocast public landing page
 *
 * - Zero inline styles. Pure Tailwind + CSS custom properties from styles.css.
 * - No JS responsive hooks — pure CSS breakpoints (sm/md/lg).
 * - No FontLoader component — fonts & keyframes live in styles.css.
 * - No flash: background/foreground driven by CSS variables toggled by
 *   ThemeProvider's synchronous <ScriptOnce> before first paint.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Bell,
	BookOpen,
	Building2,
	Camera,
	CheckCircle2,
	FileText,
	Mail,
	Menu,
	MessageCircle,
	Send,
	ShieldCheck,
	Sparkles,
	Star,
	Users,
	Wallet,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ModeToggle } from "#/features/dashboard/components/mode-toggle";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => ({ meta: [pageHeadMeta.home] }),
});

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
	return <div className="h-px bg-[var(--lp-border-sub)]" />;
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex items-center gap-[7px] rounded-full border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] px-[14px] py-[5px]">
			<span className="relative h-[6px] w-[6px] shrink-0">
				<span className="lp-blink absolute inset-0 rounded-full bg-[var(--lp-accent)]" />
				<span className="lp-pulse-ring absolute -inset-[2px] rounded-full border border-[var(--lp-accent)]" />
			</span>
			<span className="font-[family-name:var(--lp-font-mono)] font-semibold text-[10px] text-[var(--lp-accent)] uppercase tracking-[0.14em]">
				{children}
			</span>
		</span>
	);
}

// ─── App chrome ───────────────────────────────────────────────────────────────

function AppChrome({
	children,
	url = "app.velocast.io",
}: {
	children: React.ReactNode;
	url?: string;
}) {
	return (
		<div className="overflow-hidden rounded-4xl border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-xl ring-1 ring-black/5 dark:ring-white/10">
			<div className="flex h-[38px] items-center gap-[6px] border-[var(--lp-border-sub)] border-b bg-[var(--lp-app-bg)] px-[14px]">
				{["#ef4444", "#f59e0b", "#10b981"].map((c) => (
					<div
						className="h-[9px] w-[9px] rounded-full opacity-60"
						key={c}
						style={{ background: c }}
					/>
				))}
				<div className="ml-[10px] flex h-5 flex-1 items-center rounded-[5px] bg-black/5 pl-[10px] dark:bg-white/[0.04]">
					<span className="font-[family-name:var(--lp-font-mono)] text-[9.5px] text-[var(--lp-text-dim)]">
						{url}
					</span>
				</div>
			</div>
			{children}
		</div>
	);
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

// ─── Logo mark ────────────────────────────────────────────────────────────────

function LogoMark({ size = 32 }: { size?: number }) {
	return (
		<div
			className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--lp-accent)] text-white shadow-xs"
			style={{
				height: size,
				width: size,
			}}
		>
			<svg
				fill="none"
				height={Math.round(size * 0.53)}
				viewBox="0 0 24 24"
				width={Math.round(size * 0.53)}
			>
				<title>Velocast</title>
				<path
					d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.03-1.3A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
					fill="white"
				/>
				<path
					d="M8 11h8M8 14.5h5"
					stroke="rgba(37,211,102,0.85)"
					strokeLinecap="round"
					strokeWidth="1.7"
				/>
			</svg>
		</div>
	);
}

// ─── Hero Showcase: Paper Roster to WhatsApp Dispatch ─────────────────────────

interface RosterContact {
	confidence: string;
	id: string;
	name: string;
	phone: string;
	status: string;
	tag: string;
}

const HERO_CONTACTS: RosterContact[] = [
	{
		confidence: "99.8%",
		id: "1",
		name: "Sarah Chen",
		phone: "+234 803 456 7890",
		status: "Normalized +234",
		tag: "First-Timer",
	},
	{
		confidence: "99.2%",
		id: "2",
		name: "Marcus Okafor",
		phone: "+234 701 234 5678",
		status: "Normalized +234",
		tag: "Worker",
	},
	{
		confidence: "99.5%",
		id: "3",
		name: "Priya Nwosu",
		phone: "+234 815 678 9012",
		status: "Normalized +234",
		tag: "Youth",
	},
	{
		confidence: "98.9%",
		id: "4",
		name: "James Eze",
		phone: "+234 803 901 2345",
		status: "Normalized +234",
		tag: "Choir",
	},
];

function RosterItem({
	contact,
	isSelected,
	onSelect,
}: {
	contact: RosterContact;
	isSelected: boolean;
	onSelect: (id: string) => void;
}) {
	const handleClick = useCallback(() => {
		onSelect(contact.id);
	}, [contact.id, onSelect]);

	return (
		<button
			className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-150 ${
				isSelected
					? "border-[var(--lp-accent)] bg-[var(--lp-accent-lo)] shadow-xs"
					: "border-[var(--lp-border-sub)] bg-[var(--lp-card-hi)] hover:border-[var(--lp-border)]"
			}`}
			onClick={handleClick}
			type="button"
		>
			<div className="flex min-w-0 items-center gap-2.5">
				<div
					className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-[family-name:var(--lp-font-mono)] font-bold text-xs ${
						isSelected
							? "bg-[var(--lp-accent)] text-white"
							: "bg-black/5 text-[var(--lp-text-sub)] dark:bg-white/10"
					}`}
				>
					{contact.id}
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-1.5">
						<p className="truncate font-[family-name:var(--lp-font-body)] font-semibold text-[var(--lp-text)] text-xs">
							{contact.name}
						</p>
						<span className="rounded bg-black/5 px-1.5 py-0.2 font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-text-sub)] dark:bg-white/10">
							{contact.tag}
						</span>
					</div>
					<p className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
						{contact.phone}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-1 text-right">
				<span className="rounded-full border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.12)] px-1.5 py-0.5 font-[family-name:var(--lp-font-mono)] font-semibold text-[9px] text-[var(--lp-green)]">
					✓ {contact.confidence}
				</span>
			</div>
		</button>
	);
}

function RosterPane({
	contacts,
	selectedId,
	onSelect,
}: {
	contacts: RosterContact[];
	selectedId: string;
	onSelect: (id: string) => void;
}) {
	return (
		<div className="border-[var(--lp-border-sub)] border-b p-4 lg:border-r lg:border-b-0">
			<div className="mb-3 flex items-center justify-between border-[var(--lp-border-sub)] border-b pb-3">
				<div className="flex items-center gap-2">
					<Camera className="text-[var(--lp-accent)]" size={14} />
					<p className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)] uppercase tracking-wider">
						Paper Roster · Faith City Assembly
					</p>
				</div>
				<span className="rounded-full border border-[rgba(99,102,241,0.25)] bg-[var(--lp-accent-lo)] px-2 py-[2px] font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-accent)]">
					Gemini 1.5 Flash · 1.2s
				</span>
			</div>

			<div className="flex flex-col gap-2">
				{contacts.map((c) => (
					<RosterItem
						contact={c}
						isSelected={c.id === selectedId}
						key={c.id}
						onSelect={onSelect}
					/>
				))}
			</div>

			<div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--lp-border-sub)] bg-black/[0.02] px-3 py-2 dark:bg-white/[0.02]">
				<div className="flex items-center gap-1.5 font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
					<Sparkles className="text-[var(--lp-accent)]" size={12} />
					<span>4 contacts parsed with 0 manual typing</span>
				</div>
				<span className="font-[family-name:var(--lp-font-mono)] font-semibold text-[9px] text-[var(--lp-green)]">
					● Valid Nigerian Lines
				</span>
			</div>
		</div>
	);
}

function DispatchPane({ selectedContact }: { selectedContact: RosterContact }) {
	const [firstName] = selectedContact.name.split(" ");
	return (
		<div className="flex flex-col justify-between p-4">
			<div>
				<div className="mb-3 flex items-center justify-between border-[var(--lp-border-sub)] border-b pb-3">
					<div className="flex items-center gap-2">
						<Send className="text-[var(--lp-accent)]" size={14} />
						<p className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)] uppercase tracking-wider">
							Tactile Dispatch Console
						</p>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="rounded-full border border-[rgba(37,211,102,0.3)] bg-[rgba(37,211,102,0.1)] px-2 py-[2px] font-[family-name:var(--lp-font-mono)] font-semibold text-[9px] text-[var(--lp-green)]">
							● WhatsApp Live
						</span>
						<span className="rounded-full border border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.1)] px-2 py-[2px] font-[family-name:var(--lp-font-mono)] font-semibold text-[#60a5fa] text-[9px]">
							● SMS Backup
						</span>
					</div>
				</div>

				{/* WhatsApp message bubble */}
				<div className="rounded-xl border border-[rgba(37,211,102,0.25)] bg-[rgba(37,211,102,0.04)] p-3.5">
					<div className="mb-1.5 flex items-center justify-between">
						<span className="font-[family-name:var(--lp-font-mono)] font-semibold text-[9.5px] text-[var(--lp-green)]">
							WhatsApp Template · Sunday Welcome
						</span>
						<span className="font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-text-dim)]">
							To: {selectedContact.name} ({selectedContact.phone})
						</span>
					</div>
					<p className="font-[family-name:var(--lp-font-body)] text-[13px] text-[var(--lp-text)] leading-[1.6]">
						Good afternoon{" "}
						<span className="rounded-md border border-[rgba(37,211,102,0.3)] bg-[rgba(37,211,102,0.12)] px-1.5 py-0.5 font-bold text-[var(--lp-green)]">
							{firstName}
						</span>
						! 👋 Thank you for worshiping with us at Faith City today. Join us
						this Wednesday at 6 PM for Midweek Communion Service. Reply YES to
						stay connected!
					</p>
					<div className="mt-2 flex items-center justify-between text-[10px]">
						<span className="font-[family-name:var(--lp-font-mono)] text-[var(--lp-text-dim)]">
							14:02
						</span>
						<span className="font-[family-name:var(--lp-font-mono)] font-semibold text-[var(--lp-green)]">
							✓✓ Delivered &amp; Read
						</span>
					</div>
				</div>

				{/* Paystack Wallet Debit Breakdown */}
				<div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[var(--lp-border-sub)] bg-[var(--lp-card-hi)] p-2.5 text-center">
					<div>
						<p className="font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-text-dim)] uppercase">
							Unit Cost
						</p>
						<p className="font-[family-name:var(--lp-font-mono)] font-bold text-[var(--lp-text)] text-xs">
							₦8.00 / msg
						</p>
					</div>
					<div>
						<p className="font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-text-dim)] uppercase">
							Total Debit
						</p>
						<p className="font-[family-name:var(--lp-font-mono)] font-bold text-[var(--lp-accent)] text-xs">
							₦32.00
						</p>
					</div>
					<div>
						<p className="font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-text-dim)] uppercase">
							Paystack Reserve
						</p>
						<p className="font-[family-name:var(--lp-font-mono)] font-bold text-[var(--lp-green)] text-xs">
							₦24,968.00
						</p>
					</div>
				</div>
			</div>

			{/* Delivery status */}
			<div className="mt-3 border-[var(--lp-border-sub)] border-t pt-3">
				<div className="mb-1.5 flex items-center justify-between">
					<span className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
						Carrier Dispatch Progress (MTN, Airtel, Glo)
					</span>
					<span className="font-[family-name:var(--lp-font-mono)] font-bold text-[10px] text-[var(--lp-green)]">
						4 / 4 Delivered (100%)
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
					<div className="h-full w-full rounded-full bg-[var(--lp-green)] transition-all duration-500" />
				</div>
			</div>
		</div>
	);
}

function HeroShowcase() {
	const [selectedId, setSelectedId] = useState("1");
	const [activeTab, setActiveTab] = useState<"scan" | "dispatch">("scan");

	const selectedContact =
		HERO_CONTACTS.find((c) => c.id === selectedId) ?? HERO_CONTACTS[0];

	const handleSelectContact = useCallback((id: string) => {
		setSelectedId(id);
	}, []);

	const handleSelectAndSwitch = useCallback((id: string) => {
		setSelectedId(id);
		setActiveTab("dispatch");
	}, []);

	const setScanTab = useCallback(() => setActiveTab("scan"), []);
	const setDispatchTab = useCallback(() => setActiveTab("dispatch"), []);

	return (
		<div className="relative">
			{/* Mobile / Tablet Tab Switcher */}
			<div className="mb-3 flex justify-center lg:hidden">
				<div className="inline-flex rounded-full border border-[var(--lp-border)] bg-[var(--lp-card)] p-1">
					<button
						className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 font-[family-name:var(--lp-font-mono)] font-semibold text-xs transition-all ${
							activeTab === "scan"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-[var(--lp-text-sub)] hover:text-[var(--lp-text)]"
						}`}
						onClick={setScanTab}
						type="button"
					>
						<Camera size={13} />
						<span>1. Paper Roster Scan</span>
					</button>
					<button
						className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 font-[family-name:var(--lp-font-mono)] font-semibold text-xs transition-all ${
							activeTab === "dispatch"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-[var(--lp-text-sub)] hover:text-[var(--lp-text)]"
						}`}
						onClick={setDispatchTab}
						type="button"
					>
						<Send size={13} />
						<span>2. WhatsApp Dispatch</span>
					</button>
				</div>
			</div>

			<AppChrome url="app.velocast.io/console">
				{/* Desktop: side-by-side grid */}
				<div className="hidden min-h-[380px] grid-cols-2 lg:grid">
					<RosterPane
						contacts={HERO_CONTACTS}
						onSelect={handleSelectContact}
						selectedId={selectedId}
					/>
					<DispatchPane selectedContact={selectedContact} />
				</div>

				{/* Mobile / Tablet: tabbed view */}
				<div className="min-h-[360px] lg:hidden">
					{activeTab === "scan" ? (
						<RosterPane
							contacts={HERO_CONTACTS}
							onSelect={handleSelectAndSwitch}
							selectedId={selectedId}
						/>
					) : (
						<DispatchPane selectedContact={selectedContact} />
					)}
				</div>
			</AppChrome>
		</div>
	);
}

// ─── Counter ──────────────────────────────────────────────────────────────────

function Counter({
	end,
	prefix = "",
	suffix = "",
	label,
}: {
	end: number;
	prefix?: string;
	suffix?: string;
	label: string;
}) {
	const [v, setV] = useState(0);
	useEffect(() => {
		let s = 0;
		const step = end / 52;
		const t = setInterval(() => {
			s += step;
			if (s >= end) {
				setV(end);
				clearInterval(t);
			} else {
				setV(Math.floor(s));
			}
		}, 26);
		return () => clearInterval(t);
	}, [end]);
	return (
		<div className="text-center">
			<p className="font-[family-name:var(--lp-font-mono)] font-bold text-2xl text-[var(--lp-accent)] tabular-nums leading-none tracking-tight md:text-3xl">
				{prefix}
				{v.toLocaleString()}
				{suffix}
			</p>
			<p className="mt-1.5 font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-xs">
				{label}
			</p>
		</div>
	);
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const fn = () => setScrolled(window.scrollY > 16);
		window.addEventListener("scroll", fn);
		return () => window.removeEventListener("scroll", fn);
	}, []);

	useEffect(() => {
		const fn = () => {
			if (window.innerWidth >= 768) {
				setOpen(false);
			}
		};
		window.addEventListener("resize", fn);
		return () => window.removeEventListener("resize", fn);
	}, []);

	const toggleOpen = useCallback(() => setOpen((o) => !o), []);
	const closeMenu = useCallback(() => setOpen(false), []);

	return (
		<header
			className={`sticky top-0 z-[100] transition-all duration-300 ${
				scrolled
					? "border-[var(--lp-border)] border-b bg-[var(--lp-nav-bg)] backdrop-blur-[22px]"
					: "border-transparent border-b bg-transparent"
			}`}
		>
			<div className="mx-auto flex h-[60px] max-w-[1160px] items-center justify-between gap-4 px-5">
				{/* Logo */}
				<div className="flex shrink-0 items-center gap-[10px]">
					<LogoMark size={32} />
					<span className="font-[family-name:var(--lp-font-display)] font-extrabold text-[var(--lp-text)] text-lg tracking-[-0.04em]">
						Velo<span className="text-[var(--lp-accent)]">cast</span>
					</span>
				</div>

				{/* Desktop nav */}
				<nav className="hidden items-center gap-7 md:flex">
					{[
						["Features", "#features"],
						["How it works", "#how-it-works"],
						["Pricing", "#pricing"],
					].map(([l, h]) => (
						<a
							className="font-[family-name:var(--lp-font-body)] font-medium text-[var(--lp-text-sub)] text-sm transition-colors duration-150 hover:text-[var(--lp-text)]"
							href={h}
							key={l}
						>
							{l}
						</a>
					))}
				</nav>

				{/* Desktop CTA */}
				<div className="hidden items-center gap-2 md:flex">
					<ModeToggle />
					<Link
						className="rounded-4xl px-4 py-[7px] font-[family-name:var(--lp-font-body)] font-semibold text-[var(--lp-text-sub)] text-sm transition-colors duration-150 hover:text-[var(--lp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)]"
						to="/login"
					>
						Sign in
					</Link>
					<Link
						className="rounded-4xl bg-primary px-5 py-[9px] font-[family-name:var(--lp-font-body)] font-semibold text-primary-foreground text-sm shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px"
						to="/register"
					>
						Get started →
					</Link>
				</div>

				{/* Mobile controls */}
				<div className="flex items-center gap-2 md:hidden">
					<ModeToggle />
					<button
						aria-label="Toggle navigation menu"
						className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] text-[var(--lp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)]"
						onClick={toggleOpen}
						type="button"
					>
						{open ? <X size={16} /> : <Menu size={16} />}
					</button>
				</div>
			</div>

			{/* Mobile menu */}
			{open ? (
				<div className="flex flex-col gap-1 border-[var(--lp-border)] border-b bg-[var(--lp-mob-bg)] px-5 pt-4 pb-[22px] backdrop-blur-[22px] md:hidden">
					{[
						["Features", "#features"],
						["How it works", "#how-it-works"],
						["Pricing", "#pricing"],
					].map(([l, h]) => (
						<a
							className="block px-1 py-[10px] font-[family-name:var(--lp-font-body)] font-medium text-[var(--lp-text)] text-base"
							href={h}
							key={l}
							onClick={closeMenu}
						>
							{l}
						</a>
					))}
					<div className="mt-2 flex gap-[10px] border-[var(--lp-border)] border-t pt-[14px]">
						<Link
							className="flex-1 rounded-4xl border border-[var(--lp-border)] py-[11px] text-center font-[family-name:var(--lp-font-body)] font-semibold text-[var(--lp-text)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)]"
							onClick={closeMenu}
							to="/login"
						>
							Sign in
						</Link>
						<Link
							className="flex-1 rounded-4xl bg-primary py-[11px] text-center font-[family-name:var(--lp-font-body)] font-semibold text-primary-foreground text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px"
							onClick={closeMenu}
							to="/register"
						>
							Get started
						</Link>
					</div>
				</div>
			) : null}
		</header>
	);
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
	return (
		<section className="relative overflow-hidden pt-9 md:pt-20">
			<div className="relative mx-auto max-w-[1160px] px-5">
				{/* Headline block */}
				<div className="lp-fu mx-auto max-w-[800px] pb-8 text-center md:pb-14">
					<Tag>WhatsApp &amp; SMS · Prepaid in Naira (₦)</Tag>
					<h1 className="mt-6 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(36px,10vw,52px)] text-[var(--lp-text)] leading-[1.0] tracking-[-0.04em] sm:text-[clamp(40px,8vw,60px)] md:text-[clamp(60px,7.5vw,96px)]">
						Turn paper rosters into
						<br />
						<span className="text-[var(--lp-accent)]">instant broadcasts.</span>
					</h1>
					<p className="mx-auto mt-5 max-w-[560px] font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-base leading-relaxed md:text-lg">
						Snap a photo of any handwritten attendance sheet or paper register.
						Gemini AI extracts contacts in seconds — dispatch personalized
						WhatsApp and SMS broadcasts with prepaid Naira wallet billing.
					</p>
					<div className="lp-fu2 mt-8 flex flex-wrap items-center justify-center gap-3">
						<Link
							className="inline-flex w-full items-center justify-center gap-2 rounded-4xl bg-primary px-8 py-3.5 font-[family-name:var(--lp-font-body)] font-semibold text-base text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px sm:w-auto"
							to="/register"
						>
							Start free <ArrowRight size={16} />
						</Link>
						<Link
							className="inline-flex w-full items-center justify-center gap-2 rounded-4xl border border-[var(--lp-border-sub)] bg-black/[0.04] px-6 py-3.5 font-[family-name:var(--lp-font-body)] font-medium text-[var(--lp-text-sub)] text-sm transition-colors duration-150 hover:text-[var(--lp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px sm:w-auto dark:bg-white/[0.04]"
							to="/login"
						>
							Sign in →
						</Link>
					</div>
				</div>

				{/* Stats */}
				<div className="lp-fu2 mx-auto mb-12 grid max-w-[320px] grid-cols-2 gap-x-3 gap-y-4 md:max-w-none md:grid-cols-4 md:gap-16">
					<Counter end={48_291} label="messages dispatched" />
					<Counter end={2847} label="contacts in rosters" />
					<Counter end={134} label="broadcasts completed" />
					<Counter end={4} label="per SMS (all networks)" prefix="₦" />
				</div>

				{/* Product showcase — responsive and visible on all devices */}
				<div className="lp-fu3 relative">
					<HeroShowcase />
				</div>
			</div>
		</section>
	);
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
	const badges = [
		"WhatsApp Cloud API",
		"Secured by Paystack",
		"Gemini AI Roster Vision",
		"Direct Routes: MTN · Airtel · Glo · 9mobile",
	];

	return (
		<section className="px-5 pt-8 pb-10">
			<div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-center gap-3">
				{badges.map((badge) => (
					<span
						className="rounded-full border border-[var(--lp-border-sub)] bg-[var(--lp-card)] px-3.5 py-1 font-[family-name:var(--lp-font-mono)] font-medium text-[var(--lp-text-sub)] text-xs shadow-xs"
						key={badge}
					>
						{badge}
					</span>
				))}
			</div>
		</section>
	);
}

// ─── Problem ──────────────────────────────────────────────────────────────────

function Problem() {
	return (
		<section className="px-5 py-12 md:py-20">
			<Divider />
			<div className="mx-auto grid max-w-[1160px] grid-cols-1 items-center gap-9 pt-10 md:grid-cols-2 md:gap-[88px] md:pt-20">
				<div>
					<h2 className="font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(26px,7vw,42px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:text-[clamp(30px,3.8vw,52px)]">
						Your community lives on WhatsApp. Stop losing announcements in the
						noise.
					</h2>
				</div>
				<div className="flex flex-col gap-6">
					{[
						{
							body: "Under 20% of emails get opened in Nigeria. WhatsApp delivers a 98% open rate directly in your members' hands.",
							icon: <Mail className="text-[var(--lp-accent)]" size={20} />,
							title: "Email gets ignored",
						},
						{
							body: "Sign-in sheets and handwritten registers pile up because typing phone numbers by hand takes hours.",
							icon: <FileText className="text-[var(--lp-accent)]" size={20} />,
							title: "Paper rosters trap contacts",
						},
						{
							body: "Carrier DND filters and invalid phone numbers drain your wallet without delivery verification.",
							icon: (
								<ShieldCheck className="text-[var(--lp-accent)]" size={20} />
							),
							title: "Unverified SMS wastes money",
						},
					].map((p) => (
						<div className="flex items-start gap-[18px]" key={p.title}>
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] text-xl">
								{p.icon}
							</div>
							<div>
								<p className="mb-1 font-[family-name:var(--lp-font-display)] font-bold text-[var(--lp-text)] text-base tracking-[-0.02em]">
									{p.title}
								</p>
								<p className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm leading-relaxed">
									{p.body}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

// ─── Features ─────────────────────────────────────────────────────────────────

function FeatureRow({
	headline,
	desc,
	bullets,
	mockup,
	flip = false,
}: {
	headline: string;
	desc: string;
	bullets: string[];
	mockup: React.ReactNode;
	flip?: boolean;
}) {
	return (
		<div
			className={`grid grid-cols-1 items-center gap-7 py-10 md:grid-cols-2 md:gap-[72px] md:py-20 ${flip ? "md:[&>*:first-child]:order-2 md:[&>*:last-child]:order-1" : ""}`}
		>
			<div>
				<h3 className="mb-4 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(22px,5.5vw,34px)] text-[var(--lp-text)] leading-[1.08] tracking-[-0.04em] md:text-[clamp(24px,2.8vw,42px)]">
					{headline}
				</h3>
				<p className="mb-[22px] font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm leading-relaxed">
					{desc}
				</p>
				<div className="flex flex-col gap-[11px]">
					{bullets.map((b) => (
						<div className="flex items-start gap-[11px]" key={b}>
							<CheckCircle2
								className="mt-[1px] shrink-0"
								color="var(--lp-accent)"
								size={15}
							/>
							<span className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm">
								{b}
							</span>
						</div>
					))}
				</div>
			</div>
			<div className="mx-auto w-full max-w-[480px] md:max-w-none">{mockup}</div>
		</div>
	);
}

function MockupCampaign() {
	return (
		<AppChrome url="app.velocast.io/campaigns/create">
			<div className="p-5">
				<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
					NEW BROADCAST · Step 2 of 4
				</p>
				<div className="mb-4 grid grid-cols-1 xs:grid-cols-2 gap-2">
					{[
						{
							active: true,
							icon: <Users className="text-[var(--lp-accent)]" size={14} />,
							label: "Sunday Welcome",
						},
						{
							active: false,
							icon: (
								<BookOpen className="text-[var(--lp-text-sub)]" size={14} />
							),
							label: "School Notice",
						},
						{
							active: false,
							icon: (
								<Building2 className="text-[var(--lp-text-sub)]" size={14} />
							),
							label: "Estate Dues",
						},
						{
							active: false,
							icon: <Bell className="text-[var(--lp-text-sub)]" size={14} />,
							label: "Announcement",
						},
					].map((s) => (
						<div
							className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${s.active ? "border-[var(--lp-border)] bg-[var(--lp-accent-lo)]" : "border-[var(--lp-border-sub)] bg-transparent"}`}
							key={s.label}
						>
							{s.icon}
							<span
								className={`font-[family-name:var(--lp-font-body)] text-xs ${s.active ? "font-bold text-[var(--lp-accent)]" : "text-[var(--lp-text-sub)]"}`}
							>
								{s.label}
							</span>
						</div>
					))}
				</div>
				<div className="rounded-xl border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] p-3.5">
					<p className="mb-1 font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-accent)]">
						PREVIEW · WhatsApp
					</p>
					<p className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text)] text-xs leading-relaxed">
						Hi{" "}
						<span className="rounded-md border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] px-1.5 py-0.5 font-semibold text-[var(--lp-accent)]">
							Sarah
						</span>
						! 👋 Thank you for worshiping with us at Faith City today. Join us
						this Wednesday at 6 PM for Midweek Communion Service.
					</p>
				</div>
				<div className="mt-3 flex items-center justify-between">
					<span className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-xs">
						350 recipients selected
					</span>
					<div className="inline-flex items-center gap-1.5 rounded-4xl bg-primary px-4 py-2 text-primary-foreground shadow-xs">
						<Send size={12} />
						<span className="font-[family-name:var(--lp-font-body)] font-semibold text-xs">
							Dispatch broadcast
						</span>
					</div>
				</div>
			</div>
		</AppChrome>
	);
}

function MockupImport() {
	const [step, setStep] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setStep((s) => (s + 1) % 3), 2400);
		return () => clearInterval(t);
	}, []);
	const contacts = [
		{ ch: "WhatsApp", name: "Sarah Chen", phone: "+234 803 456 7890" },
		{ ch: "SMS", name: "Marcus Okafor", phone: "+234 701 234 5678" },
		{ ch: "WhatsApp", name: "Priya Nwosu", phone: "+234 815 678 9012" },
		{ ch: "WhatsApp", name: "James Eze", phone: "+234 803 901 2345" },
	];
	return (
		<AppChrome url="app.velocast.io/contacts/import">
			<div className="p-5">
				<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
					AI IMPORT ·{" "}
					{step === 0
						? "Uploading…"
						: step === 1
							? "Parsing with Gemini AI…"
							: "✓ 4 contacts found"}
				</p>
				<div className="mb-4 h-[3px] rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
					<div
						className="h-full rounded-full bg-[var(--lp-accent)] transition-[width] duration-[0.9s]"
						style={{ width: `${step === 0 ? 28 : step === 1 ? 70 : 100}%` }}
					/>
				</div>
				{step === 2 ? (
					<div className="flex flex-col gap-[7px]">
						{contacts.map((c) => (
							<div
								className="flex items-center gap-[11px] rounded-lg border border-[var(--lp-border-sub)] bg-[var(--lp-card-hi)] p-[8px_11px]"
								key={c.name}
							>
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-accent-lo)]">
									<span className="font-[family-name:var(--lp-font-body)] font-extrabold text-[11px] text-[var(--lp-accent)]">
										{c.name[0]}
									</span>
								</div>
								<div className="min-w-0 flex-1">
									<p className="font-[family-name:var(--lp-font-body)] font-semibold text-[12.5px] text-[var(--lp-text)]">
										{c.name}
									</p>
									<p className="font-[family-name:var(--lp-font-mono)] text-[9.5px] text-[var(--lp-text-sub)]">
										{c.phone}
									</p>
								</div>
								<span
									className={`shrink-0 rounded-[5px] px-[7px] py-[2px] font-[family-name:var(--lp-font-mono)] text-[9px] ${
										c.ch === "WhatsApp"
											? "border border-[rgba(37,211,102,0.3)] bg-[rgba(37,211,102,0.1)] text-[var(--lp-green)]"
											: "border border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]"
									}`}
								>
									{c.ch}
								</span>
							</div>
						))}
					</div>
				) : (
					<div className="flex flex-col gap-[7px]">
						{[1, 2, 3, 4].map((i) => (
							<div
								className="h-10 animate-pulse rounded-lg border border-[var(--lp-border-sub)] bg-[var(--lp-card-hi)]"
								key={i}
							/>
						))}
					</div>
				)}
			</div>
		</AppChrome>
	);
}

function MockupConsent() {
	return (
		<AppChrome url="app.velocast.io/campaigns/prescreen">
			<div className="p-5">
				<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
					CONSENT FLOW · Prescreen mode
				</p>
				<div className="flex flex-col gap-2">
					{[
						{
							color: "var(--lp-amber)",
							done: true,
							label: "1. Consent message sent",
							note: "₦8 × 500 = ₦4,000",
						},
						{
							color: "var(--lp-green)",
							done: true,
							label: "2. Replies collected",
							note: "312 / 500 replied",
						},
						{
							color: "var(--lp-accent)",
							done: true,
							label: "3. Full campaign sent",
							note: "₦90 × 312 = ₦28,080",
						},
						{
							color: "var(--lp-text-sub)",
							done: false,
							label: "4. 188 contacts skipped",
							note: "Saved ₦16,920",
						},
					].map((s) => (
						<div
							className="flex items-center gap-[13px] rounded-[9px] p-[9px_12px]"
							key={s.label}
							style={{
								background: s.done ? `${s.color}09` : "transparent",
								border: `1px solid ${s.done ? `${s.color}28` : "var(--lp-border-sub)"}`,
							}}
						>
							<div
								className="h-[7px] w-[7px] shrink-0 rounded-full"
								style={{ background: s.color }}
							/>
							<div className="flex-1">
								<p
									className="font-[family-name:var(--lp-font-body)] font-semibold text-[12.5px]"
									style={{
										color: s.done ? "var(--lp-text)" : "var(--lp-text-sub)",
									}}
								>
									{s.label}
								</p>
							</div>
							<span
								className="font-[family-name:var(--lp-font-mono)] text-[10px]"
								style={{ color: s.color }}
							>
								{s.note}
							</span>
						</div>
					))}
				</div>
				<div className="mt-[14px] flex justify-between rounded-[9px] border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] p-[10px_14px]">
					<span className="font-[family-name:var(--lp-font-body)] text-[13px] text-[var(--lp-text)]">
						Total spend
					</span>
					<span className="font-[family-name:var(--lp-font-mono)] font-bold text-[15px] text-[var(--lp-accent)]">
						₦32,080
					</span>
				</div>
				<p className="mt-[7px] text-center font-[family-name:var(--lp-font-body)] text-[11.5px] text-[var(--lp-text-sub)]">
					vs ₦45,000 direct — saved{" "}
					<strong className="text-[var(--lp-green)]">29%</strong>
				</p>
			</div>
		</AppChrome>
	);
}

function Features() {
	return (
		<section
			className="mx-auto max-w-[1160px] px-5 pb-6 md:pb-10"
			id="features"
		>
			<Divider />
			<div className="mb-4 pt-12 text-center md:pt-20">
				<h2 className="font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(26px,7vw,42px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:text-[clamp(30px,4.2vw,56px)]">
					Built for how African organizations communicate.
				</h2>
			</div>
			<FeatureRow
				bullets={[
					"Auto-personalized with member names",
					"WhatsApp + SMS in one unified broadcast",
					"Real-time carrier delivery receipts",
				]}
				desc="Compose your message once. Velocast personalizes each broadcast with member names and routes via WhatsApp and SMS."
				headline="Send to thousands. Every message lands personally."
				mockup={<MockupCampaign />}
			/>
			<Divider />
			<FeatureRow
				bullets={[
					"Accepts phone camera photos (.jpg, .png) and PDFs",
					"Transcribes handwritten and printed paper lists",
					"Auto-formats Nigerian numbers (+234)",
				]}
				desc="Photograph physical attendance sheets or upload a spreadsheet. Gemini AI extracts names and numbers in seconds."
				flip
				headline="Snap a photo of a paper roster. Contacts appear."
				mockup={<MockupImport />}
			/>
			<Divider />
			<FeatureRow
				bullets={[
					"Pre-send verification check at ₦8 vs full blast rate",
					"Dispatches full message only to contacts who reply YES",
					"Protects your sender reputation and carrier deliverability",
				]}
				desc="Send a low-cost consent check first. Only confirmed contacts receive the full broadcast, keeping waste near zero."
				headline="Cut broadcast spend by up to 40%."
				mockup={<MockupConsent />}
			/>
		</section>
	);
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
	const steps = [
		{
			body: "Photograph your paper attendance sheet or upload an Excel file.",
			icon: <Camera color="var(--lp-accent)" size={20} />,
			n: "01",
			title: "Snap roster",
		},
		{
			body: "Choose WhatsApp or SMS, personalized with member names.",
			icon: <Sparkles color="var(--lp-accent)" size={20} />,
			n: "02",
			title: "Compose",
		},
		{
			body: "Top up via Paystack in Naira. Zero recurring fees.",
			icon: <Wallet color="var(--lp-accent)" size={20} />,
			n: "03",
			title: "Fund wallet",
		},
		{
			body: "Track live carrier receipts and reply to incoming messages.",
			icon: <MessageCircle color="var(--lp-accent)" size={20} />,
			n: "04",
			title: "Dispatch",
		},
	];
	return (
		<section className="px-5 py-12 md:py-20" id="how-it-works">
			<Divider />
			<div className="mx-auto max-w-[1160px] pt-10 md:pt-20">
				<h2 className="mb-8 max-w-[540px] font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(24px,7vw,40px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:mb-14 md:text-[clamp(30px,4.2vw,54px)]">
					From paper roster to broadcast in 4 steps.
				</h2>
				<div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
					{steps.map((s) => (
						<div key={s.n}>
							<p
								aria-hidden
								className="mb-[-16px] select-none font-[family-name:var(--lp-font-display)] font-extrabold text-7xl text-[var(--lp-accent)]/10 leading-none tracking-[-0.07em] md:text-8xl"
							>
								{s.n}
							</p>
							<div className="rounded-4xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10">
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-accent-lo)]">
									{s.icon}
								</div>
								<p className="mb-2 font-[family-name:var(--lp-font-display)] font-extrabold text-[var(--lp-text)] text-base tracking-tight">
									{s.title}
								</p>
								<p className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm leading-relaxed">
									{s.body}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

interface WalletTier {
	badge: string | null;
	cta: string;
	ctaTo: string;
	deposit: number;
	depositLabel: string;
	desc: string;
	features: string[];
	highlight: boolean;
	name: string;
}

function WalletCard({ tier }: { tier: WalletTier }) {
	return (
		<div
			className={`relative rounded-4xl p-7 ring-1 transition-all ${
				tier.highlight
					? "border-2 border-[var(--lp-accent)] bg-[var(--lp-card)] shadow-lg ring-[var(--lp-accent)]/20"
					: "border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-sm ring-black/5 dark:ring-white/10"
			}`}
		>
			{tier.badge ? (
				<div className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3.5 py-1 font-[family-name:var(--lp-font-mono)] font-bold text-[10px] text-primary-foreground uppercase tracking-widest shadow-xs">
					{tier.badge}
				</div>
			) : null}
			<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[var(--lp-text)] text-xl tracking-tight">
				{tier.name}
			</p>
			<p className="mt-1 mb-5 font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm">
				{tier.desc}
			</p>
			<div className="mb-1.5 flex items-baseline gap-1">
				<span
					className={`font-[family-name:var(--lp-font-display)] font-extrabold text-4xl leading-none tracking-tight ${
						tier.highlight ? "text-[var(--lp-accent)]" : "text-[var(--lp-text)]"
					}`}
				>
					₦{tier.deposit.toLocaleString()}
				</span>
			</div>
			<p className="mb-5 font-[family-name:var(--lp-font-mono)] text-[var(--lp-text-dim)] text-xs">
				{tier.depositLabel}
			</p>
			<div className="mb-5 h-px bg-[var(--lp-border-sub)]" />
			<div className="mb-6 flex flex-col gap-2.5">
				{tier.features.map((f) => (
					<div className="flex items-start gap-2.5" key={f}>
						<CheckCircle2
							className="mt-0.5 shrink-0"
							color={tier.highlight ? "var(--lp-accent)" : "var(--lp-green)"}
							size={14}
						/>
						<span className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm">
							{f}
						</span>
					</div>
				))}
			</div>
			<Link
				className={`block rounded-4xl py-3 text-center font-[family-name:var(--lp-font-body)] font-semibold text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px ${
					tier.highlight
						? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
						: "border border-[var(--lp-border-sub)] bg-black/[0.04] text-[var(--lp-text)] hover:bg-black/[0.07] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
				}`}
				to={tier.ctaTo}
			>
				{tier.cta}
			</Link>
		</div>
	);
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
	const walletTiers = [
		{
			badge: null,
			cta: "Fund & Start Sending",
			ctaTo: "/register",
			deposit: 5000,
			depositLabel: "One-time Paystack top-up",
			desc: "Ideal for weekly fellowships, local clinics, and small clubs",
			features: [
				"~1,250 SMS or ~625 WhatsApp messages",
				"AI paper roster photo scanning",
				"Live carrier tracking & two-way inbox",
				"Balance never expires",
			],
			highlight: false,
			name: "Starter Deposit",
		},
		{
			badge: "Most popular",
			cta: "Fund & Start Sending",
			ctaTo: "/register",
			deposit: 25_000,
			depositLabel: "One-time Paystack top-up",
			desc: "For growing churches, schools, and estate associations",
			features: [
				"~6,250 SMS or ~3,125 WhatsApp messages",
				"WhatsApp template broadcasts",
				"Automated consent flow with reply tracking",
				"Multi-user team access",
			],
			highlight: true,
			name: "Organization Deposit",
		},
		{
			badge: null,
			cta: "Fund & Start Sending",
			ctaTo: "/register",
			deposit: 100_000,
			depositLabel: "One-time Paystack top-up",
			desc: "For universities, multi-branch ministries, and corporate campaigns",
			features: [
				"~25,000 SMS or high-volume WhatsApp",
				"Dedicated sender ID registration assistance",
				"Priority carrier routing",
				"Dedicated account support",
			],
			highlight: false,
			name: "High-Volume Deposit",
		},
	];

	const perMessage = [
		{
			ch: "📱 Direct SMS (MTN, Airtel, Glo, 9mobile)",
			cost: "₦4.00",
			note: "Per 160-character SMS, all Nigerian networks",
		},
		{
			ch: "🔔 WhatsApp Utility & Consent",
			cost: "₦8.00",
			note: "Pre-broadcast verification check",
		},
		{
			ch: "💬 WhatsApp Marketing Broadcast",
			cost: "₦75.00",
			note: "Approved Meta template broadcast",
		},
		{
			ch: "📥 Inbound Replies & Two-Way Inbox",
			cost: "Free",
			note: "Unlimited member replies in your inbox",
		},
		{
			ch: "📷 Gemini AI Paper Roster Scanning",
			cost: "Free",
			note: "Extract contacts from photos & PDFs",
		},
	];

	return (
		<section className="px-5 py-12 md:py-20" id="pricing">
			<Divider />
			<div className="mx-auto max-w-[1160px] pt-10 md:pt-20">
				<div className="mb-9 flex flex-col items-center gap-3 text-center md:mb-[48px]">
					<h2 className="font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(24px,7vw,40px)] text-[var(--lp-text)] leading-[1.02] tracking-tight md:text-[clamp(30px,4.2vw,56px)]">
						Pay-as-you-go in Naira. Zero monthly subscriptions.
					</h2>
					<p className="max-w-[520px] font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-base">
						Fund your prepaid wallet via Paystack. Your balance never expires,
						and you only pay for messages that actually dispatch.
					</p>
				</div>

				<div className="mb-[72px] grid grid-cols-1 gap-[22px] md:grid-cols-3">
					{walletTiers.map((p) => (
						<WalletCard key={p.name} tier={p} />
					))}
				</div>

				<div className="rounded-4xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-6 shadow-md ring-1 ring-black/5 md:p-8 dark:ring-white/10">
					<div className="mb-6 flex flex-wrap items-start justify-between gap-3.5">
						<div>
							<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[var(--lp-text)] text-xl tracking-tight">
								Exact per-message rates (deducted in kobo)
							</p>
							<p className="mt-1 font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-sm">
								Top up via Paystack card or bank transfer. Spend only when you
								dispatch.
							</p>
						</div>
						<Tag>No subscription fees</Tag>
					</div>
					<div className="overflow-hidden rounded-3xl border border-[var(--lp-border-sub)]">
						{perMessage.map((r, i) => (
							<div
								className={`flex items-center justify-between border-[var(--lp-border-sub)] border-b p-[14px_18px] last:border-b-0 ${
									i % 2 === 0 ? "bg-transparent" : "bg-[var(--lp-accent-lo)]/30"
								}`}
								key={r.ch}
							>
								<div>
									<p className="font-[family-name:var(--lp-font-body)] font-semibold text-[var(--lp-text)] text-sm">
										{r.ch}
									</p>
									<p className="mt-0.5 font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-xs">
										{r.note}
									</p>
								</div>
								<p
									className={`font-[family-name:var(--lp-font-mono)] font-bold text-xl ${
										r.cost === "Free"
											? "text-[var(--lp-green)]"
											: "text-[var(--lp-accent)]"
									}`}
								>
									{r.cost}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
	const quotes = [
		{
			name: "Pastor Emmanuel O.",
			org: "Faith City Assembly, Lagos",
			quote:
				"We snap our handwritten Sunday first-timers list right after service. In 90 seconds, 300 personalized WhatsApp welcomes are queued and delivered.",
			role: "Lead Pastor",
		},
		{
			name: "Mrs. Folake A.",
			org: "Greenwood Academy, Ibadan",
			quote:
				"Parents never miss exam timetables or fee notices. We only pay for delivered messages, keeping school expenses minimal.",
			role: "School Administrator",
		},
		{
			name: "Babatunde O.",
			org: "Lekki Residents Association",
			quote:
				"Sending monthly facility dues notices to 650 residents used to take hours. Velocast delivers in seconds with instant confirmation.",
			role: "General Secretary",
		},
	];
	return (
		<section className="px-5 py-12 md:py-20">
			<Divider />
			<div className="mx-auto max-w-[1160px] pt-10 md:pt-20">
				<h2 className="mb-8 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(24px,7vw,40px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:mb-12 md:text-[clamp(30px,4.2vw,52px)]">
					Trusted by community leaders across Nigeria.
				</h2>
				<div className="grid grid-cols-1 gap-[22px] md:grid-cols-3">
					{quotes.map((q) => (
						<div
							className="flex flex-col gap-4 rounded-4xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-7 shadow-md ring-1 ring-black/5 dark:ring-white/10"
							key={q.name}
						>
							<div className="flex gap-0.5">
								{[1, 2, 3, 4, 5].map((s) => (
									<Star
										color="var(--lp-amber)"
										fill="var(--lp-amber)"
										key={s}
										size={13}
									/>
								))}
							</div>
							<p className="flex-1 font-[family-name:var(--lp-font-body)] text-[var(--lp-text)] text-sm leading-relaxed tracking-normal">
								"{q.quote}"
							</p>
							<div className="border-[var(--lp-border-sub)] border-t pt-4">
								<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[var(--lp-text)] text-sm tracking-tight">
									{q.name}
								</p>
								<p className="mt-0.5 font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-xs">
									{q.role} · {q.org}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
	return (
		<section className="px-5 py-12 pb-20 md:py-20 md:pb-[110px]">
			<div className="mx-auto max-w-[1160px]">
				<div className="relative overflow-hidden rounded-4xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-10 text-center shadow-lg ring-1 ring-black/5 md:p-24 dark:ring-white/10">
					<div className="relative">
						<h2 className="mt-2 mb-4 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(28px,8.5vw,50px)] text-[var(--lp-text)] leading-[1.0] tracking-tight sm:text-[clamp(32px,7vw,56px)] md:text-[clamp(40px,5.5vw,74px)]">
							Your community is waiting
							<br />
							to hear from you.
						</h2>
						<p className="mx-auto mb-9 max-w-[480px] font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-base">
							Snap your paper roster, fund your prepaid wallet with Paystack,
							and dispatch in minutes.
						</p>
						<div className="flex flex-wrap justify-center gap-3.5">
							<Link
								className="inline-flex w-full items-center justify-center gap-2 rounded-4xl bg-primary px-8 py-3.5 font-[family-name:var(--lp-font-body)] font-semibold text-base text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px sm:w-auto"
								to="/register"
							>
								Create free account <ArrowRight size={17} />
							</Link>
							<Link
								className="inline-flex w-full items-center justify-center rounded-4xl border border-[var(--lp-border-sub)] bg-black/[0.04] px-6 py-3.5 font-[family-name:var(--lp-font-body)] font-medium text-[var(--lp-text-sub)] text-sm transition-colors duration-150 hover:text-[var(--lp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] active:translate-y-px sm:w-auto dark:bg-white/[0.04]"
								to="/login"
							>
								Sign in
							</Link>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
	return (
		<footer className="relative overflow-hidden border-[var(--lp-border-sub)] border-t px-5 pt-10 pb-8 md:pt-[52px] md:pb-11">
			<p
				aria-hidden
				className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(64px,14vw,200px)] text-[rgba(99,102,241,0.04)] leading-none tracking-tight dark:text-[rgba(99,102,241,0.03)]"
			>
				Velocast
			</p>
			<div className="relative mx-auto max-w-[1160px]">
				<div className="mb-8 flex flex-wrap items-start justify-between gap-7 md:mb-11 md:gap-9">
					<div className="max-w-[280px]">
						<div className="mb-3 flex items-center gap-2.5">
							<LogoMark size={28} />
							<span className="font-[family-name:var(--lp-font-display)] font-extrabold text-[var(--lp-text)] text-base tracking-tight">
								Velo<span className="text-[var(--lp-accent)]">cast</span>
							</span>
						</div>
						<p className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-sub)] text-xs leading-relaxed">
							WhatsApp and SMS broadcast console built for Nigerian
							organizations, churches, schools, and businesses.
						</p>
					</div>
					<div className="flex flex-wrap gap-7 md:gap-[60px]">
						{[
							{
								heading: "Product",
								links: [
									{ href: "#features", label: "Features" },
									{ href: "#how-it-works", label: "How it works" },
									{ href: "#pricing", label: "Pricing" },
									{ href: "/register", label: "Get started" },
								],
							},
							{
								heading: "Organization",
								links: [
									{ href: "/register", label: "Churches & NGOs" },
									{ href: "/register", label: "Schools & Academies" },
									{ href: "/register", label: "Estates" },
									{ href: "/login", label: "Console Login" },
								],
							},
							{
								heading: "Legal",
								links: [
									{ href: "/privacy", label: "Privacy Policy" },
									{ href: "/terms", label: "Terms of Service" },
									{ href: "#pricing", label: "Carrier Guidelines" },
								],
							},
						].map((col) => (
							<div key={col.heading}>
								<p className="mb-3.5 font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)] uppercase tracking-wider">
									{col.heading}
								</p>
								<div className="flex flex-col gap-2">
									{col.links.map((l) => (
										<a
											className="font-[family-name:var(--lp-font-body)] text-[var(--lp-text-dim)] text-xs transition-colors duration-150 hover:text-[var(--lp-text)]"
											href={l.href}
											key={l.label}
										>
											{l.label}
										</a>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
				<Divider />
				<div className="flex flex-wrap items-center justify-between gap-2.5 pt-4">
					<p className="font-[family-name:var(--lp-font-mono)] text-[var(--lp-text-dim)] text-xs">
						© 2025 Velocast. Built for African organizations.
					</p>
					<div className="flex flex-wrap gap-3.5">
						{["WhatsApp", "SMS", "AI Roster Scanning", "Prepaid Wallet"].map(
							(t) => (
								<span
									className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-dim)]"
									key={t}
								>
									{t}
								</span>
							)
						)}
					</div>
				</div>
			</div>
		</footer>
	);
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function LandingPage() {
	return (
		<div className="min-h-screen w-full bg-[var(--lp-bg)] font-[family-name:var(--lp-font-body)] text-[var(--lp-text)]">
			<Navbar />
			<Hero />
			<TrustBar />
			<Problem />
			<Features />
			<HowItWorks />
			<Pricing />
			<Testimonials />
			<CTA />
			<Footer />
		</div>
	);
}
