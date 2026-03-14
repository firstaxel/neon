/**
 * src/routes/index.tsx — MessageDesk public landing page
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
	CheckCircle2,
	MessageCircle,
	Send,
	Sparkles,
	Star,
	Users,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ModeToggle } from "#/features/dashboard/components/mode-toggle";
import { pageHeadMeta } from "#/lib/metadata";
import { useTheme } from "#/providers/theme";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => ({ meta: [pageHeadMeta.home] }),
});

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
	return (
		<div className="h-px bg-gradient-to-r from-transparent via-[var(--lp-border)] to-transparent" />
	);
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

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
	return (
		<p className="mb-3 font-[family-name:var(--lp-font-mono)] font-semibold text-[10px] text-[var(--lp-accent)] uppercase tracking-[0.18em]">
			↗ {children}
		</p>
	);
}

// ─── App chrome ───────────────────────────────────────────────────────────────

function AppChrome({
	children,
	url = "app.messagedesk.io",
}: {
	children: React.ReactNode;
	url?: string;
}) {
	return (
		<div className="overflow-hidden rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-[0_32px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(99,102,241,0.06)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(99,102,241,0.06)]">
			<div className="flex h-[38px] items-center gap-[6px] border-[var(--lp-border-sub)] border-b bg-[var(--lp-app-bg)] px-[14px]">
				{["#ef4444", "#f59e0b", "#10b981"].map((c, i) => (
					<div
						className="h-[9px] w-[9px] rounded-full opacity-60"
						key={i}
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
			className="flex shrink-0 items-center justify-center rounded-[31%] bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)]"
			style={{
				width: size,
				height: size,
				boxShadow: "0 0 20px var(--lp-glow)",
			}}
		>
			<svg
				fill="none"
				height={Math.round(size * 0.53)}
				viewBox="0 0 24 24"
				width={Math.round(size * 0.53)}
			>
				<title>MD</title>
				<path
					d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.03-1.3A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
					fill="white"
				/>
				<path
					d="M8 11h8M8 14.5h5"
					stroke="rgba(99,102,241,0.6)"
					strokeLinecap="round"
					strokeWidth="1.7"
				/>
			</svg>
		</div>
	);
}

// ─── Message stream ───────────────────────────────────────────────────────────

const MSGS = [
	{
		from: "📢 Campaign",
		text: "Hi Sarah! Your order #4821 has shipped and will arrive by Thursday.",
		side: "right" as const,
	},
	{
		from: "💬 Sarah",
		text: "Wow that was fast! Thanks for the update 🙌",
		side: "left" as const,
	},
	{
		from: "🔔 Consent",
		text: "Hi Marcus, TechCorp wants to send you exclusive offers. Reply YES to opt in.",
		side: "right" as const,
	},
	{ from: "💬 Marcus", text: "YES! Sounds good 👍", side: "left" as const },
	{
		from: "✨ Welcome",
		text: "Hi Priya! Welcome to the team. Your account is set up and ready to go.",
		side: "right" as const,
	},
	{
		from: "🔄 Follow-up",
		text: "Hi James — we noticed you haven't checked in lately. Need any help?",
		side: "right" as const,
	},
];

const RISE_DELAYS = [
	"lp-rise-d0",
	"lp-rise-d1",
	"lp-rise-d2",
	"lp-rise-d3",
	"lp-rise-d4",
	"lp-rise-d5",
] as const;

function MsgBubble({
	msg,
	delayClass,
}: {
	msg: (typeof MSGS)[0];
	delayClass: string;
}) {
	const r = msg.side === "right";
	return (
		<div
			className={`lp-rise ${delayClass} flex px-2 ${r ? "justify-end" : "justify-start"}`}
		>
			<div
				className={`max-w-[82%] border px-3 py-2 ${r ? "rounded-[13px_13px_3px_13px] border-[var(--lp-border)] bg-[var(--lp-accent-lo)]" : "rounded-[13px_13px_13px_3px] border-[var(--lp-border-sub)] bg-black/[0.03] dark:bg-white/[0.04]"}`}
			>
				<p
					className={`mb-[3px] font-[family-name:var(--lp-font-mono)] font-semibold text-[9px] ${r ? "text-[var(--lp-accent)]" : "text-[var(--lp-text-dim)]"}`}
				>
					{msg.from}
				</p>
				<p className="font-[family-name:var(--lp-font-body)] text-[12px] text-[var(--lp-text)] leading-[1.55]">
					{msg.text}
				</p>
				<div className="mt-[3px] flex justify-end">
					<span className="font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-text-dim)]">
						✓✓
					</span>
				</div>
			</div>
		</div>
	);
}

function MessageStream() {
	return (
		<div className="relative flex h-80 flex-col justify-end gap-[9px] overflow-hidden py-2">
			<div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[60px] bg-gradient-to-b from-[var(--lp-card)] to-transparent" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-10 bg-gradient-to-t from-[var(--lp-card)] to-transparent" />
			{MSGS.map((m, i) => (
				<MsgBubble delayClass={RISE_DELAYS[i]} key={i} msg={m} />
			))}
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
			<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[28px] text-[var(--lp-accent)] leading-none tracking-[-0.04em]">
				{prefix}
				{v.toLocaleString()}
				{suffix}
			</p>
			<p className="mt-[5px] font-[family-name:var(--lp-font-body)] text-[11.5px] text-[var(--lp-text-sub)]">
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
					<span className="font-[family-name:var(--lp-font-display)] font-extrabold text-[17px] text-[var(--lp-text)] tracking-[-0.04em]">
						Message<span className="text-[var(--lp-accent)]">Desk</span>
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
							className="font-[family-name:var(--lp-font-body)] font-medium text-[14px] text-[var(--lp-text-sub)] transition-colors duration-150 hover:text-[var(--lp-text)]"
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
						className="rounded-[9px] px-4 py-[7px] font-[family-name:var(--lp-font-body)] font-semibold text-[14px] text-[var(--lp-text-sub)] transition-colors duration-150 hover:text-[var(--lp-text)]"
						to="/login"
					>
						Sign in
					</Link>
					<Link
						className="rounded-[10px] bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] px-5 py-[9px] font-[family-name:var(--lp-font-body)] font-bold text-[14px] text-white shadow-[0_0_20px_var(--lp-glow)]"
						to="/register"
					>
						Get started →
					</Link>
				</div>

				{/* Mobile controls */}
				<div className="flex items-center gap-2 md:hidden">
					<ModeToggle />
					<button
						className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] text-[var(--lp-text)]"
						onClick={() => setOpen((o) => !o)}
						type="button"
					>
						{open ? (
							<X size={16} />
						) : (
							<span className="text-[17px] leading-none">☰</span>
						)}
					</button>
				</div>
			</div>

			{/* Mobile menu */}
			{open && (
				<div className="flex flex-col gap-1 border-[var(--lp-border)] border-b bg-[var(--lp-mob-bg)] px-5 pt-4 pb-[22px] backdrop-blur-[22px] md:hidden">
					{[
						["Features", "#features"],
						["How it works", "#how-it-works"],
						["Pricing", "#pricing"],
					].map(([l, h]) => (
						<a
							className="block px-1 py-[10px] font-[family-name:var(--lp-font-body)] font-medium text-[15px] text-[var(--lp-text)]"
							href={h}
							key={l}
							onClick={() => setOpen(false)}
						>
							{l}
						</a>
					))}
					<div className="mt-2 flex gap-[10px] border-[var(--lp-border)] border-t pt-[14px]">
						<Link
							className="flex-1 rounded-[10px] border border-[var(--lp-border)] py-[11px] text-center font-[family-name:var(--lp-font-body)] font-semibold text-[14px] text-[var(--lp-text)]"
							onClick={() => setOpen(false)}
							to="/login"
						>
							Sign in
						</Link>
						<Link
							className="flex-1 rounded-[10px] bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] py-[11px] text-center font-[family-name:var(--lp-font-body)] font-bold text-[14px] text-white"
							onClick={() => setOpen(false)}
							to="/register"
						>
							Get started
						</Link>
					</div>
				</div>
			)}
		</header>
	);
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
	return (
		<section className="relative overflow-hidden pt-9 md:pt-20">
			{/* Grid bg */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--lp-border-sub)_1px,transparent_1px),linear-gradient(90deg,var(--lp-border-sub)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_80%_55%_at_50%_0%,black_30%,transparent_100%)]"
			/>
			{/* Glow */}
			<div
				aria-hidden
				className="pointer-events-none absolute -top-[180px] left-1/2 h-[700px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.09)_0%,transparent_68%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.13)_0%,transparent_68%)]"
			/>

			<div className="relative mx-auto max-w-[1160px] px-5">
				{/* Headline block */}
				<div className="lp-fu mx-auto max-w-[900px] pb-8 text-center md:pb-14">
					<Tag>WhatsApp &amp; SMS · Nigerian pricing (₦)</Tag>
					<h1 className="mt-6 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(36px,10vw,52px)] text-[var(--lp-text)] leading-[1.0] tracking-[-0.04em] sm:text-[clamp(40px,8vw,60px)] md:text-[clamp(60px,7.5vw,100px)]">
						Reach your
						<br />
						<span className="bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">
							customers fast.
						</span>
						<br />
						<span className="font-bold text-[0.58em] text-[var(--lp-text-sub)] tracking-[-0.02em]">
							Both channels. One platform.
						</span>
					</h1>
					<p className="mx-auto mt-5 max-w-[540px] font-[family-name:var(--lp-font-body)] text-[15px] text-[var(--lp-text-sub)] leading-[1.7] md:text-[17.5px]">
						Send personalised WhatsApp campaigns and SMS blasts to your
						customers. AI contact import, pre-built templates, real-time
						delivery tracking.
					</p>
					<div className="lp-fu2 mt-8 flex flex-wrap items-center justify-center gap-3">
						<Link
							className="inline-flex w-full items-center justify-center gap-[9px] rounded-xl bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] px-[30px] py-[14px] font-[family-name:var(--lp-font-body)] font-bold text-[15.5px] text-white shadow-[0_0_32px_var(--lp-glow)] sm:w-auto"
							to="/register"
						>
							Start free <ArrowRight size={16} />
						</Link>
						<Link
							className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--lp-border-sub)] bg-black/[0.04] px-6 py-[14px] font-[family-name:var(--lp-font-body)] font-medium text-[14.5px] text-[var(--lp-text-sub)] sm:w-auto dark:bg-white/[0.04]"
							to="/login"
						>
							Sign in →
						</Link>
					</div>
					<p className="mt-4 font-[family-name:var(--lp-font-mono)] text-[11px] text-[var(--lp-text-dim)]">
						No credit card · Live in 5 minutes · Cancel anytime
					</p>
				</div>

				{/* Stats */}
				<div className="lp-fu2 mx-auto mb-12 grid max-w-[320px] grid-cols-2 gap-x-3 gap-y-4 md:max-w-none md:grid-cols-4 md:gap-16">
					<Counter end={48_291} label="messages sent" />
					<Counter end={2847} label="active contacts" />
					<Counter end={134} label="campaigns run" />
					<Counter end={6} label="per SMS" prefix="₦" />
				</div>

				{/* Product chrome — hidden on mobile */}
				<div className="lp-fu3 relative hidden md:block">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[200px] bg-gradient-to-t from-[var(--lp-bg)] via-[var(--lp-bg)]/30 to-transparent"
					/>
					<AppChrome>
						<div className="grid min-h-[360px] grid-cols-1 lg:grid-cols-2">
							<div className="border-[var(--lp-border-sub)] border-b px-2 py-4 lg:border-r lg:border-b-0">
								<div className="mb-2 flex items-center justify-between border-[var(--lp-border-sub)] border-b px-[14px] pb-3">
									<p className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
										INBOX · Live
									</p>
									<span className="rounded-full border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] px-2 py-[2px] font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-green)]">
										● Online
									</span>
								</div>
								<MessageStream />
							</div>
							<div className="hidden p-[16px_18px] lg:block">
								<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
									CAMPAIGNS · Recent
								</p>
								<div className="flex flex-col gap-2">
									{[
										{
											name: "New Customer Onboarding",
											ch: "WhatsApp",
											sent: 1204,
											pct: 100,
											done: true,
										},
										{
											name: "Product Launch Blast",
											ch: "SMS + WA",
											sent: 892,
											pct: 68,
											done: false,
										},
										{
											name: "Abandoned Cart Recovery",
											ch: "WhatsApp",
											sent: 346,
											pct: 100,
											done: true,
										},
										{
											name: "Weekly Newsletter",
											ch: "SMS",
											sent: 2841,
											pct: 55,
											done: false,
										},
									].map((c) => (
										<div
											className="rounded-[9px] border border-[var(--lp-border-sub)] bg-[var(--lp-card-hi)] p-[10px_12px]"
											key={c.name}
										>
											<div className="flex items-start justify-between">
												<div>
													<p className="font-[family-name:var(--lp-font-body)] font-semibold text-[12px] text-[var(--lp-text)]">
														{c.name}
													</p>
													<p className="mt-[2px] font-[family-name:var(--lp-font-mono)] text-[9.5px] text-[var(--lp-text-sub)]">
														{c.ch} · {c.sent.toLocaleString()} sent
													</p>
												</div>
												<div
													className={`rounded-full border px-2 py-[2px] ${c.done ? "border-[rgba(16,185,129,0.28)] bg-[rgba(16,185,129,0.1)]" : "border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.1)]"}`}
												>
													<span
														className={`font-[family-name:var(--lp-font-mono)] font-bold text-[9px] ${c.done ? "text-[var(--lp-green)]" : "text-[var(--lp-amber)]"}`}
													>
														{c.done ? "DONE" : "LIVE"}
													</span>
												</div>
											</div>
											<div className="mt-2 h-[3px] rounded-full bg-black/[0.06] dark:bg-white/[0.05]">
												<div
													className={`h-full rounded-full transition-[width] duration-[1.6s] ${c.done ? "bg-[var(--lp-green)]" : "bg-[var(--lp-amber)]"}`}
													style={{ width: `${c.pct}%` }}
												/>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</AppChrome>
				</div>
			</div>
		</section>
	);
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
	const brands = [
		"Paystack",
		"Flutterwave",
		"Kuda Bank",
		"PiggyVest",
		"Cowrywise",
		"Mono",
		"Paga",
		"TeamApt",
	];
	return (
		<section className="px-5 pt-11 pb-11 md:pt-14">
			<p className="mb-5 text-center font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-dim)] uppercase tracking-[0.18em]">
				Trusted by fast-growing teams across Nigeria
			</p>
			<div className="flex flex-wrap justify-center gap-x-7 gap-y-[10px]">
				{brands.map((b) => (
					<span
						className="font-[family-name:var(--lp-font-display)] font-bold text-[13.5px] text-[var(--lp-text-dim)] tracking-[-0.02em]"
						key={b}
					>
						{b}
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
					<SectionLabel>The Problem</SectionLabel>
					<h2 className="font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(26px,7vw,42px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:text-[clamp(30px,3.8vw,52px)]">
						Your customers are on WhatsApp. Your outreach is stuck in email.
					</h2>
				</div>
				<div className="flex flex-col gap-6">
					{[
						{
							icon: "📧",
							title: "Email open rates are dying",
							body: "Average business email: 21% open rate. WhatsApp: 98%. The gap only keeps growing.",
						},
						{
							icon: "🕐",
							title: "Manual messaging eats your day",
							body: "Copy-pasting numbers, maintaining spreadsheets, chasing replies — it's a chore, not a system.",
						},
						{
							icon: "💸",
							title: "Bulk SMS has no personalisation",
							body: "Generic blasts feel like spam. Every message needs to feel like it was written for that one person.",
						},
					].map((p) => (
						<div className="flex items-start gap-[18px]" key={p.title}>
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] text-xl">
								{p.icon}
							</div>
							<div>
								<p className="mb-[5px] font-[family-name:var(--lp-font-display)] font-bold text-[15px] text-[var(--lp-text)] tracking-[-0.02em]">
									{p.title}
								</p>
								<p className="font-[family-name:var(--lp-font-body)] text-[13.5px] text-[var(--lp-text-sub)] leading-[1.68]">
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
	eyebrow,
	headline,
	desc,
	bullets,
	mockup,
	flip = false,
}: {
	eyebrow: string;
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
				<SectionLabel>{eyebrow}</SectionLabel>
				<h3 className="mb-4 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(22px,5.5vw,34px)] text-[var(--lp-text)] leading-[1.08] tracking-[-0.04em] md:text-[clamp(24px,2.8vw,42px)]">
					{headline}
				</h3>
				<p className="mb-[22px] font-[family-name:var(--lp-font-body)] text-[14.5px] text-[var(--lp-text-sub)] leading-[1.78]">
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
							<span className="font-[family-name:var(--lp-font-body)] text-[14px] text-[var(--lp-text-sub)]">
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
		<AppChrome url="app.messagedesk.io/campaigns/create">
			<div className="p-5">
				<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
					NEW CAMPAIGN · Step 2 of 4
				</p>
				<div className="mb-4 grid grid-cols-1 xs:grid-cols-2 gap-2">
					{[
						{ icon: "🛒", label: "Abandoned Cart", active: true },
						{ icon: "🎉", label: "Product Launch", active: false },
						{ icon: "🔄", label: "Re-engagement", active: false },
						{ icon: "📢", label: "Announcement", active: false },
					].map((s) => (
						<div
							className={`flex items-center gap-[9px] rounded-[9px] border px-3 py-[10px] ${s.active ? "border-[var(--lp-border)] bg-[var(--lp-accent-lo)]" : "border-[var(--lp-border-sub)] bg-transparent"}`}
							key={s.label}
						>
							<span className="text-[14px]">{s.icon}</span>
							<span
								className={`font-[family-name:var(--lp-font-body)] text-[12px] ${s.active ? "font-bold text-[var(--lp-accent)]" : "text-[var(--lp-text-sub)]"}`}
							>
								{s.label}
							</span>
						</div>
					))}
				</div>
				<div className="rounded-[9px] border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] p-[12px_14px]">
					<p className="mb-[6px] font-[family-name:var(--lp-font-mono)] text-[9px] text-[var(--lp-accent)]">
						PREVIEW · WhatsApp
					</p>
					<p className="font-[family-name:var(--lp-font-body)] text-[12.5px] text-[var(--lp-text)] leading-[1.6]">
						Hi{" "}
						<span className="rounded-[4px] border border-[var(--lp-border)] bg-[var(--lp-accent-lo)] px-[5px] text-[var(--lp-accent)]">
							Sarah
						</span>
						! 🛒 You left something in your cart. Complete your order today and
						get 10% off with code <strong>COMEBACK</strong>.
					</p>
				</div>
				<div className="mt-3 flex items-center justify-between">
					<span className="font-[family-name:var(--lp-font-body)] text-[12px] text-[var(--lp-text-sub)]">
						1,240 recipients selected
					</span>
					<div className="inline-flex items-center gap-[6px] rounded-[9px] bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] px-[14px] py-[7px] shadow-[0_0_16px_var(--lp-glow)]">
						<Send color="#fff" size={12} />
						<span className="font-[family-name:var(--lp-font-body)] font-bold text-[12px] text-white">
							Send campaign
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
		{ name: "Sarah Chen", phone: "+234 803 456 7890", ch: "WhatsApp" },
		{ name: "Marcus Okafor", phone: "+234 701 234 5678", ch: "SMS" },
		{ name: "Priya Nwosu", phone: "+234 815 678 9012", ch: "WhatsApp" },
		{ name: "James Eze", phone: "+234 803 901 2345", ch: "WhatsApp" },
	];
	return (
		<AppChrome url="app.messagedesk.io/contacts/import">
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
						className="h-full rounded-full bg-gradient-to-r from-[var(--lp-accent)] to-[var(--lp-violet)] transition-[width] duration-[0.9s]"
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
									className={`shrink-0 rounded-[5px] px-[7px] py-[2px] font-[family-name:var(--lp-font-mono)] text-[9px] ${c.ch === "WhatsApp" ? "bg-[var(--lp-accent-lo)] text-[var(--lp-accent)]" : "bg-[var(--lp-violet-lo)] text-[var(--lp-violet)]"}`}
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
								className="lp-shimmer h-10 rounded-lg border border-[var(--lp-border-sub)]"
								key={i}
								style={{
									background:
										"linear-gradient(90deg,var(--lp-shimmer-a) 25%,var(--lp-shimmer-b) 50%,var(--lp-shimmer-a) 75%)",
									backgroundSize: "600px 100%",
								}}
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
		<AppChrome url="app.messagedesk.io/campaigns/prescreen">
			<div className="p-5">
				<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)]">
					CONSENT FLOW · Prescreen mode
				</p>
				<div className="flex flex-col gap-2">
					{[
						{
							label: "1. Consent message sent",
							note: "₦8 × 500 = ₦4,000",
							color: "var(--lp-amber)",
							done: true,
						},
						{
							label: "2. Replies collected",
							note: "312 / 500 replied",
							color: "var(--lp-green)",
							done: true,
						},
						{
							label: "3. Full campaign sent",
							note: "₦90 × 312 = ₦28,080",
							color: "var(--lp-accent)",
							done: true,
						},
						{
							label: "4. 188 contacts skipped",
							note: "Saved ₦16,920",
							color: "var(--lp-text-sub)",
							done: false,
						},
					].map((s) => (
						<div
							className="flex items-center gap-[13px] rounded-[9px] p-[9px_12px]"
							key={s.label}
							style={{
								border: `1px solid ${s.done ? s.color + "28" : "var(--lp-border-sub)"}`,
								background: s.done ? s.color + "09" : "transparent",
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
				<SectionLabel>Features</SectionLabel>
				<h2 className="font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(26px,7vw,42px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:text-[clamp(30px,4.2vw,56px)]">
					Everything your team needs to scale.
				</h2>
			</div>
			<FeatureRow
				bullets={[
					"Pre-built templates: Welcome, Cart Recovery, Re-engagement, Announcements",
					"WhatsApp + SMS in the same campaign",
					"Live delivery tracking as messages send",
				]}
				desc="Pick a scenario, select your audience, and MessageDesk personalises every message automatically with the recipient's name and your custom content."
				eyebrow="Campaigns"
				headline="Send to thousands. Every message lands personally."
				mockup={<MockupCampaign />}
			/>
			<Divider />
			<FeatureRow
				bullets={[
					"Accepts .xlsx, .csv, .pdf, .jpg, .png",
					"Auto-detects WhatsApp vs SMS capability",
					"Handles messy, unstructured real-world data",
				]}
				desc="Upload an Excel file, PDF, or even a photo of a printed list. Gemini AI extracts names and numbers automatically and maps them to the right channel."
				eyebrow="AI Contact Import"
				flip
				headline="Drop a spreadsheet. Contacts appear."
				mockup={<MockupImport />}
			/>
			<Divider />
			<FeatureRow
				bullets={[
					"Consent message at ₦8 vs ₦90 direct WhatsApp",
					"Automatic fan-out to replies only",
					"Full cost comparison and audit trail",
				]}
				desc="Send a cheap utility consent message first. Only contacts who reply get the full campaign — you pay only for genuinely engaged recipients."
				eyebrow="Consent Flow"
				headline="Cut campaign spend by up to 40%."
				mockup={<MockupConsent />}
			/>
		</section>
	);
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
	const { appTheme } = useTheme();
	const steps = [
		{
			n: "01",
			icon: <Users color="var(--lp-accent)" size={20} />,
			title: "Import contacts",
			body: "Drop a spreadsheet, paste a list, or type manually. AI handles the messy data.",
		},
		{
			n: "02",
			icon: <Sparkles color="var(--lp-accent)" size={20} />,
			title: "Pick a template",
			body: "Choose from pre-built scenarios or write your own. Variables filled automatically.",
		},
		{
			n: "03",
			icon: <Zap color="var(--lp-accent)" size={20} />,
			title: "Review & send",
			body: "Preview every message, confirm your cost, hit send. Thousands of messages in seconds.",
		},
		{
			n: "04",
			icon: <MessageCircle color="var(--lp-accent)" size={20} />,
			title: "Track replies live",
			body: "Watch the dashboard fill in real time. Reply to conversations from your inbox.",
		},
	];
	return (
		<section className="px-5 py-12 md:py-20" id="how-it-works">
			<Divider />
			<div className="mx-auto max-w-[1160px] pt-10 md:pt-20">
				<SectionLabel>How it works</SectionLabel>
				<h2 className="mb-8 max-w-[540px] font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(24px,7vw,40px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:mb-14 md:text-[clamp(30px,4.2vw,54px)]">
					Zero to 10,000 messages in 4 steps.
				</h2>
				<div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
					{steps.map((s) => (
						<div key={s.n}>
							<p
								aria-hidden
								className="mb-[-16px] font-[family-name:var(--lp-font-display)] font-extrabold text-[88px] leading-none tracking-[-0.07em]"
								style={{
									color:
										appTheme === "dark"
											? "rgba(99,102,241,0.06)"
											: "rgba(99,102,241,0.08)",
								}}
							>
								{s.n}
							</p>
							<div className="rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-[22px_24px_26px]">
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[11px] border border-[var(--lp-border)] bg-[var(--lp-accent-lo)]">
									{s.icon}
								</div>
								<p className="mb-[9px] font-[family-name:var(--lp-font-display)] font-extrabold text-[16px] text-[var(--lp-text)] tracking-[-0.03em]">
									{s.title}
								</p>
								<p className="font-[family-name:var(--lp-font-body)] text-[14px] text-[var(--lp-text-sub)] leading-[1.68]">
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

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
	const { appTheme } = useTheme();
	const [annual, setAnnual] = useState(false);
	const dark = appTheme === "dark";

	const plans = [
		{
			name: "Starter",
			desc: "For small teams getting started",
			monthly: 10_000,
			highlight: false,
			badge: null,
			features: [
				"2,000 messages/month included",
				"WhatsApp + SMS campaigns",
				"AI contact import",
				"3 team members",
				"Basic analytics dashboard",
				"Email support",
			],
			cta: "Start free trial",
			ctaTo: "/register",
		},
		{
			name: "Growth",
			desc: "For businesses scaling fast",
			monthly: 30_000,
			highlight: true,
			badge: "Most popular",
			features: [
				"10,000 messages/month included",
				"Everything in Starter",
				"Consent flow (prescreen mode)",
				"10 team members",
				"Advanced analytics & reports",
				"Priority support",
				"Custom sender ID",
			],
			cta: "Get started",
			ctaTo: "/register",
		},
		{
			name: "Pro",
			desc: "For high-volume, enterprise teams",
			monthly: 70_000,
			highlight: false,
			badge: null,
			features: [
				"Unlimited messages",
				"Everything in Growth",
				"Unlimited team members",
				"API access",
				"Dedicated account manager",
				"Custom integrations",
				"SLA guarantee",
			],
			cta: "Contact sales",
			ctaTo: "/register",
		},
	];

	const perMessage = [
		{
			ch: "💬 WhatsApp Marketing",
			cost: "₦90",
			note: "Per approved template message",
		},
		{
			ch: "📩 WhatsApp Service",
			cost: "Free",
			note: "Replies within 24-hour window",
		},
		{ ch: "📱 SMS", cost: "₦6", note: "Per message, any network" },
		{ ch: "🔔 Consent message", cost: "₦8", note: "Utility template pre-send" },
	];

	return (
		<section className="px-5 py-12 md:py-20" id="pricing">
			<Divider />
			<div className="mx-auto max-w-[1160px] pt-10 md:pt-20">
				<SectionLabel>Pricing</SectionLabel>
				<div className="mb-9 flex flex-col items-center gap-4 md:mb-[52px]">
					<h2 className="text-center font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(24px,7vw,40px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:text-[clamp(30px,4.2vw,56px)]">
						Simple, transparent pricing.
					</h2>
					<p className="max-w-[460px] text-center font-[family-name:var(--lp-font-body)] text-[16px] text-[var(--lp-text-sub)]">
						A flat subscription plan plus pay-as-you-go per message. No hidden
						fees, ever.
					</p>
					<div className="flex items-center gap-[3px] rounded-full border border-[var(--lp-border)] bg-[var(--lp-card)] p-[4px_5px]">
						{[
							["Monthly", false],
							["Annual −15%", true],
						].map(([label, val]) => (
							<button
								className={`cursor-pointer rounded-full border-none px-5 py-[7px] font-[family-name:var(--lp-font-body)] font-semibold text-[13.5px] transition-all duration-200 ${annual === (val as boolean) ? "bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] text-white" : "bg-transparent text-[var(--lp-text-sub)]"}`}
								key={String(val)}
								onClick={() => setAnnual(val as boolean)}
								type="button"
							>
								{label as string}
							</button>
						))}
					</div>
				</div>

				<div className="mb-[72px] grid grid-cols-1 gap-[22px] md:grid-cols-3">
					{plans.map((p) => {
						const price = annual ? Math.round(p.monthly * 0.85) : p.monthly;
						return (
							<div
								className="relative rounded-[20px] p-[30px_28px]"
								key={p.name}
								style={{
									border: `1px solid ${p.highlight ? "var(--lp-accent)" : "var(--lp-border)"}`,
									background: p.highlight
										? dark
											? "linear-gradient(165deg,rgba(99,102,241,0.22) 0%,var(--lp-card) 55%)"
											: "linear-gradient(165deg,rgba(99,102,241,0.1) 0%,var(--lp-card) 55%)"
										: "var(--lp-card)",
									boxShadow: p.highlight
										? `0 0 48px rgba(99,102,241,${dark ? "0.18" : "0.12"})`
										: "none",
								}}
							>
								{p.badge && (
									<div className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[var(--lp-accent)] to-[var(--lp-violet)] px-[14px] py-1 font-[family-name:var(--lp-font-mono)] font-bold text-[10px] text-white uppercase tracking-[0.1em]">
										{p.badge}
									</div>
								)}
								<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[20px] text-[var(--lp-text)] tracking-[-0.04em]">
									{p.name}
								</p>
								<p className="mt-1 mb-[22px] font-[family-name:var(--lp-font-body)] text-[13px] text-[var(--lp-text-sub)]">
									{p.desc}
								</p>
								<div
									className={`flex items-baseline gap-1 ${annual ? "mb-2" : "mb-[22px]"}`}
								>
									<span
										className="font-[family-name:var(--lp-font-display)] font-extrabold text-[40px] leading-none tracking-[-0.05em]"
										style={{
											color: p.highlight
												? "var(--lp-accent)"
												: "var(--lp-text)",
										}}
									>
										₦{price.toLocaleString()}
									</span>
									<span className="font-[family-name:var(--lp-font-body)] text-[13px] text-[var(--lp-text-sub)]">
										/month
									</span>
								</div>
								{annual && (
									<p className="mb-[22px] font-[family-name:var(--lp-font-body)] text-[12px] text-[var(--lp-green)]">
										You save ₦{(p.monthly * 0.15 * 12).toLocaleString()} per
										year
									</p>
								)}
								<div className="mb-[22px] h-px bg-[var(--lp-border-sub)]" />
								<div className="mb-[26px] flex flex-col gap-[11px]">
									{p.features.map((f) => (
										<div className="flex items-start gap-[10px]" key={f}>
											<CheckCircle2
												className="mt-[1px] shrink-0"
												color={
													p.highlight ? "var(--lp-accent)" : "var(--lp-green)"
												}
												size={14}
											/>
											<span className="font-[family-name:var(--lp-font-body)] text-[13.5px] text-[var(--lp-text-sub)]">
												{f}
											</span>
										</div>
									))}
								</div>
								<Link
									className="block rounded-[11px] py-3 text-center font-[family-name:var(--lp-font-body)] font-bold text-[14.5px]"
									style={{
										background: p.highlight
											? "linear-gradient(135deg,var(--lp-accent),var(--lp-violet))"
											: dark
												? "rgba(255,255,255,0.06)"
												: "rgba(0,0,0,0.04)",
										color: p.highlight ? "#fff" : "var(--lp-text)",
										border: p.highlight
											? "none"
											: "1px solid var(--lp-border-sub)",
										boxShadow: p.highlight ? "0 0 24px var(--lp-glow)" : "none",
									}}
									to={p.ctaTo}
								>
									{p.cta}
								</Link>
							</div>
						);
					})}
				</div>

				<div className="rounded-[20px] border border-[var(--lp-border)] bg-[var(--lp-card)] p-5 md:p-8">
					<div className="mb-6 flex flex-wrap items-start justify-between gap-[14px]">
						<div>
							<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[20px] text-[var(--lp-text)] tracking-[-0.04em]">
								Pay-as-you-go rates
							</p>
							<p className="mt-1 font-[family-name:var(--lp-font-body)] text-[14px] text-[var(--lp-text-sub)]">
								Top up your wallet and spend only what you use. No subscription
								needed.
							</p>
						</div>
						<Tag>No monthly fees</Tag>
					</div>
					<div className="overflow-hidden rounded-[14px] border border-[var(--lp-border-sub)]">
						{perMessage.map((r, i) => (
							<div
								className="flex items-center justify-between p-[14px_18px]"
								key={r.ch}
								style={{
									borderBottom:
										i < 3 ? "1px solid var(--lp-border-sub)" : "none",
									background:
										i % 2 !== 0
											? dark
												? "rgba(99,102,241,0.025)"
												: "rgba(99,102,241,0.015)"
											: "transparent",
								}}
							>
								<div>
									<p className="font-[family-name:var(--lp-font-body)] font-semibold text-[14px] text-[var(--lp-text)]">
										{r.ch}
									</p>
									<p className="mt-[2px] font-[family-name:var(--lp-font-body)] text-[12px] text-[var(--lp-text-sub)]">
										{r.note}
									</p>
								</div>
								<p
									className="font-[family-name:var(--lp-font-mono)] font-bold text-[20px]"
									style={{
										color:
											r.cost === "Free"
												? "var(--lp-green)"
												: "var(--lp-accent)",
									}}
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
			quote:
				"We used to spend hours every Monday sending WhatsApp follow-ups manually. MessageDesk cut that to 8 minutes flat. Absolute game-changer.",
			name: "Adaeze O.",
			role: "Head of Growth",
			org: "Kuda",
		},
		{
			quote:
				"The consent flow alone saved us ₦120,000 last month. Sending only to opted-in contacts actually improved our reply rates as well.",
			name: "Tunde B.",
			role: "Marketing Lead",
			org: "Flutterwave",
		},
		{
			quote:
				"I uploaded a photo of a handwritten attendance sheet. MessageDesk parsed out 200 contacts in 45 seconds. I genuinely could not believe it.",
			name: "Chioma N.",
			role: "Operations Manager",
			org: "PiggyVest",
		},
	];
	return (
		<section className="px-5 py-12 md:py-20">
			<Divider />
			<div className="mx-auto max-w-[1160px] pt-10 md:pt-20">
				<SectionLabel>Testimonials</SectionLabel>
				<h2 className="mb-8 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(24px,7vw,40px)] text-[var(--lp-text)] leading-[1.02] tracking-[-0.04em] md:mb-12 md:text-[clamp(30px,4.2vw,52px)]">
					What teams are saying.
				</h2>
				<div className="grid grid-cols-1 gap-[22px] md:grid-cols-3">
					{quotes.map((q, i) => (
						<div
							className="flex flex-col gap-[18px] rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-[26px_26px_22px]"
							key={i}
						>
							<div className="flex gap-[2px]">
								{[1, 2, 3, 4, 5].map((s) => (
									<Star
										color="var(--lp-amber)"
										fill="var(--lp-amber)"
										key={s}
										size={13}
									/>
								))}
							</div>
							<p className="flex-1 font-[family-name:var(--lp-font-body)] text-[15px] text-[var(--lp-text)] leading-[1.72] tracking-[-0.01em]">
								"{q.quote}"
							</p>
							<div className="border-[var(--lp-border-sub)] border-t pt-4">
								<p className="font-[family-name:var(--lp-font-display)] font-extrabold text-[14px] text-[var(--lp-text)] tracking-[-0.02em]">
									{q.name}
								</p>
								<p className="mt-[3px] font-[family-name:var(--lp-font-body)] text-[12.5px] text-[var(--lp-text-sub)]">
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
	const { appTheme } = useTheme();
	const dark = appTheme === "dark";
	return (
		<section className="px-5 py-12 pb-20 md:py-20 md:pb-[110px]">
			<div className="mx-auto max-w-[1160px]">
				<div
					className="relative overflow-hidden rounded-[24px] border border-[var(--lp-border)] p-[52px_20px] text-center md:p-[96px_64px]"
					style={{
						background: dark
							? "linear-gradient(140deg,rgba(99,102,241,0.22) 0%,rgba(139,92,246,0.12) 50%,rgba(6,8,16,0) 80%)"
							: "linear-gradient(140deg,rgba(99,102,241,0.12) 0%,rgba(139,92,246,0.06) 50%,rgba(248,248,252,0) 80%)",
					}}
				>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(var(--lp-border-sub)_1px,transparent_1px),linear-gradient(90deg,var(--lp-border-sub)_1px,transparent_1px)] [background-size:60px_60px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black,transparent)]"
					/>
					<div
						aria-hidden
						className="pointer-events-none absolute -top-[100px] left-1/2 h-[400px] w-[600px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,var(--lp-glow)_0%,transparent_70%)]"
						style={{ opacity: dark ? 1 : 0.5 }}
					/>
					<div className="relative">
						<Tag>Get started today — free</Tag>
						<h2 className="mt-6 mb-4 font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(28px,8.5vw,50px)] text-[var(--lp-text)] leading-[1.0] tracking-[-0.04em] sm:text-[clamp(32px,7vw,56px)] md:text-[clamp(40px,5.5vw,74px)]">
							Your customers are waiting
							<br />
							to hear from you.
						</h2>
						<p className="mx-auto mb-9 max-w-[460px] font-[family-name:var(--lp-font-body)] text-[15px] text-[var(--lp-text-sub)] md:text-[16.5px]">
							Set up in under 5 minutes. No technical skills needed. Nigerian
							pricing in Naira.
						</p>
						<div className="flex flex-wrap justify-center gap-[14px]">
							<Link
								className="inline-flex w-full items-center justify-center gap-[9px] rounded-[13px] bg-gradient-to-br from-[var(--lp-accent)] to-[var(--lp-violet)] px-[34px] py-[15px] font-[family-name:var(--lp-font-body)] font-bold text-[15.5px] text-white shadow-[0_0_36px_var(--lp-glow)] sm:w-auto"
								to="/register"
							>
								Create free account <ArrowRight size={17} />
							</Link>
							<Link
								className="inline-flex w-full items-center justify-center rounded-[13px] border border-[var(--lp-border-sub)] bg-black/[0.04] px-[26px] py-[15px] font-[family-name:var(--lp-font-body)] font-medium text-[14.5px] text-[var(--lp-text-sub)] sm:w-auto dark:bg-white/[0.04]"
								to="/login"
							>
								I already have an account
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
				className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-[family-name:var(--lp-font-display)] font-extrabold text-[clamp(64px,14vw,200px)] text-[rgba(99,102,241,0.04)] leading-none tracking-[-0.06em] dark:text-[rgba(99,102,241,0.03)]"
			>
				MessageDesk
			</p>
			<div className="relative mx-auto max-w-[1160px]">
				<div className="mb-8 flex flex-wrap items-start justify-between gap-7 md:mb-11 md:gap-9">
					<div className="max-w-[256px]">
						<div className="mb-3 flex items-center gap-[10px]">
							<LogoMark size={28} />
							<span className="font-[family-name:var(--lp-font-display)] font-extrabold text-[15px] text-[var(--lp-text)] tracking-[-0.04em]">
								MessageDesk
							</span>
						</div>
						<p className="font-[family-name:var(--lp-font-body)] text-[13px] text-[var(--lp-text-sub)] leading-[1.65]">
							WhatsApp and SMS messaging built for businesses in Nigeria.
						</p>
					</div>
					<div className="flex flex-wrap gap-7 md:gap-[60px]">
						{[
							{
								heading: "Product",
								links: ["Features", "How it works", "Pricing", "Changelog"],
							},
							{
								heading: "Company",
								links: ["About", "Blog", "Contact", "Support"],
							},
							{ heading: "Legal", links: ["Privacy", "Terms", "Cookies"] },
						].map((col) => (
							<div key={col.heading}>
								<p className="mb-[14px] font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-sub)] uppercase tracking-[0.14em]">
									{col.heading}
								</p>
								<div className="flex flex-col gap-[9px]">
									{col.links.map((l) => (
										<a
											className="font-[family-name:var(--lp-font-body)] text-[13px] text-[var(--lp-text-dim)] transition-colors duration-150 hover:text-[var(--lp-text)]"
											href="#"
											key={l}
										>
											{l}
										</a>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
				<Divider />
				<div className="flex flex-wrap items-center justify-between gap-[10px] pt-[18px]">
					<p className="font-[family-name:var(--lp-font-mono)] text-[11px] text-[var(--lp-text-dim)]">
						© 2025 MessageDesk. Built for Nigerian businesses.
					</p>
					<div className="flex flex-wrap gap-[14px]">
						{["WhatsApp", "SMS", "Campaigns", "Templates"].map((t) => (
							<span
								className="font-[family-name:var(--lp-font-mono)] text-[10px] text-[var(--lp-text-dim)]"
								key={t}
							>
								{t}
							</span>
						))}
					</div>
				</div>
			</div>
		</footer>
	);
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
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
