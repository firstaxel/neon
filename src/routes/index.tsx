/**
 * src/routes/index.tsx — MessageDesk public landing page
 *
 * Features:
 *  - Full light / dark mode via useTheme() + ThemeToggle
 *  - Fully responsive: mobile (< 768), tablet (< 1024), desktop
 *  - Design tokens adapt per-theme while preserving the premium SaaS aesthetic
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle2,
	MessageCircle,
	Moon,
	Send,
	Sparkles,
	Star,
	Sun,
	Users,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { pageHeadMeta } from "#/lib/metadata";
import { useTheme } from "#/providers/theme";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => {
		return {
			meta: [pageHeadMeta.home],
		};
	},
});

// ─── Design tokens ────────────────────────────────────────────────────────────

function useTokens() {
	const { appTheme } = useTheme();
	const dark = appTheme === "dark";

	return {
		dark,
		bg: dark ? "#060810" : "#f8f8fc",
		bgCard: dark ? "#0b0f1c" : "#ffffff",
		bgCardHi: dark ? "#0f1425" : "#f2f2fa",
		bgNav: dark ? "rgba(6,8,16,0.92)" : "rgba(248,248,252,0.92)",
		bgMobile: dark ? "rgba(6,8,16,0.98)" : "rgba(248,248,252,0.98)",
		border: dark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.22)",
		borderSub: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
		accent: "#6366f1",
		accentLo: dark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.08)",
		accentGlow: "rgba(99,102,241,0.45)",
		violet: "#8b5cf6",
		violetLo: dark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.08)",
		green: "#10b981",
		amber: "#f59e0b",
		text: dark ? "#eef0f8" : "#0f1120",
		textSub: dark ? "rgba(238,240,248,0.55)" : "rgba(15,17,32,0.55)",
		textDim: dark ? "rgba(238,240,248,0.22)" : "rgba(15,17,32,0.28)",
		shimmerA: dark ? "#0b0f1c" : "#e8e8f4",
		shimmerB: dark ? "#141c2e" : "#f0f0fa",
		appBg: dark ? "#07091a" : "#ededf8",
		display: `'Bricolage Grotesque','Outfit',system-ui,sans-serif`,
		body: `'Geist','DM Sans',system-ui,sans-serif`,
		mono: `'Geist Mono','JetBrains Mono',monospace`,
	} as const;
}

// ─── Responsive hooks ─────────────────────────────────────────────────────────

function useIsMobile() {
	const [v, setV] = useState(
		typeof window !== "undefined" ? window.innerWidth < 768 : false
	);
	useEffect(() => {
		const fn = () => setV(window.innerWidth < 768);
		fn();
		window.addEventListener("resize", fn);
		return () => window.removeEventListener("resize", fn);
	}, []);
	return v;
}
function useIsTablet() {
	const [v, setV] = useState(
		typeof window !== "undefined" ? window.innerWidth < 1024 : false
	);
	useEffect(() => {
		const fn = () => setV(window.innerWidth < 1024);
		fn();
		window.addEventListener("resize", fn);
		return () => window.removeEventListener("resize", fn);
	}, []);
	return v;
}

// ─── Font + keyframes ─────────────────────────────────────────────────────────

function FontLoader({ dark }: { dark: boolean }) {
	return (
		<style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body { background: ${dark ? "#060810" : "#f8f8fc"}; color: ${dark ? "#eef0f8" : "#0f1120"}; -webkit-font-smoothing: antialiased; }
      a { color: inherit; text-decoration: none; }
      @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes rise {
        0%   { opacity:0; transform:translateY(18px) scale(0.97); }
        12%  { opacity:1; transform:translateY(0)    scale(1);    }
        78%  { opacity:1; }
        100% { opacity:0; transform:translateY(-12px); }
      }
      @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      @keyframes fu { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
      @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.5);opacity:0} }
      .fu  { animation: fu 0.65s ease both; }
      .fu2 { animation: fu 0.65s 0.12s ease both; }
      .fu3 { animation: fu 0.65s 0.25s ease both; }
    `}</style>
	);
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Divider() {
	const T = useTokens();
	return (
		<div
			style={{
				height: 1,
				background: `linear-gradient(90deg,transparent,${T.border},transparent)`,
			}}
		/>
	);
}

function Tag({ children }: { children: React.ReactNode }) {
	const T = useTokens();
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 7,
				background: T.accentLo,
				border: `1px solid ${T.border}`,
				borderRadius: 100,
				padding: "5px 14px",
			}}
		>
			<span
				style={{ position: "relative", width: 6, height: 6, flexShrink: 0 }}
			>
				<span
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "50%",
						background: T.accent,
						animation: "blink 2s infinite",
					}}
				/>
				<span
					style={{
						position: "absolute",
						inset: -2,
						borderRadius: "50%",
						border: `1px solid ${T.accent}`,
						animation: "pulse-ring 2s ease infinite",
					}}
				/>
			</span>
			<span
				style={{
					fontFamily: T.mono,
					fontSize: 10,
					fontWeight: 600,
					color: T.accent,
					letterSpacing: "0.14em",
					textTransform: "uppercase",
				}}
			>
				{children}
			</span>
		</span>
	);
}

function SectionLabel({ children }: { children: string }) {
	const T = useTokens();
	return (
		<p
			style={{
				fontFamily: T.mono,
				fontSize: 10,
				fontWeight: 600,
				color: T.accent,
				letterSpacing: "0.18em",
				textTransform: "uppercase",
				marginBottom: 12,
			}}
		>
			↗ {children}
		</p>
	);
}

function AppChrome({
	children,
	url = "app.messagedesk.io",
}: {
	children: React.ReactNode;
	url?: string;
}) {
	const T = useTokens();
	return (
		<div
			style={{
				borderRadius: 16,
				border: `1px solid ${T.border}`,
				background: T.bgCard,
				overflow: "hidden",
				boxShadow: T.dark
					? "0 32px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(99,102,241,0.06)"
					: "0 24px 60px rgba(99,102,241,0.10),0 0 0 1px rgba(99,102,241,0.08)",
			}}
		>
			<div
				style={{
					height: 38,
					background: T.appBg,
					borderBottom: `1px solid ${T.borderSub}`,
					display: "flex",
					alignItems: "center",
					padding: "0 14px",
					gap: 6,
				}}
			>
				{["#ef4444", "#f59e0b", "#10b981"].map((c, i) => (
					<div
						key={i.toString()}
						style={{
							width: 9,
							height: 9,
							borderRadius: "50%",
							background: c,
							opacity: 0.6,
						}}
					/>
				))}
				<div
					style={{
						marginLeft: 10,
						flex: 1,
						height: 20,
						borderRadius: 5,
						background: T.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)",
						display: "flex",
						alignItems: "center",
						paddingLeft: 10,
					}}
				>
					<span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.textDim }}>
						{url}
					</span>
				</div>
			</div>
			{children}
		</div>
	);
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
	const T = useTokens();
	const { appTheme, setTheme } = useTheme();
	return (
		<button
			aria-label="Toggle theme"
			onClick={() => setTheme(appTheme === "dark" ? "light" : "dark")}
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: 36,
				height: 36,
				borderRadius: 9,
				border: `1px solid ${T.border}`,
				background: T.accentLo,
				cursor: "pointer",
				color: T.accent,
				flexShrink: 0,
				transition: "all 0.2s",
			}}
			type="button"
		>
			{appTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
		</button>
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

function MsgBubble({ msg, delay }: { msg: (typeof MSGS)[0]; delay: number }) {
	const T = useTokens();
	const r = msg.side === "right";
	return (
		<div
			style={{
				animation: `rise 4.2s ${delay}s ease both infinite`,
				display: "flex",
				justifyContent: r ? "flex-end" : "flex-start",
				padding: "0 8px",
			}}
		>
			<div
				style={{
					maxWidth: "82%",
					background: r
						? T.accentLo
						: T.dark
							? "rgba(255,255,255,0.04)"
							: "rgba(0,0,0,0.03)",
					border: `1px solid ${r ? T.border : T.borderSub}`,
					borderRadius: r ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
					padding: "8px 12px",
				}}
			>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 9,
						color: r ? T.accent : T.textDim,
						marginBottom: 3,
						fontWeight: 600,
					}}
				>
					{msg.from}
				</p>
				<p
					style={{
						fontSize: 12,
						color: T.text,
						lineHeight: 1.55,
						fontFamily: T.body,
					}}
				>
					{msg.text}
				</p>
				<div
					style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}
				>
					<span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>
						✓✓
					</span>
				</div>
			</div>
		</div>
	);
}

function MessageStream() {
	const T = useTokens();
	return (
		<div
			style={{
				position: "relative",
				height: 320,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				gap: 9,
				padding: "8px 0",
				justifyContent: "flex-end",
			}}
		>
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: 60,
					background: `linear-gradient(to bottom,${T.bgCard},transparent)`,
					zIndex: 2,
					pointerEvents: "none",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					height: 40,
					background: `linear-gradient(to top,${T.bgCard},transparent)`,
					zIndex: 2,
					pointerEvents: "none",
				}}
			/>
			{MSGS.map((m, i) => (
				<MsgBubble delay={i * 0.75} key={i.toString()} msg={m} />
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
	const T = useTokens();
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
		<div style={{ textAlign: "center" }}>
			<p
				style={{
					fontFamily: T.display,
					fontSize: 28,
					fontWeight: 800,
					color: T.accent,
					letterSpacing: "-0.04em",
					lineHeight: 1,
				}}
			>
				{prefix}
				{v.toLocaleString()}
				{suffix}
			</p>
			<p
				style={{
					fontFamily: T.body,
					fontSize: 11.5,
					color: T.textSub,
					marginTop: 5,
				}}
			>
				{label}
			</p>
		</div>
	);
}

// ─── Logo mark ────────────────────────────────────────────────────────────────

function LogoMark({ size = 32 }: { size?: number }) {
	const T = useTokens();
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: Math.round(size * 0.31),
				background: `linear-gradient(135deg,${T.accent},${T.violet})`,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				boxShadow: `0 0 20px ${T.accentGlow}`,
				flexShrink: 0,
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

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
	const T = useTokens();
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);
	const mobile = useIsMobile();

	useEffect(() => {
		const fn = () => setScrolled(window.scrollY > 16);
		window.addEventListener("scroll", fn);
		return () => window.removeEventListener("scroll", fn);
	}, []);

	useEffect(() => {
		if (!mobile) {
			setOpen(false);
		}
	}, [mobile]);

	return (
		<header
			style={{
				position: "sticky",
				top: 0,
				zIndex: 100,
				background: scrolled ? T.bgNav : "transparent",
				backdropFilter: scrolled ? "blur(22px)" : "none",
				borderBottom: scrolled
					? `1px solid ${T.border}`
					: "1px solid transparent",
				transition: "all 0.25s ease",
			}}
		>
			<div
				style={{
					maxWidth: 1160,
					margin: "0 auto",
					padding: "0 20px",
					height: 60,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 16,
				}}
			>
				{/* Logo */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						flexShrink: 0,
					}}
				>
					<LogoMark size={32} />
					<span
						style={{
							fontFamily: T.display,
							fontWeight: 800,
							fontSize: 17,
							color: T.text,
							letterSpacing: "-0.04em",
						}}
					>
						Message<span style={{ color: T.accent }}>Desk</span>
					</span>
				</div>

				{/* Desktop nav */}
				{!mobile && (
					<nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
						{[
							["Features", "#features"],
							["How it works", "#how-it-works"],
							["Pricing", "#pricing"],
						].map(([l, h]) => (
							<a
								href={h}
								key={l}
								onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
								onMouseLeave={(e) => (e.currentTarget.style.color = T.textSub)}
								style={{
									fontSize: 14,
									fontWeight: 500,
									color: T.textSub,
									fontFamily: T.body,
									transition: "color .15s",
								}}
							>
								{l}
							</a>
						))}
					</nav>
				)}

				{/* Desktop CTA + toggle */}
				{!mobile && (
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<ThemeToggle />
						<Link
							onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
							onMouseLeave={(e) => (e.currentTarget.style.color = T.textSub)}
							style={{
								fontSize: 14,
								fontWeight: 600,
								color: T.textSub,
								padding: "7px 16px",
								borderRadius: 9,
								fontFamily: T.body,
								transition: "color .15s",
							}}
							to="/login"
						>
							Sign in
						</Link>
						<Link
							style={{
								fontSize: 14,
								fontWeight: 700,
								color: "#fff",
								background: `linear-gradient(135deg,${T.accent},${T.violet})`,
								padding: "9px 20px",
								borderRadius: 10,
								boxShadow: `0 0 20px ${T.accentGlow}`,
								fontFamily: T.body,
							}}
							to="/register"
						>
							Get started →
						</Link>
					</div>
				)}

				{/* Mobile controls */}
				{mobile && (
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<ThemeToggle />
						<button
							onClick={() => setOpen((o) => !o)}
							style={{
								background: T.accentLo,
								border: `1px solid ${T.border}`,
								borderRadius: 9,
								color: T.text,
								width: 36,
								height: 36,
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 17,
							}}
							type="button"
						>
							{open ? <X size={16} /> : "☰"}
						</button>
					</div>
				)}
			</div>

			{/* Mobile menu */}
			{mobile && open && (
				<div
					style={{
						background: T.bgMobile,
						backdropFilter: "blur(22px)",
						borderBottom: `1px solid ${T.border}`,
						padding: "16px 20px 22px",
						display: "flex",
						flexDirection: "column",
						gap: 4,
					}}
				>
					{[
						["Features", "#features"],
						["How it works", "#how-it-works"],
						["Pricing", "#pricing"],
					].map(([l, h]) => (
						<a
							href={h}
							key={l}
							onClick={() => setOpen(false)}
							style={{
								fontSize: 15,
								fontWeight: 500,
								color: T.text,
								fontFamily: T.body,
								padding: "10px 4px",
								display: "block",
							}}
						>
							{l}
						</a>
					))}
					<div
						style={{
							display: "flex",
							gap: 10,
							paddingTop: 14,
							borderTop: `1px solid ${T.border}`,
							marginTop: 8,
						}}
					>
						<Link
							onClick={() => setOpen(false)}
							style={{
								flex: 1,
								textAlign: "center",
								padding: "11px",
								borderRadius: 10,
								border: `1px solid ${T.border}`,
								color: T.text,
								fontFamily: T.body,
								fontSize: 14,
								fontWeight: 600,
							}}
							to="/login"
						>
							Sign in
						</Link>
						<Link
							onClick={() => setOpen(false)}
							style={{
								flex: 1,
								textAlign: "center",
								padding: "11px",
								borderRadius: 10,
								background: `linear-gradient(135deg,${T.accent},${T.violet})`,
								color: "#fff",
								fontFamily: T.body,
								fontSize: 14,
								fontWeight: 700,
							}}
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
	const T = useTokens();
	const mobile = useIsMobile();
	const tablet = useIsTablet();

	return (
		<section
			style={{
				position: "relative",
				overflow: "hidden",
				paddingTop: mobile ? 52 : 80,
			}}
		>
			<div
				aria-hidden
				style={{
					position: "absolute",
					inset: 0,
					pointerEvents: "none",
					backgroundImage: `linear-gradient(${T.borderSub} 1px,transparent 1px),linear-gradient(90deg,${T.borderSub} 1px,transparent 1px)`,
					backgroundSize: "72px 72px",
					maskImage:
						"radial-gradient(ellipse 80% 55% at 50% 0%,black 30%,transparent 100%)",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: -180,
					left: "50%",
					transform: "translateX(-50%)",
					width: 900,
					height: 700,
					pointerEvents: "none",
					background: T.dark
						? "radial-gradient(ellipse at 50% 0%,rgba(99,102,241,0.13) 0%,transparent 68%)"
						: "radial-gradient(ellipse at 50% 0%,rgba(99,102,241,0.09) 0%,transparent 68%)",
				}}
			/>

			<div
				style={{
					maxWidth: 1160,
					margin: "0 auto",
					padding: "0 20px",
					position: "relative",
				}}
			>
				<div
					className="fu"
					style={{
						textAlign: "center",
						maxWidth: 900,
						margin: "0 auto",
						paddingBottom: mobile ? 40 : 56,
					}}
				>
					<Tag>WhatsApp &amp; SMS · Nigerian pricing (₦)</Tag>
					<h1
						style={{
							fontFamily: T.display,
							fontSize: mobile
								? "clamp(40px,11vw,56px)"
								: "clamp(60px,7.5vw,100px)",
							fontWeight: 800,
							lineHeight: 0.96,
							letterSpacing: "-0.045em",
							color: T.text,
							marginTop: 28,
						}}
					>
						Reach your
						<br />
						<span
							style={{
								background: `linear-gradient(135deg,${T.accent} 30%,${T.violet})`,
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
							}}
						>
							customers fast.
						</span>
						<br />
						<span
							style={{
								fontSize: "0.58em",
								fontWeight: 700,
								color: T.textSub,
								letterSpacing: "-0.03em",
							}}
						>
							Both channels. One platform.
						</span>
					</h1>
					<p
						style={{
							fontFamily: T.body,
							fontSize: mobile ? 15.5 : 17.5,
							lineHeight: 1.7,
							color: T.textSub,
							maxWidth: 540,
							margin: "24px auto 0",
						}}
					>
						Send personalised WhatsApp campaigns and SMS blasts to your
						customers. AI contact import, pre-built templates, real-time
						delivery tracking.
					</p>
					<div
						className="fu2"
						style={{
							marginTop: 36,
							display: "flex",
							gap: 12,
							justifyContent: "center",
							flexWrap: "wrap",
							alignItems: "center",
						}}
					>
						<Link
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 9,
								fontFamily: T.body,
								fontSize: 15.5,
								fontWeight: 700,
								color: "#fff",
								background: `linear-gradient(135deg,${T.accent},${T.violet})`,
								padding: "14px 30px",
								borderRadius: 12,
								boxShadow: `0 0 32px ${T.accentGlow}`,
								width: mobile ? "100%" : "auto",
								justifyContent: "center",
							}}
							to="/register"
						>
							Start free <ArrowRight size={16} />
						</Link>
						<Link
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 8,
								fontFamily: T.body,
								fontSize: 14.5,
								fontWeight: 500,
								color: T.textSub,
								background: T.dark
									? "rgba(255,255,255,0.04)"
									: "rgba(0,0,0,0.04)",
								border: `1px solid ${T.borderSub}`,
								padding: "14px 24px",
								borderRadius: 12,
								width: mobile ? "100%" : "auto",
								justifyContent: "center",
							}}
							to="/login"
						>
							Sign in →
						</Link>
					</div>
					<p
						style={{
							fontFamily: T.mono,
							fontSize: 11,
							color: T.textDim,
							marginTop: 16,
						}}
					>
						No credit card · Live in 5 minutes · Cancel anytime
					</p>
				</div>

				{/* Stats */}
				<div
					className="fu2"
					style={{
						display: "flex",
						justifyContent: "center",
						gap: mobile ? 24 : 64,
						marginBottom: 48,
						flexWrap: "wrap",
					}}
				>
					<Counter end={48_291} label="messages sent" />
					<Counter end={2847} label="active contacts" />
					<Counter end={134} label="campaigns run" />
					<Counter end={6} label="per SMS" prefix="₦" />
				</div>

				{/* Product chrome — hidden on mobile */}
				{!mobile && (
					<div className="fu3" style={{ position: "relative" }}>
						<div
							aria-hidden
							style={{
								position: "absolute",
								bottom: 0,
								left: 0,
								right: 0,
								height: 200,
								background: `linear-gradient(to top,${T.bg} 30%,transparent)`,
								zIndex: 3,
								pointerEvents: "none",
							}}
						/>
						<AppChrome>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: tablet ? "1fr" : "1fr 1fr",
									minHeight: 360,
								}}
							>
								<div
									style={{
										borderRight: tablet ? "none" : `1px solid ${T.borderSub}`,
										padding: "16px 8px",
									}}
								>
									<div
										style={{
											padding: "0 14px 12px",
											borderBottom: `1px solid ${T.borderSub}`,
											marginBottom: 8,
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
										}}
									>
										<p
											style={{
												fontFamily: T.mono,
												fontSize: 10,
												color: T.textSub,
											}}
										>
											INBOX · Live
										</p>
										<span
											style={{
												fontFamily: T.mono,
												fontSize: 9,
												color: T.green,
												background: "rgba(16,185,129,0.1)",
												border: "1px solid rgba(16,185,129,0.2)",
												padding: "2px 8px",
												borderRadius: 100,
											}}
										>
											● Online
										</span>
									</div>
									<MessageStream />
								</div>
								{!tablet && (
									<div style={{ padding: "16px 18px" }}>
										<p
											style={{
												fontFamily: T.mono,
												fontSize: 10,
												color: T.textSub,
												marginBottom: 14,
											}}
										>
											CAMPAIGNS · Recent
										</p>
										<div
											style={{
												display: "flex",
												flexDirection: "column",
												gap: 8,
											}}
										>
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
													key={c.name}
													style={{
														borderRadius: 9,
														border: `1px solid ${T.borderSub}`,
														background: T.bgCardHi,
														padding: "10px 12px",
													}}
												>
													<div
														style={{
															display: "flex",
															justifyContent: "space-between",
															alignItems: "flex-start",
														}}
													>
														<div>
															<p
																style={{
																	fontFamily: T.body,
																	fontSize: 12,
																	fontWeight: 600,
																	color: T.text,
																}}
															>
																{c.name}
															</p>
															<p
																style={{
																	fontFamily: T.mono,
																	fontSize: 9.5,
																	color: T.textSub,
																	marginTop: 2,
																}}
															>
																{c.ch} · {c.sent.toLocaleString()} sent
															</p>
														</div>
														<div
															style={{
																padding: "2px 8px",
																borderRadius: 100,
																background: c.done
																	? "rgba(16,185,129,0.1)"
																	: "rgba(245,158,11,0.1)",
																border: `1px solid ${c.done ? "rgba(16,185,129,0.28)" : "rgba(245,158,11,0.28)"}`,
															}}
														>
															<span
																style={{
																	fontFamily: T.mono,
																	fontSize: 9,
																	color: c.done ? T.green : T.amber,
																	fontWeight: 700,
																}}
															>
																{c.done ? "DONE" : "LIVE"}
															</span>
														</div>
													</div>
													<div
														style={{
															marginTop: 8,
															height: 3,
															borderRadius: 100,
															background: T.dark
																? "rgba(255,255,255,0.05)"
																: "rgba(0,0,0,0.06)",
														}}
													>
														<div
															style={{
																height: "100%",
																width: `${c.pct}%`,
																borderRadius: 100,
																background: c.done ? T.green : T.amber,
																transition: "width 1.6s ease",
															}}
														/>
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</AppChrome>
					</div>
				)}
			</div>
		</section>
	);
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
	const T = useTokens();
	const mobile = useIsMobile();
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
		<section style={{ padding: `${mobile ? 44 : 56}px 20px 44px` }}>
			<p
				style={{
					fontFamily: T.mono,
					fontSize: 10,
					color: T.textDim,
					letterSpacing: "0.18em",
					textTransform: "uppercase",
					textAlign: "center",
					marginBottom: 20,
				}}
			>
				Trusted by fast-growing teams across Nigeria
			</p>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "10px 28px",
					justifyContent: "center",
				}}
			>
				{brands.map((b) => (
					<span
						key={b}
						style={{
							fontFamily: T.display,
							fontSize: 13.5,
							fontWeight: 700,
							color: T.textDim,
							letterSpacing: "-0.02em",
						}}
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
	const T = useTokens();
	const mobile = useIsMobile();
	return (
		<section style={{ padding: "80px 20px" }}>
			<Divider />
			<div
				style={{
					maxWidth: 1160,
					margin: "0 auto",
					paddingTop: 80,
					display: "grid",
					gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
					gap: mobile ? 48 : 88,
					alignItems: "center",
				}}
			>
				<div>
					<SectionLabel>The Problem</SectionLabel>
					<h2
						style={{
							fontFamily: T.display,
							fontSize: mobile
								? "clamp(28px,8vw,44px)"
								: "clamp(30px,3.8vw,52px)",
							fontWeight: 800,
							color: T.text,
							lineHeight: 1.02,
							letterSpacing: "-0.04em",
						}}
					>
						Your customers are on WhatsApp. Your outreach is stuck in email.
					</h2>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
						<div
							key={p.title}
							style={{ display: "flex", gap: 18, alignItems: "flex-start" }}
						>
							<div
								style={{
									width: 44,
									height: 44,
									borderRadius: 12,
									flexShrink: 0,
									background: T.accentLo,
									border: `1px solid ${T.border}`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 20,
								}}
							>
								{p.icon}
							</div>
							<div>
								<p
									style={{
										fontFamily: T.display,
										fontSize: 15,
										fontWeight: 700,
										color: T.text,
										marginBottom: 5,
										letterSpacing: "-0.02em",
									}}
								>
									{p.title}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 13.5,
										color: T.textSub,
										lineHeight: 1.68,
									}}
								>
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
	const T = useTokens();
	const mobile = useIsMobile();
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
				gap: mobile ? 40 : 72,
				alignItems: "center",
				padding: `${mobile ? 56 : 80}px 0`,
			}}
		>
			<div style={{ order: mobile ? 0 : flip ? 1 : 0 }}>
				<SectionLabel>{eyebrow}</SectionLabel>
				<h3
					style={{
						fontFamily: T.display,
						fontSize: mobile
							? "clamp(24px,6vw,38px)"
							: "clamp(24px,2.8vw,42px)",
						fontWeight: 800,
						color: T.text,
						lineHeight: 1.05,
						letterSpacing: "-0.04em",
						marginBottom: 18,
					}}
				>
					{headline}
				</h3>
				<p
					style={{
						fontFamily: T.body,
						fontSize: 14.5,
						color: T.textSub,
						lineHeight: 1.78,
						marginBottom: 24,
					}}
				>
					{desc}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
					{bullets.map((b) => (
						<div
							key={b}
							style={{ display: "flex", alignItems: "flex-start", gap: 11 }}
						>
							<CheckCircle2
								color={T.accent}
								size={15}
								style={{ flexShrink: 0, marginTop: 1 }}
							/>
							<span
								style={{ fontFamily: T.body, fontSize: 14, color: T.textSub }}
							>
								{b}
							</span>
						</div>
					))}
				</div>
			</div>
			<div style={{ order: mobile ? 1 : flip ? 0 : 1 }}>{mockup}</div>
		</div>
	);
}

function MockupCampaign() {
	const T = useTokens();
	return (
		<AppChrome url="app.messagedesk.io/campaigns/create">
			<div style={{ padding: 20 }}>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 10,
						color: T.textSub,
						marginBottom: 14,
					}}
				>
					NEW CAMPAIGN · Step 2 of 4
				</p>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: 8,
						marginBottom: 16,
					}}
				>
					{[
						{ icon: "🛒", label: "Abandoned Cart", active: true },
						{ icon: "🎉", label: "Product Launch", active: false },
						{ icon: "🔄", label: "Re-engagement", active: false },
						{ icon: "📢", label: "Announcement", active: false },
					].map((s) => (
						<div
							key={s.label}
							style={{
								borderRadius: 9,
								border: `1px solid ${s.active ? T.border : T.borderSub}`,
								background: s.active ? T.accentLo : "transparent",
								padding: "10px 12px",
								display: "flex",
								alignItems: "center",
								gap: 9,
							}}
						>
							<span style={{ fontSize: 14 }}>{s.icon}</span>
							<span
								style={{
									fontFamily: T.body,
									fontSize: 12,
									fontWeight: s.active ? 700 : 400,
									color: s.active ? T.accent : T.textSub,
								}}
							>
								{s.label}
							</span>
						</div>
					))}
				</div>
				<div
					style={{
						borderRadius: 9,
						border: `1px solid ${T.border}`,
						background: T.accentLo,
						padding: "12px 14px",
					}}
				>
					<p
						style={{
							fontFamily: T.mono,
							fontSize: 9,
							color: T.accent,
							marginBottom: 6,
						}}
					>
						PREVIEW · WhatsApp
					</p>
					<p
						style={{
							fontFamily: T.body,
							fontSize: 12.5,
							color: T.text,
							lineHeight: 1.6,
						}}
					>
						Hi{" "}
						<span
							style={{
								background: T.accentLo,
								border: `1px solid ${T.border}`,
								borderRadius: 4,
								padding: "0 5px",
								color: T.accent,
							}}
						>
							Sarah
						</span>
						! 🛒 You left something in your cart. Complete your order today and
						get 10% off with code <strong>COMEBACK</strong>.
					</p>
				</div>
				<div
					style={{
						marginTop: 12,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span style={{ fontFamily: T.body, fontSize: 12, color: T.textSub }}>
						1,240 recipients selected
					</span>
					<div
						style={{
							padding: "7px 14px",
							borderRadius: 9,
							background: `linear-gradient(135deg,${T.accent},${T.violet})`,
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							boxShadow: `0 0 16px ${T.accentGlow}`,
						}}
					>
						<Send color="#fff" size={12} />
						<span
							style={{
								fontFamily: T.body,
								fontSize: 12,
								fontWeight: 700,
								color: "#fff",
							}}
						>
							Send campaign
						</span>
					</div>
				</div>
			</div>
		</AppChrome>
	);
}

function MockupImport() {
	const T = useTokens();
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
			<div style={{ padding: 20 }}>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 10,
						color: T.textSub,
						marginBottom: 14,
					}}
				>
					AI IMPORT ·{" "}
					{step === 0
						? "Uploading…"
						: step === 1
							? "Parsing with Gemini AI…"
							: "✓ 4 contacts found"}
				</p>
				<div
					style={{
						height: 3,
						borderRadius: 100,
						background: T.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
						marginBottom: 16,
					}}
				>
					<div
						style={{
							height: "100%",
							width: `${step === 0 ? 28 : step === 1 ? 70 : 100}%`,
							borderRadius: 100,
							background: `linear-gradient(90deg,${T.accent},${T.violet})`,
							transition: "width 0.9s ease",
						}}
					/>
				</div>
				{step === 2 ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
						{contacts.map((c) => (
							<div
								key={c.name}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 11,
									borderRadius: 8,
									border: `1px solid ${T.borderSub}`,
									background: T.bgCardHi,
									padding: "8px 11px",
								}}
							>
								<div
									style={{
										width: 28,
										height: 28,
										borderRadius: "50%",
										flexShrink: 0,
										background: T.accentLo,
										border: `1px solid ${T.border}`,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<span
										style={{
											fontFamily: T.body,
											fontSize: 11,
											fontWeight: 800,
											color: T.accent,
										}}
									>
										{c.name[0]}
									</span>
								</div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<p
										style={{
											fontFamily: T.body,
											fontSize: 12.5,
											fontWeight: 600,
											color: T.text,
										}}
									>
										{c.name}
									</p>
									<p
										style={{
											fontFamily: T.mono,
											fontSize: 9.5,
											color: T.textSub,
										}}
									>
										{c.phone}
									</p>
								</div>
								<span
									style={{
										fontFamily: T.mono,
										fontSize: 9,
										padding: "2px 7px",
										borderRadius: 5,
										color: c.ch === "WhatsApp" ? T.accent : T.violet,
										background: c.ch === "WhatsApp" ? T.accentLo : T.violetLo,
										flexShrink: 0,
									}}
								>
									{c.ch}
								</span>
							</div>
						))}
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								style={{
									height: 40,
									borderRadius: 8,
									border: `1px solid ${T.borderSub}`,
									background: `linear-gradient(90deg,${T.shimmerA} 25%,${T.shimmerB} 50%,${T.shimmerA} 75%)`,
									backgroundSize: "600px 100%",
									animation: "shimmer 1.5s ease infinite",
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
	const T = useTokens();
	return (
		<AppChrome url="app.messagedesk.io/campaigns/prescreen">
			<div style={{ padding: 20 }}>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 10,
						color: T.textSub,
						marginBottom: 14,
					}}
				>
					CONSENT FLOW · Prescreen mode
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					{[
						{
							label: "1. Consent message sent",
							note: "₦8 × 500 = ₦4,000",
							color: T.amber,
							done: true,
						},
						{
							label: "2. Replies collected",
							note: "312 / 500 replied",
							color: T.green,
							done: true,
						},
						{
							label: "3. Full campaign sent",
							note: "₦90 × 312 = ₦28,080",
							color: T.accent,
							done: true,
						},
						{
							label: "4. 188 contacts skipped",
							note: "Saved ₦16,920",
							color: T.textSub,
							done: false,
						},
					].map((s) => (
						<div
							key={s.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 13,
								borderRadius: 9,
								padding: "9px 12px",
								border: `1px solid ${s.done ? `${s.color}28` : T.borderSub}`,
								background: s.done ? `${s.color}09` : "transparent",
							}}
						>
							<div
								style={{
									width: 7,
									height: 7,
									borderRadius: "50%",
									background: s.color,
									flexShrink: 0,
								}}
							/>
							<div style={{ flex: 1 }}>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 12.5,
										fontWeight: 600,
										color: s.done ? T.text : T.textSub,
									}}
								>
									{s.label}
								</p>
							</div>
							<span
								style={{ fontFamily: T.mono, fontSize: 10, color: s.color }}
							>
								{s.note}
							</span>
						</div>
					))}
				</div>
				<div
					style={{
						marginTop: 14,
						borderRadius: 9,
						background: T.accentLo,
						border: `1px solid ${T.border}`,
						padding: "10px 14px",
						display: "flex",
						justifyContent: "space-between",
					}}
				>
					<span style={{ fontFamily: T.body, fontSize: 13, color: T.text }}>
						Total spend
					</span>
					<span
						style={{
							fontFamily: T.mono,
							fontSize: 15,
							fontWeight: 700,
							color: T.accent,
						}}
					>
						₦32,080
					</span>
				</div>
				<p
					style={{
						fontFamily: T.body,
						fontSize: 11.5,
						color: T.textSub,
						marginTop: 7,
						textAlign: "center",
					}}
				>
					vs ₦45,000 direct — saved{" "}
					<strong style={{ color: T.green }}>29%</strong>
				</p>
			</div>
		</AppChrome>
	);
}

function Features() {
	const T = useTokens();
	const mobile = useIsMobile();
	return (
		<section
			id="features"
			style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px 40px" }}
		>
			<Divider />
			<div style={{ paddingTop: 80, textAlign: "center", marginBottom: 16 }}>
				<SectionLabel>Features</SectionLabel>
				<h2
					style={{
						fontFamily: T.display,
						fontSize: mobile
							? "clamp(28px,8vw,44px)"
							: "clamp(30px,4.2vw,56px)",
						fontWeight: 800,
						color: T.text,
						lineHeight: 1.02,
						letterSpacing: "-0.04em",
					}}
				>
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
	const T = useTokens();
	const mobile = useIsMobile();
	const steps = [
		{
			n: "01",
			icon: <Users color={T.accent} size={20} />,
			title: "Import contacts",
			body: "Drop a spreadsheet, paste a list, or type manually. AI handles the messy data.",
		},
		{
			n: "02",
			icon: <Sparkles color={T.accent} size={20} />,
			title: "Pick a template",
			body: "Choose from pre-built scenarios or write your own. Variables filled automatically.",
		},
		{
			n: "03",
			icon: <Zap color={T.accent} size={20} />,
			title: "Review & send",
			body: "Preview every message, confirm your cost, hit send. Thousands of messages in seconds.",
		},
		{
			n: "04",
			icon: <MessageCircle color={T.accent} size={20} />,
			title: "Track replies live",
			body: "Watch the dashboard fill in real time. Reply to conversations from your inbox.",
		},
	];
	return (
		<section id="how-it-works" style={{ padding: "80px 20px" }}>
			<Divider />
			<div style={{ maxWidth: 1160, margin: "0 auto", paddingTop: 80 }}>
				<SectionLabel>How it works</SectionLabel>
				<h2
					style={{
						fontFamily: T.display,
						fontSize: mobile
							? "clamp(28px,8vw,44px)"
							: "clamp(30px,4.2vw,54px)",
						fontWeight: 800,
						color: T.text,
						lineHeight: 1.02,
						letterSpacing: "-0.04em",
						marginBottom: 56,
						maxWidth: 540,
					}}
				>
					Zero to 10,000 messages in 4 steps.
				</h2>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: mobile
							? "1fr"
							: "repeat(auto-fill,minmax(240px,1fr))",
						gap: 22,
					}}
				>
					{steps.map((s) => (
						<div key={s.n}>
							<p
								aria-hidden
								style={{
									fontFamily: T.display,
									fontSize: 88,
									fontWeight: 800,
									color: T.dark
										? "rgba(99,102,241,0.06)"
										: "rgba(99,102,241,0.08)",
									lineHeight: 1,
									letterSpacing: "-0.07em",
									marginBottom: -16,
								}}
							>
								{s.n}
							</p>
							<div
								style={{
									borderRadius: 16,
									border: `1px solid ${T.border}`,
									background: T.bgCard,
									padding: "22px 24px 26px",
								}}
							>
								<div
									style={{
										width: 40,
										height: 40,
										borderRadius: 11,
										background: T.accentLo,
										border: `1px solid ${T.border}`,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										marginBottom: 16,
									}}
								>
									{s.icon}
								</div>
								<p
									style={{
										fontFamily: T.display,
										fontSize: 16,
										fontWeight: 800,
										color: T.text,
										marginBottom: 9,
										letterSpacing: "-0.03em",
									}}
								>
									{s.title}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 14,
										color: T.textSub,
										lineHeight: 1.68,
									}}
								>
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
	const T = useTokens();
	const mobile = useIsMobile();
	const [annual, setAnnual] = useState(false);

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
		<section id="pricing" style={{ padding: "80px 20px" }}>
			<Divider />
			<div style={{ maxWidth: 1160, margin: "0 auto", paddingTop: 80 }}>
				<SectionLabel>Pricing</SectionLabel>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						marginBottom: 52,
						gap: 18,
					}}
				>
					<h2
						style={{
							fontFamily: T.display,
							fontSize: mobile
								? "clamp(28px,8vw,44px)"
								: "clamp(30px,4.2vw,56px)",
							fontWeight: 800,
							color: T.text,
							lineHeight: 1.02,
							letterSpacing: "-0.04em",
							textAlign: "center",
						}}
					>
						Simple, transparent pricing.
					</h2>
					<p
						style={{
							fontFamily: T.body,
							fontSize: 16,
							color: T.textSub,
							textAlign: "center",
							maxWidth: 460,
						}}
					>
						A flat subscription plan plus pay-as-you-go per message. No hidden
						fees, ever.
					</p>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 3,
							background: T.bgCard,
							border: `1px solid ${T.border}`,
							borderRadius: 100,
							padding: "4px 5px",
						}}
					>
						{[
							["Monthly", false],
							["Annual −15%", true],
						].map(([label, val]) => (
							<button
								key={String(val)}
								onClick={() => setAnnual(val as boolean)}
								style={{
									fontFamily: T.body,
									fontSize: 13.5,
									fontWeight: 600,
									padding: "7px 20px",
									borderRadius: 100,
									border: "none",
									cursor: "pointer",
									transition: "all .2s",
									background:
										annual === (val as boolean)
											? `linear-gradient(135deg,${T.accent},${T.violet})`
											: "transparent",
									color: annual === (val as boolean) ? "#fff" : T.textSub,
								}}
								type="button"
							>
								{label as string}
							</button>
						))}
					</div>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)",
						gap: 22,
						marginBottom: 72,
					}}
				>
					{plans.map((p) => {
						const price = annual ? Math.round(p.monthly * 0.85) : p.monthly;
						return (
							<div
								key={p.name}
								style={{
									borderRadius: 20,
									border: `1px solid ${p.highlight ? T.accent : T.border}`,
									background: p.highlight
										? T.dark
											? `linear-gradient(165deg,rgba(99,102,241,0.22) 0%,${T.bgCard} 55%)`
											: `linear-gradient(165deg,rgba(99,102,241,0.1) 0%,${T.bgCard} 55%)`
										: T.bgCard,
									padding: "30px 28px",
									position: "relative",
									boxShadow: p.highlight
										? `0 0 48px rgba(99,102,241,${T.dark ? "0.18" : "0.12"})`
										: "none",
								}}
							>
								{p.badge && (
									<div
										style={{
											position: "absolute",
											top: -13,
											left: "50%",
											transform: "translateX(-50%)",
											background: `linear-gradient(135deg,${T.accent},${T.violet})`,
											color: "#fff",
											fontFamily: T.mono,
											fontSize: 10,
											fontWeight: 700,
											letterSpacing: "0.1em",
											padding: "4px 14px",
											borderRadius: 100,
											whiteSpace: "nowrap",
										}}
									>
										{p.badge.toUpperCase()}
									</div>
								)}
								<p
									style={{
										fontFamily: T.display,
										fontSize: 20,
										fontWeight: 800,
										color: T.text,
										letterSpacing: "-0.04em",
									}}
								>
									{p.name}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 13,
										color: T.textSub,
										marginTop: 4,
										marginBottom: 22,
									}}
								>
									{p.desc}
								</p>
								<div
									style={{
										display: "flex",
										alignItems: "baseline",
										gap: 4,
										marginBottom: annual ? 8 : 22,
									}}
								>
									<span
										style={{
											fontFamily: T.display,
											fontSize: 40,
											fontWeight: 800,
											color: p.highlight ? T.accent : T.text,
											letterSpacing: "-0.05em",
											lineHeight: 1,
										}}
									>
										₦{price.toLocaleString()}
									</span>
									<span
										style={{
											fontFamily: T.body,
											fontSize: 13,
											color: T.textSub,
										}}
									>
										/month
									</span>
								</div>
								{annual && (
									<p
										style={{
											fontFamily: T.body,
											fontSize: 12,
											color: T.green,
											marginBottom: 22,
										}}
									>
										You save ₦{(p.monthly * 0.15 * 12).toLocaleString()} per
										year
									</p>
								)}
								<div
									style={{
										height: 1,
										background: T.borderSub,
										marginBottom: 22,
									}}
								/>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 11,
										marginBottom: 26,
									}}
								>
									{p.features.map((f) => (
										<div
											key={f}
											style={{
												display: "flex",
												alignItems: "flex-start",
												gap: 10,
											}}
										>
											<CheckCircle2
												color={p.highlight ? T.accent : T.green}
												size={14}
												style={{ flexShrink: 0, marginTop: 1 }}
											/>
											<span
												style={{
													fontFamily: T.body,
													fontSize: 13.5,
													color: T.textSub,
												}}
											>
												{f}
											</span>
										</div>
									))}
								</div>
								<Link
									style={{
										display: "block",
										textAlign: "center",
										padding: "12px",
										borderRadius: 11,
										fontFamily: T.body,
										fontSize: 14.5,
										fontWeight: 700,
										background: p.highlight
											? `linear-gradient(135deg,${T.accent},${T.violet})`
											: T.dark
												? "rgba(255,255,255,0.06)"
												: "rgba(0,0,0,0.04)",
										color: p.highlight ? "#fff" : T.text,
										border: p.highlight ? "none" : `1px solid ${T.borderSub}`,
										boxShadow: p.highlight
											? `0 0 24px ${T.accentGlow}`
											: "none",
									}}
									to={p.ctaTo}
								>
									{p.cta}
								</Link>
							</div>
						);
					})}
				</div>

				<div
					style={{
						borderRadius: 20,
						border: `1px solid ${T.border}`,
						background: T.bgCard,
						padding: mobile ? 20 : 32,
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "flex-start",
							justifyContent: "space-between",
							marginBottom: 24,
							flexWrap: "wrap",
							gap: 14,
						}}
					>
						<div>
							<p
								style={{
									fontFamily: T.display,
									fontSize: 20,
									fontWeight: 800,
									color: T.text,
									letterSpacing: "-0.04em",
								}}
							>
								Pay-as-you-go rates
							</p>
							<p
								style={{
									fontFamily: T.body,
									fontSize: 14,
									color: T.textSub,
									marginTop: 4,
								}}
							>
								Top up your wallet and spend only what you use. No subscription
								needed.
							</p>
						</div>
						<Tag>No monthly fees</Tag>
					</div>
					<div
						style={{
							borderRadius: 14,
							border: `1px solid ${T.borderSub}`,
							overflow: "hidden",
						}}
					>
						{perMessage.map((r, i) => (
							<div
								key={r.ch}
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									padding: "14px 18px",
									borderBottom: i < 3 ? `1px solid ${T.borderSub}` : "none",
									background:
										i % 2 === 0
											? "transparent"
											: T.dark
												? "rgba(99,102,241,0.025)"
												: "rgba(99,102,241,0.015)",
								}}
							>
								<div>
									<p
										style={{
											fontFamily: T.body,
											fontSize: 14,
											fontWeight: 600,
											color: T.text,
										}}
									>
										{r.ch}
									</p>
									<p
										style={{
											fontFamily: T.body,
											fontSize: 12,
											color: T.textSub,
											marginTop: 2,
										}}
									>
										{r.note}
									</p>
								</div>
								<p
									style={{
										fontFamily: T.mono,
										fontSize: 20,
										fontWeight: 700,
										color: r.cost === "Free" ? T.green : T.accent,
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
	const T = useTokens();
	const mobile = useIsMobile();
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
		<section style={{ padding: "80px 20px" }}>
			<Divider />
			<div style={{ maxWidth: 1160, margin: "0 auto", paddingTop: 80 }}>
				<SectionLabel>Testimonials</SectionLabel>
				<h2
					style={{
						fontFamily: T.display,
						fontSize: mobile
							? "clamp(28px,8vw,44px)"
							: "clamp(30px,4.2vw,52px)",
						fontWeight: 800,
						color: T.text,
						lineHeight: 1.02,
						letterSpacing: "-0.04em",
						marginBottom: 48,
					}}
				>
					What teams are saying.
				</h2>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: mobile
							? "1fr"
							: "repeat(auto-fill,minmax(290px,1fr))",
						gap: 22,
					}}
				>
					{quotes.map((q, i) => (
						<div
							key={i.toString()}
							style={{
								borderRadius: 16,
								border: `1px solid ${T.border}`,
								background: T.bgCard,
								padding: "26px 26px 22px",
								display: "flex",
								flexDirection: "column",
								gap: 18,
							}}
						>
							<div style={{ display: "flex", gap: 2 }}>
								{[1, 2, 3, 4, 5].map((s) => (
									<Star color={T.amber} fill={T.amber} key={s} size={13} />
								))}
							</div>
							<p
								style={{
									fontFamily: T.body,
									fontSize: 15,
									color: T.text,
									lineHeight: 1.72,
									letterSpacing: "-0.01em",
									flex: 1,
								}}
							>
								"{q.quote}"
							</p>
							<div
								style={{
									borderTop: `1px solid ${T.borderSub}`,
									paddingTop: 16,
								}}
							>
								<p
									style={{
										fontFamily: T.display,
										fontSize: 14,
										fontWeight: 800,
										color: T.text,
										letterSpacing: "-0.02em",
									}}
								>
									{q.name}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 12.5,
										color: T.textSub,
										marginTop: 3,
									}}
								>
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
	const T = useTokens();
	const mobile = useIsMobile();
	return (
		<section style={{ padding: "80px 20px 110px" }}>
			<div style={{ maxWidth: 1160, margin: "0 auto" }}>
				<div
					style={{
						borderRadius: 24,
						position: "relative",
						overflow: "hidden",
						background: T.dark
							? "linear-gradient(140deg,rgba(99,102,241,0.22) 0%,rgba(139,92,246,0.12) 50%,rgba(6,8,16,0) 80%)"
							: "linear-gradient(140deg,rgba(99,102,241,0.12) 0%,rgba(139,92,246,0.06) 50%,rgba(248,248,252,0) 80%)",
						border: `1px solid ${T.border}`,
						padding: mobile ? "64px 24px" : "96px 64px",
						textAlign: "center",
					}}
				>
					<div
						aria-hidden
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							backgroundImage: `linear-gradient(${T.borderSub} 1px,transparent 1px),linear-gradient(90deg,${T.borderSub} 1px,transparent 1px)`,
							backgroundSize: "60px 60px",
							opacity: 0.5,
							maskImage:
								"radial-gradient(ellipse 70% 70% at 50% 50%,black,transparent)",
						}}
					/>
					<div
						aria-hidden
						style={{
							position: "absolute",
							top: -100,
							left: "50%",
							transform: "translateX(-50%)",
							width: 600,
							height: 400,
							pointerEvents: "none",
							background: `radial-gradient(ellipse at 50% 0%,${T.accentGlow} 0%,transparent 70%)`,
							opacity: T.dark ? 1 : 0.5,
						}}
					/>
					<div style={{ position: "relative" }}>
						<Tag>Get started today — free</Tag>
						<h2
							style={{
								fontFamily: T.display,
								fontSize: mobile
									? "clamp(34px,10vw,54px)"
									: "clamp(40px,5.5vw,74px)",
								fontWeight: 800,
								color: T.text,
								lineHeight: 0.97,
								letterSpacing: "-0.045em",
								marginTop: 28,
								marginBottom: 18,
							}}
						>
							Your customers are waiting
							<br />
							to hear from you.
						</h2>
						<p
							style={{
								fontFamily: T.body,
								fontSize: 16.5,
								color: T.textSub,
								maxWidth: 460,
								margin: "0 auto 40px",
							}}
						>
							Set up in under 5 minutes. No technical skills needed. Nigerian
							pricing in Naira.
						</p>
						<div
							style={{
								display: "flex",
								gap: 14,
								justifyContent: "center",
								flexWrap: "wrap",
							}}
						>
							<Link
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 9,
									fontFamily: T.body,
									fontSize: 15.5,
									fontWeight: 700,
									color: "#fff",
									background: `linear-gradient(135deg,${T.accent},${T.violet})`,
									padding: "15px 34px",
									borderRadius: 13,
									boxShadow: `0 0 36px ${T.accentGlow}`,
									width: mobile ? "100%" : "auto",
									justifyContent: "center",
								}}
								to="/register"
							>
								Create free account <ArrowRight size={17} />
							</Link>
							<Link
								style={{
									display: "inline-flex",
									alignItems: "center",
									fontFamily: T.body,
									fontSize: 14.5,
									fontWeight: 500,
									color: T.textSub,
									background: T.dark
										? "rgba(255,255,255,0.04)"
										: "rgba(0,0,0,0.04)",
									border: `1px solid ${T.borderSub}`,
									padding: "15px 26px",
									borderRadius: 13,
									width: mobile ? "100%" : "auto",
									justifyContent: "center",
								}}
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
	const T = useTokens();
	const mobile = useIsMobile();
	return (
		<footer
			style={{
				borderTop: `1px solid ${T.borderSub}`,
				padding: "52px 20px 44px",
				position: "relative",
				overflow: "hidden",
			}}
		>
			<p
				aria-hidden
				style={{
					position: "absolute",
					bottom: -24,
					left: "50%",
					transform: "translateX(-50%)",
					fontFamily: T.display,
					fontSize: "clamp(64px,14vw,200px)",
					fontWeight: 800,
					color: T.dark ? "rgba(99,102,241,0.03)" : "rgba(99,102,241,0.04)",
					whiteSpace: "nowrap",
					pointerEvents: "none",
					letterSpacing: "-0.06em",
					lineHeight: 1,
				}}
			>
				MessageDesk
			</p>
			<div style={{ maxWidth: 1160, margin: "0 auto", position: "relative" }}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						flexWrap: "wrap",
						gap: 36,
						marginBottom: 44,
					}}
				>
					<div style={{ maxWidth: 256 }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								marginBottom: 14,
							}}
						>
							<LogoMark size={30} />
							<span
								style={{
									fontFamily: T.display,
									fontWeight: 800,
									fontSize: 16,
									color: T.text,
									letterSpacing: "-0.04em",
								}}
							>
								MessageDesk
							</span>
						</div>
						<p
							style={{
								fontFamily: T.body,
								fontSize: 13.5,
								color: T.textSub,
								lineHeight: 1.68,
							}}
						>
							WhatsApp and SMS messaging built for businesses in Nigeria.
						</p>
					</div>
					<div
						style={{ display: "flex", gap: mobile ? 32 : 60, flexWrap: "wrap" }}
					>
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
								<p
									style={{
										fontFamily: T.mono,
										fontSize: 10,
										color: T.textSub,
										letterSpacing: "0.14em",
										textTransform: "uppercase",
										marginBottom: 16,
									}}
								>
									{col.heading}
								</p>
								<div
									style={{ display: "flex", flexDirection: "column", gap: 10 }}
								>
									{col.links.map((l) => (
										<a
											href="#"
											key={l}
											onMouseEnter={(e) =>
												(e.currentTarget.style.color = T.text)
											}
											onMouseLeave={(e) =>
												(e.currentTarget.style.color = T.textDim)
											}
											style={{
												fontFamily: T.body,
												fontSize: 13.5,
												color: T.textDim,
												transition: "color .15s",
											}}
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
				<div
					style={{
						paddingTop: 20,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						flexWrap: "wrap",
						gap: 12,
					}}
				>
					<p style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
						© 2025 MessageDesk. Built for Nigerian businesses.
					</p>
					<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
						{["WhatsApp", "SMS", "Campaigns", "Templates"].map((t) => (
							<span
								key={t}
								style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}
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
	const { appTheme } = useTheme();
	const T = useTokens();
	return (
		<>
			<FontLoader dark={appTheme === "dark"} />
			<div
				style={{
					minHeight: "100vh",
					width: "100%",
					background: T.bg,
					color: T.text,
					fontFamily: T.body,
				}}
			>
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
		</>
	);
}
