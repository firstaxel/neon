/**
 * src/routes/index.tsx — MessageDesk public landing page
 *
 * Aesthetic: Refined dark SaaS — deep slate bg, indigo/violet accent,
 * soft glass cards. Editorial typography (Instrument Serif display + DM Sans body).
 * Fully responsive via a useBreakpoint hook — no Tailwind, pure inline styles.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle2,
	MessageCircle,
	Send,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: LandingPage });

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
	bg: "#080b12", // deep navy-black
	bgCard: "#0e1420", // card surface
	bgCardHi: "#111827", // slightly lifted card
	border: "rgba(99,102,241,0.14)", // indigo-tinted border
	borderSub: "rgba(255,255,255,0.06)", // subtle border
	accent: "#6366f1", // indigo-500
	accentLo: "rgba(99,102,241,0.12)",
	accentGlow: "rgba(99,102,241,0.35)",
	violet: "#8b5cf6", // violet-500 — secondary accent
	green: "#10b981", // emerald — for positive/live indicators only
	text: "#f1f3f9", // near-white
	textSub: "rgba(241,243,249,0.5)", // muted
	textDim: "rgba(241,243,249,0.25)", // dimmed
	mono: `'JetBrains Mono','Fira Code',monospace`,
	display: `'Instrument Serif','Georgia',serif`,
	body: `'DM Sans',system-ui,sans-serif`,
} as const;

// ─── Responsive hook ──────────────────────────────────────────────────────────

function useIsMobile() {
	const [mobile, setMobile] = useState(
		typeof window !== "undefined" ? window.innerWidth < 768 : false
	);
	useEffect(() => {
		const fn = () => setMobile(window.innerWidth < 768);
		fn();
		window.addEventListener("resize", fn);
		return () => window.removeEventListener("resize", fn);
	}, []);
	return mobile;
}

function useIsTablet() {
	const [tablet, setTablet] = useState(
		typeof window !== "undefined" ? window.innerWidth < 1024 : false
	);
	useEffect(() => {
		const fn = () => setTablet(window.innerWidth < 1024);
		fn();
		window.addEventListener("resize", fn);
		return () => window.removeEventListener("resize", fn);
	}, []);
	return tablet;
}

// ─── Font + keyframes ─────────────────────────────────────────────────────────

function FontLoader() {
	return (
		<style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body { background: ${T.bg}; color: ${T.text}; -webkit-font-smoothing: antialiased; }
      a { color: inherit; text-decoration: none; }
      @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
      @keyframes rise {
        0%   { opacity:0; transform:translateY(18px) scale(0.97); }
        12%  { opacity:1; transform:translateY(0) scale(1); }
        78%  { opacity:1; }
        100% { opacity:0; transform:translateY(-10px); }
      }
      @keyframes shimmer {
        0%   { background-position: -600px 0; }
        100% { background-position:  600px 0; }
      }
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(22px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .fu  { animation: fadeUp 0.6s ease both; }
      .fu2 { animation: fadeUp 0.6s 0.1s ease both; }
      .fu3 { animation: fadeUp 0.6s 0.22s ease both; }
    `}</style>
	);
}

// ─── Tiny atoms ───────────────────────────────────────────────────────────────

function Divider() {
	return (
		<div
			style={{
				height: 1,
				background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
			}}
		/>
	);
}

function SectionLabel({ children }: { children: string }) {
	return (
		<p
			style={{
				fontFamily: T.mono,
				fontSize: 10,
				fontWeight: 700,
				color: T.accent,
				letterSpacing: "0.18em",
				textTransform: "uppercase",
				marginBottom: 14,
			}}
		>
			/ {children}
		</p>
	);
}

function Badge({ children }: { children: React.ReactNode }) {
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
				style={{
					width: 5,
					height: 5,
					borderRadius: "50%",
					background: T.accent,
					animation: "pulse-dot 2s infinite",
					flexShrink: 0,
				}}
			/>
			<span
				style={{
					fontFamily: T.mono,
					fontSize: 10,
					fontWeight: 700,
					color: T.accent,
					letterSpacing: "0.12em",
					textTransform: "uppercase",
				}}
			>
				{children}
			</span>
		</span>
	);
}

function AppChrome({
	children,
	url = "app.messagedesk.io",
}: {
	children: React.ReactNode;
	url?: string;
}) {
	return (
		<div
			style={{
				borderRadius: 14,
				border: `1px solid ${T.border}`,
				background: T.bgCard,
				overflow: "hidden",
				boxShadow:
					"0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.06)",
			}}
		>
			<div
				style={{
					height: 36,
					background: "#090d17",
					borderBottom: `1px solid ${T.borderSub}`,
					display: "flex",
					alignItems: "center",
					padding: "0 12px",
					gap: 6,
				}}
			>
				{["#ef4444", "#f59e0b", "#10b981"].map((c, i) => (
					<div
						key={i}
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: c,
							opacity: 0.55,
						}}
					/>
				))}
				<div
					style={{
						marginLeft: 10,
						flex: 1,
						height: 18,
						borderRadius: 4,
						background: "rgba(255,255,255,0.04)",
						display: "flex",
						alignItems: "center",
						paddingLeft: 8,
					}}
				>
					<span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>
						{url}
					</span>
				</div>
			</div>
			{children}
		</div>
	);
}

// ─── Message stream ───────────────────────────────────────────────────────────

const MSGS = [
	{
		from: "✨ Welcome",
		text: "Hi Emeka! 🎉 We're so glad you joined us last Sunday. Here's what's on this week...",
		side: "right" as const,
	},
	{
		from: "💬 Blessing",
		text: "Thank you so much! I really enjoyed the service 🙏",
		side: "left" as const,
	},
	{
		from: "📢 Campaign",
		text: "Dear Ngozi, you're invited to our Easter Harvest — Sat 26th at 11am 🎊",
		side: "right" as const,
	},
	{
		from: "🔔 Consent",
		text: "Hi Chidera, Grace Assembly would like to send you a message. Reply YES to receive it or STOP to opt out.",
		side: "right" as const,
	},
	{
		from: "💬 Chidera",
		text: "YES please! Looking forward 😊",
		side: "left" as const,
	},
	{
		from: "🔄 Follow-up",
		text: "Hi Adaeze, we noticed you've been away — we miss you! Hope all is well 💙",
		side: "right" as const,
	},
];

function MsgBubble({ msg, delay }: { msg: (typeof MSGS)[0]; delay: number }) {
	const isRight = msg.side === "right";
	return (
		<div
			style={{
				animation: `rise 4s ${delay}s ease both infinite`,
				display: "flex",
				justifyContent: isRight ? "flex-end" : "flex-start",
				padding: "0 6px",
			}}
		>
			<div
				style={{
					maxWidth: "82%",
					background: isRight ? T.accentLo : "rgba(255,255,255,0.04)",
					border: `1px solid ${isRight ? T.border : T.borderSub}`,
					borderRadius: isRight ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
					padding: "7px 11px",
				}}
			>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 9,
						color: isRight ? T.accent : T.textDim,
						marginBottom: 3,
						fontWeight: 700,
					}}
				>
					{msg.from}
				</p>
				<p
					style={{
						fontSize: 11.5,
						color: T.text,
						lineHeight: 1.5,
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
	return (
		<div
			style={{
				position: "relative",
				height: 320,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				gap: 8,
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
				<MsgBubble delay={i * 0.72} key={i} msg={m} />
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
		const step = end / 48;
		const t = setInterval(() => {
			s += step;
			if (s >= end) {
				setV(end);
				clearInterval(t);
			} else {
				setV(Math.floor(s));
			}
		}, 28);
		return () => clearInterval(t);
	}, [end]);
	return (
		<div style={{ textAlign: "center" }}>
			<p
				style={{
					fontFamily: T.mono,
					fontSize: 24,
					fontWeight: 700,
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
					fontSize: 11,
					color: T.textSub,
					marginTop: 4,
				}}
			>
				{label}
			</p>
		</div>
	);
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);
	const mobile = useIsMobile();

	useEffect(() => {
		const fn = () => setScrolled(window.scrollY > 16);
		window.addEventListener("scroll", fn);
		return () => window.removeEventListener("scroll", fn);
	}, []);

	return (
		<header
			style={{
				position: "sticky",
				top: 0,
				zIndex: 100,
				background: scrolled ? "rgba(8,11,18,0.92)" : "transparent",
				backdropFilter: scrolled ? "blur(20px)" : "none",
				borderBottom: scrolled
					? `1px solid ${T.border}`
					: "1px solid transparent",
				transition: "all 0.25s ease",
			}}
		>
			<div
				style={{
					maxWidth: 1120,
					margin: "0 auto",
					padding: "0 20px",
					height: 58,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				{/* Logo */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 9,
						flexShrink: 0,
					}}
				>
					<div
						style={{
							width: 30,
							height: 30,
							borderRadius: 9,
							background: T.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							boxShadow: `0 0 18px ${T.accentGlow}`,
						}}
					>
						<svg fill="none" height="16" viewBox="0 0 24 24" width="16">
							<title>MD</title>
							<path
								d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.03-1.3A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
								fill="white"
							/>
							<path
								d="M8 11h8M8 14.5h5"
								stroke={T.accent}
								strokeLinecap="round"
								strokeWidth="1.6"
							/>
						</svg>
					</div>
					<span
						style={{
							fontFamily: T.body,
							fontWeight: 700,
							fontSize: 15,
							color: T.text,
							letterSpacing: "-0.025em",
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
									fontSize: 13.5,
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

				{/* Desktop CTA */}
				{!mobile && (
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<Link
							style={{
								fontSize: 13.5,
								fontWeight: 600,
								color: T.textSub,
								padding: "7px 14px",
								borderRadius: 8,
								fontFamily: T.body,
							}}
							to="/login"
						>
							Sign in
						</Link>
						<Link
							style={{
								fontSize: 13.5,
								fontWeight: 700,
								color: "#fff",
								background: T.accent,
								padding: "8px 18px",
								borderRadius: 9,
								boxShadow: `0 0 18px ${T.accentGlow}`,
								fontFamily: T.body,
							}}
							to="/register"
						>
							Get started →
						</Link>
					</div>
				)}

				{/* Mobile hamburger */}
				{mobile && (
					<button
						onClick={() => setOpen((o) => !o)}
						style={{
							background: "none",
							border: `1px solid ${T.border}`,
							borderRadius: 8,
							color: T.text,
							padding: "6px 10px",
							cursor: "pointer",
							fontFamily: T.body,
							fontSize: 18,
						}}
					>
						☰
					</button>
				)}
			</div>

			{/* Mobile menu */}
			{mobile && open && (
				<div
					style={{
						background: "rgba(8,11,18,0.98)",
						backdropFilter: "blur(20px)",
						borderBottom: `1px solid ${T.border}`,
						padding: "16px 20px 20px",
						display: "flex",
						flexDirection: "column",
						gap: 12,
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
								padding: "8px 0",
							}}
						>
							{l}
						</a>
					))}
					<div
						style={{
							display: "flex",
							gap: 10,
							paddingTop: 8,
							borderTop: `1px solid ${T.border}`,
						}}
					>
						<Link
							onClick={() => setOpen(false)}
							style={{
								flex: 1,
								textAlign: "center",
								padding: "10px",
								borderRadius: 9,
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
								padding: "10px",
								borderRadius: 9,
								background: T.accent,
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
	const mobile = useIsMobile();
	const tablet = useIsTablet();

	return (
		<section
			style={{
				position: "relative",
				overflow: "hidden",
				paddingTop: mobile ? 48 : 72,
			}}
		>
			{/* Subtle grid */}
			<div
				aria-hidden
				style={{
					position: "absolute",
					inset: 0,
					pointerEvents: "none",
					backgroundImage: `linear-gradient(${T.borderSub} 1px,transparent 1px),linear-gradient(90deg,${T.borderSub} 1px,transparent 1px)`,
					backgroundSize: "64px 64px",
					maskImage:
						"radial-gradient(ellipse 80% 55% at 50% 0%,black 30%,transparent 100%)",
				}}
			/>
			{/* Glow */}
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: -150,
					left: "50%",
					transform: "translateX(-50%)",
					width: 800,
					height: 600,
					pointerEvents: "none",
					background: `radial-gradient(ellipse at 50% 0%,${T.accentLo} 0%,transparent 68%)`,
				}}
			/>

			<div
				style={{
					maxWidth: 1120,
					margin: "0 auto",
					padding: `0 ${mobile ? 18 : 28}px`,
					position: "relative",
				}}
			>
				{/* Headline block */}
				<div
					className="fu"
					style={{
						textAlign: "center",
						maxWidth: 820,
						margin: "0 auto",
						paddingBottom: mobile ? 36 : 48,
					}}
				>
					<Badge>WhatsApp &amp; SMS for churches &amp; nonprofits</Badge>
					<h1
						style={{
							fontFamily: T.display,
							fontSize: mobile
								? "clamp(38px,11vw,56px)"
								: "clamp(52px,7vw,88px)",
							fontWeight: 400,
							fontStyle: "italic",
							lineHeight: 1.04,
							letterSpacing: "-0.025em",
							color: T.text,
							marginTop: 24,
						}}
					>
						Reach every member.
						<br />
						<span style={{ color: T.accent }}>Both channels.</span>
						<br />
						<span
							style={{
								fontStyle: "normal",
								fontWeight: 300,
								fontSize: "0.66em",
								color: T.textSub,
							}}
						>
							One platform.
						</span>
					</h1>
					<p
						style={{
							fontFamily: T.body,
							fontSize: mobile ? 15 : 17,
							lineHeight: 1.72,
							color: T.textSub,
							maxWidth: 500,
							margin: "20px auto 0",
						}}
					>
						Send personalised WhatsApp campaigns and SMS blasts to your
						congregation — AI-assisted import, pre-built templates, real-time
						tracking.
					</p>
					<div
						className="fu2"
						style={{
							marginTop: 32,
							display: "flex",
							gap: 10,
							justifyContent: "center",
							flexWrap: "wrap",
							alignItems: "center",
						}}
					>
						<Link
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 8,
								fontFamily: T.body,
								fontSize: 15,
								fontWeight: 700,
								color: "#fff",
								background: T.accent,
								padding: "13px 26px",
								borderRadius: 11,
								boxShadow: `0 0 28px ${T.accentGlow}`,
								width: mobile ? "100%" : "auto",
								justifyContent: "center",
							}}
							to="/register"
						>
							Start free <ArrowRight size={15} />
						</Link>
						<Link
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 7,
								fontFamily: T.body,
								fontSize: 14,
								fontWeight: 500,
								color: T.textSub,
								background: "rgba(255,255,255,0.04)",
								border: `1px solid ${T.borderSub}`,
								padding: "13px 22px",
								borderRadius: 11,
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
							marginTop: 14,
						}}
					>
						No credit card · Live in 5 minutes · Nigerian pricing (₦)
					</p>
				</div>

				{/* Stats row */}
				<div
					className="fu2"
					style={{
						display: "flex",
						justifyContent: "center",
						gap: mobile ? 28 : 56,
						marginBottom: 44,
						flexWrap: "wrap",
					}}
				>
					<Counter end={48_291} label="messages sent" />
					<Counter end={2847} label="active contacts" />
					<Counter end={134} label="campaigns run" />
					<Counter end={6} label="per SMS" prefix="₦" />
				</div>

				{/* Product chrome */}
				{!mobile && (
					<div className="fu3" style={{ position: "relative" }}>
						<div
							aria-hidden
							style={{
								position: "absolute",
								bottom: 0,
								left: 0,
								right: 0,
								height: 180,
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
									minHeight: 340,
								}}
							>
								{/* Inbox side */}
								<div
									style={{
										borderRight: tablet ? "none" : `1px solid ${T.borderSub}`,
										padding: "14px 6px",
									}}
								>
									<div
										style={{
											padding: "0 12px 10px",
											borderBottom: `1px solid ${T.borderSub}`,
											marginBottom: 6,
										}}
									>
										<p
											style={{
												fontFamily: T.mono,
												fontSize: 10,
												color: T.textSub,
											}}
										>
											LIVE · Inbox
										</p>
									</div>
									<MessageStream />
								</div>
								{/* Campaigns side */}
								{!tablet && (
									<div style={{ padding: "14px 16px" }}>
										<p
											style={{
												fontFamily: T.mono,
												fontSize: 10,
												color: T.textSub,
												marginBottom: 12,
											}}
										>
											CAMPAIGNS · Recent
										</p>
										<div
											style={{
												display: "flex",
												flexDirection: "column",
												gap: 7,
											}}
										>
											{[
												{
													name: "Sunday Service Invite",
													ch: "WhatsApp",
													sent: 842,
													pct: 96,
													done: true,
												},
												{
													name: "First-Timer Welcome",
													ch: "SMS + WA",
													sent: 156,
													pct: 48,
													done: false,
												},
												{
													name: "Easter Announcement",
													ch: "WhatsApp",
													sent: 1203,
													pct: 100,
													done: true,
												},
												{
													name: "Harvest Festival Invite",
													ch: "SMS",
													sent: 389,
													pct: 72,
													done: false,
												},
											].map((c) => (
												<div
													key={c.name}
													style={{
														borderRadius: 8,
														border: `1px solid ${T.borderSub}`,
														background: T.bgCardHi,
														padding: "9px 11px",
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
																	fontSize: 11.5,
																	fontWeight: 600,
																	color: T.text,
																}}
															>
																{c.name}
															</p>
															<p
																style={{
																	fontFamily: T.mono,
																	fontSize: 9,
																	color: T.textSub,
																	marginTop: 1,
																}}
															>
																{c.ch} · {c.sent.toLocaleString()} sent
															</p>
														</div>
														<div
															style={{
																padding: "2px 7px",
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
																	color: c.done ? T.green : "#f59e0b",
																	fontWeight: 700,
																}}
															>
																{c.done ? "DONE" : "LIVE"}
															</span>
														</div>
													</div>
													<div
														style={{
															marginTop: 7,
															height: 2.5,
															borderRadius: 100,
															background: "rgba(255,255,255,0.05)",
														}}
													>
														<div
															style={{
																height: "100%",
																width: `${c.pct}%`,
																borderRadius: 100,
																background: c.done ? T.green : "#f59e0b",
																transition: "width 1.4s ease",
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
	const mobile = useIsMobile();
	const orgs = [
		"RCCG",
		"Winners Chapel",
		"CAC",
		"Living Faith Church",
		"Nigerian Red Cross",
		"SU Nigeria",
		"ECWA",
		"Deeper Life",
	];
	return (
		<section
			style={{ padding: `${mobile ? 40 : 52}px ${mobile ? 18 : 28}px 40px` }}
		>
			<p
				style={{
					fontFamily: T.mono,
					fontSize: 10,
					color: T.textDim,
					letterSpacing: "0.18em",
					textTransform: "uppercase",
					textAlign: "center",
					marginBottom: 18,
				}}
			>
				Trusted by faith &amp; nonprofit organisations across Nigeria
			</p>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "8px 28px",
					justifyContent: "center",
				}}
			>
				{orgs.map((o) => (
					<span
						key={o}
						style={{
							fontFamily: T.body,
							fontSize: 13,
							fontWeight: 600,
							color: T.textDim,
						}}
					>
						{o}
					</span>
				))}
			</div>
		</section>
	);
}

// ─── Problem ──────────────────────────────────────────────────────────────────

function Problem() {
	const mobile = useIsMobile();
	return (
		<section style={{ padding: `80px ${mobile ? 18 : 28}px` }}>
			<Divider />
			<div
				style={{
					maxWidth: 1120,
					margin: "0 auto",
					paddingTop: 80,
					display: "grid",
					gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
					gap: mobile ? 44 : 80,
					alignItems: "center",
				}}
			>
				<div>
					<SectionLabel>The Problem</SectionLabel>
					<h2
						style={{
							fontFamily: T.display,
							fontSize: mobile
								? "clamp(26px,7vw,44px)"
								: "clamp(28px,3.5vw,50px)",
							fontStyle: "italic",
							color: T.text,
							lineHeight: 1.1,
							letterSpacing: "-0.02em",
						}}
					>
						Your people are on WhatsApp.
						<br />
						Your outreach is stuck in email blasts.
					</h2>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
					{[
						{
							icon: "📧",
							title: "Email open rates are dying",
							body: "Average church email: 18% open rate. Average WhatsApp: 98%. The math is obvious.",
						},
						{
							icon: "🕐",
							title: "Manual messaging takes hours",
							body: "Copy-pasting names into individual WhatsApp chats, cross-checking spreadsheets — that's your Sunday afternoon gone.",
						},
						{
							icon: "💸",
							title: "Generic bulk SMS has no context",
							body: "Most platforms can't distinguish a first-timer welcome from a follow-up. Every message reads like a broadcast.",
						},
					].map((p) => (
						<div
							key={p.title}
							style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
						>
							<div
								style={{
									width: 40,
									height: 40,
									borderRadius: 10,
									flexShrink: 0,
									background: T.accentLo,
									border: `1px solid ${T.border}`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 18,
								}}
							>
								{p.icon}
							</div>
							<div>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 14,
										fontWeight: 600,
										color: T.text,
										marginBottom: 4,
									}}
								>
									{p.title}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 13,
										color: T.textSub,
										lineHeight: 1.65,
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

// ─── Feature rows ─────────────────────────────────────────────────────────────

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
	const mobile = useIsMobile();
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
				gap: mobile ? 36 : 64,
				alignItems: "center",
				padding: `${mobile ? 52 : 72}px 0`,
			}}
		>
			<div style={{ order: mobile ? 0 : flip ? 1 : 0 }}>
				<SectionLabel>{eyebrow}</SectionLabel>
				<h3
					style={{
						fontFamily: T.display,
						fontSize: mobile
							? "clamp(22px,6vw,38px)"
							: "clamp(22px,2.8vw,40px)",
						fontStyle: "italic",
						color: T.text,
						lineHeight: 1.13,
						letterSpacing: "-0.02em",
						marginBottom: 16,
					}}
				>
					{headline}
				</h3>
				<p
					style={{
						fontFamily: T.body,
						fontSize: 14,
						color: T.textSub,
						lineHeight: 1.75,
						marginBottom: 22,
					}}
				>
					{desc}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					{bullets.map((b) => (
						<div
							key={b}
							style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
						>
							<CheckCircle2
								color={T.accent}
								size={14}
								style={{ flexShrink: 0, marginTop: 2 }}
							/>
							<span
								style={{
									fontFamily: T.body,
									fontSize: 13.5,
									color: "rgba(241,243,249,0.72)",
								}}
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
	return (
		<AppChrome url="app.messagedesk.io/campaigns/create">
			<div style={{ padding: 18 }}>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 10,
						color: T.textSub,
						marginBottom: 12,
					}}
				>
					NEW CAMPAIGN · Step 2 of 4
				</p>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: 7,
						marginBottom: 14,
					}}
				>
					{[
						{ icon: "✨", label: "First-Timer Welcome", active: true },
						{ icon: "🔄", label: "Follow-Up", active: false },
						{ icon: "🎉", label: "Event Invitation", active: false },
						{ icon: "📢", label: "Announcement", active: false },
					].map((s) => (
						<div
							key={s.label}
							style={{
								borderRadius: 8,
								border: `1px solid ${s.active ? T.border : T.borderSub}`,
								background: s.active ? T.accentLo : "transparent",
								padding: "9px 11px",
								display: "flex",
								alignItems: "center",
								gap: 8,
							}}
						>
							<span style={{ fontSize: 13 }}>{s.icon}</span>
							<span
								style={{
									fontFamily: T.body,
									fontSize: 11,
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
						borderRadius: 8,
						border: `1px solid ${T.border}`,
						background: T.accentLo,
						padding: "11px 13px",
					}}
				>
					<p
						style={{
							fontFamily: T.mono,
							fontSize: 9,
							color: T.accent,
							marginBottom: 5,
						}}
					>
						PREVIEW · WhatsApp
					</p>
					<p
						style={{
							fontFamily: T.body,
							fontSize: 12,
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
								padding: "0 4px",
								color: T.accent,
							}}
						>
							Emeka
						</span>
						! 🎉 Welcome to Grace Assembly. We're so glad you joined us last
						Sunday. Here's what's on this week...
					</p>
				</div>
				<div
					style={{
						marginTop: 11,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span style={{ fontFamily: T.body, fontSize: 11, color: T.textSub }}>
						347 recipients selected
					</span>
					<div
						style={{
							padding: "6px 13px",
							borderRadius: 8,
							background: T.accent,
							display: "inline-flex",
							alignItems: "center",
							gap: 5,
							boxShadow: `0 0 14px ${T.accentGlow}`,
						}}
					>
						<Send color="#fff" size={11} />
						<span
							style={{
								fontFamily: T.body,
								fontSize: 11,
								fontWeight: 700,
								color: "#fff",
							}}
						>
							Send
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
		const t = setInterval(() => setStep((s) => (s + 1) % 3), 2200);
		return () => clearInterval(t);
	}, []);
	const contacts = [
		{ name: "Chidera Obi", phone: "+234 803 456 7890", ch: "WhatsApp" },
		{ name: "Blessing Nwosu", phone: "+234 701 234 5678", ch: "SMS" },
		{ name: "Emeka Eze", phone: "+234 815 678 9012", ch: "WhatsApp" },
		{ name: "Adaeze Chukwu", phone: "+234 803 901 2345", ch: "WhatsApp" },
	];
	return (
		<AppChrome url="app.messagedesk.io/contacts/import">
			<div style={{ padding: 18 }}>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 10,
						color: T.textSub,
						marginBottom: 12,
					}}
				>
					AI IMPORT ·{" "}
					{step === 0
						? "Uploading..."
						: step === 1
							? "Parsing with Gemini AI..."
							: "✓ 4 contacts found"}
				</p>
				<div
					style={{
						height: 3,
						borderRadius: 100,
						background: "rgba(255,255,255,0.06)",
						marginBottom: 14,
					}}
				>
					<div
						style={{
							height: "100%",
							width: `${step === 0 ? 28 : step === 1 ? 68 : 100}%`,
							borderRadius: 100,
							background: T.accent,
							transition: "width 0.9s ease",
						}}
					/>
				</div>
				{step === 2 ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						{contacts.map((c) => (
							<div
								key={c.name}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 10,
									borderRadius: 7,
									border: `1px solid ${T.borderSub}`,
									background: T.bgCardHi,
									padding: "7px 10px",
								}}
							>
								<div
									style={{
										width: 26,
										height: 26,
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
											fontSize: 10,
											fontWeight: 700,
											color: T.accent,
										}}
									>
										{c.name[0]}
									</span>
								</div>
								<div style={{ flex: 1 }}>
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
											fontSize: 9,
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
										padding: "2px 6px",
										borderRadius: 4,
										color: c.ch === "WhatsApp" ? T.accent : T.violet,
										background:
											c.ch === "WhatsApp" ? T.accentLo : "rgba(139,92,246,0.1)",
									}}
								>
									{c.ch}
								</span>
							</div>
						))}
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								style={{
									height: 36,
									borderRadius: 7,
									border: `1px solid ${T.borderSub}`,
									background:
										"linear-gradient(90deg,#0e1420 25%,#161e2e 50%,#0e1420 75%)",
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
	return (
		<AppChrome url="app.messagedesk.io/campaigns/123/prescreen">
			<div style={{ padding: 18 }}>
				<p
					style={{
						fontFamily: T.mono,
						fontSize: 10,
						color: T.textSub,
						marginBottom: 12,
					}}
				>
					CONSENT FLOW · Prescreen mode
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
					{[
						{
							label: "1. Consent message sent",
							note: "₦8 × 500 = ₦4,000",
							color: "#f59e0b",
							done: true,
						},
						{
							label: "2. Replies collected",
							note: "312 / 500 replied",
							color: T.green,
							done: true,
						},
						{
							label: "3. Full campaign to YES only",
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
								gap: 12,
								borderRadius: 8,
								padding: "8px 11px",
								border: `1px solid ${s.done ? s.color + "28" : T.borderSub}`,
								background: s.done ? s.color + "08" : "transparent",
							}}
						>
							<div
								style={{
									width: 6,
									height: 6,
									borderRadius: "50%",
									background: s.color,
									flexShrink: 0,
								}}
							/>
							<div style={{ flex: 1 }}>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 12,
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
						marginTop: 12,
						borderRadius: 8,
						background: T.accentLo,
						border: `1px solid ${T.border}`,
						padding: "9px 13px",
						display: "flex",
						justifyContent: "space-between",
					}}
				>
					<span style={{ fontFamily: T.body, fontSize: 12, color: T.text }}>
						Total spend
					</span>
					<span
						style={{
							fontFamily: T.mono,
							fontSize: 14,
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
						fontSize: 11,
						color: T.textSub,
						marginTop: 6,
						textAlign: "center",
					}}
				>
					vs ₦45,000 direct — saved 29%
				</p>
			</div>
		</AppChrome>
	);
}

function Features() {
	const mobile = useIsMobile();
	return (
		<section
			id="features"
			style={{
				maxWidth: 1120,
				margin: "0 auto",
				padding: `0 ${mobile ? 18 : 28}px 40px`,
			}}
		>
			<Divider />
			<div style={{ paddingTop: 80, textAlign: "center", marginBottom: 12 }}>
				<SectionLabel>Features</SectionLabel>
				<h2
					style={{
						fontFamily: T.display,
						fontSize: mobile ? "clamp(26px,7vw,44px)" : "clamp(28px,4vw,54px)",
						fontStyle: "italic",
						color: T.text,
						lineHeight: 1.1,
						letterSpacing: "-0.025em",
					}}
				>
					Everything your outreach team needs.
				</h2>
			</div>
			<FeatureRow
				bullets={[
					"5 pre-built scenarios: Welcome, Follow-up, Event, Care, Announcement",
					"WhatsApp + SMS in the same campaign",
					"Live progress tracking as messages send",
				]}
				desc="Pick a scenario, select recipients, and MessageDesk does the rest — personalising every message with the contact's name, your org, and custom variables."
				eyebrow="Campaigns"
				headline="Send to thousands. Every message feels personal."
				mockup={<MockupCampaign />}
			/>
			<Divider />
			<FeatureRow
				bullets={[
					"Accepts .xlsx, .csv, .pdf, .jpg, .png",
					"Auto-detects WhatsApp vs SMS contacts",
					"Handles messy, unstructured, real-world data",
				]}
				desc="Upload an Excel file, PDF, or even a photo of a printed list. Gemini AI extracts names and phone numbers and maps them to the right channel automatically."
				eyebrow="AI Contact Import"
				flip
				headline="Drop a spreadsheet. Contacts appear."
				mockup={<MockupImport />}
			/>
			<Divider />
			<FeatureRow
				bullets={[
					"Consent message at ₦8 (vs ₦90 direct WhatsApp)",
					"Automatic fan-out to replies only",
					"Full audit trail and spend comparison",
				]}
				desc="Send an inexpensive utility message first. Only contacts who reply receive the full marketing message — pay only for engaged recipients."
				eyebrow="Consent Flow"
				headline="Save up to 40% on large campaigns."
				mockup={<MockupConsent />}
			/>
		</section>
	);
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
	const mobile = useIsMobile();
	const steps = [
		{
			n: "01",
			icon: <Users color={T.accent} size={18} />,
			title: "Import your contacts",
			body: "Drop a spreadsheet, paste a list, or type manually. AI fills in the gaps — no formatting required.",
		},
		{
			n: "02",
			icon: <Sparkles color={T.accent} size={18} />,
			title: "Choose a scenario",
			body: "Pick from Welcome, Follow-up, Event, Care, or Announcement. Templates are pre-filled for your org type.",
		},
		{
			n: "03",
			icon: <Zap color={T.accent} size={18} />,
			title: "Review and send",
			body: "Preview each message, confirm cost, hit send. 10,000 personalised messages dispatched in seconds.",
		},
		{
			n: "04",
			icon: <MessageCircle color={T.accent} size={18} />,
			title: "Track replies live",
			body: "Watch your campaign dashboard fill up in real time. Reply to responses directly from the inbox.",
		},
	];
	return (
		<section
			id="how-it-works"
			style={{ padding: `80px ${mobile ? 18 : 28}px` }}
		>
			<Divider />
			<div style={{ maxWidth: 1120, margin: "0 auto", paddingTop: 80 }}>
				<SectionLabel>How it works</SectionLabel>
				<h2
					style={{
						fontFamily: T.display,
						fontSize: mobile ? "clamp(26px,7vw,44px)" : "clamp(28px,4vw,52px)",
						fontStyle: "italic",
						color: T.text,
						lineHeight: 1.1,
						letterSpacing: "-0.025em",
						marginBottom: 52,
						maxWidth: 520,
					}}
				>
					Zero to 10,000 recipients in 4 steps.
				</h2>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: mobile
							? "1fr"
							: "repeat(auto-fill,minmax(230px,1fr))",
						gap: 20,
					}}
				>
					{steps.map((s) => (
						<div key={s.n}>
							<p
								aria-hidden
								style={{
									fontFamily: T.mono,
									fontSize: 80,
									fontWeight: 900,
									color: "rgba(99,102,241,0.06)",
									lineHeight: 1,
									letterSpacing: "-0.06em",
									marginBottom: -12,
								}}
							>
								{s.n}
							</p>
							<div
								style={{
									borderRadius: 14,
									border: `1px solid ${T.border}`,
									background: T.bgCard,
									padding: "20px 22px 22px",
								}}
							>
								<div
									style={{
										width: 36,
										height: 36,
										borderRadius: 9,
										background: T.accentLo,
										border: `1px solid ${T.border}`,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										marginBottom: 14,
									}}
								>
									{s.icon}
								</div>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 15,
										fontWeight: 700,
										color: T.text,
										marginBottom: 8,
										letterSpacing: "-0.02em",
									}}
								>
									{s.title}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 13,
										color: T.textSub,
										lineHeight: 1.65,
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
	const mobile = useIsMobile();
	const included = [
		"WhatsApp marketing + utility campaigns",
		"SMS via Termii (alphanumeric sender ID)",
		"AI contact import — PDF, Excel, images",
		"Personalised templates per scenario",
		"Consent flow — pay only for engaged replies",
		"Real-time campaign dashboard",
		"Message inbox with reply support",
		"Custom sender ID registration",
	];
	return (
		<section id="pricing" style={{ padding: `80px ${mobile ? 18 : 28}px` }}>
			<Divider />
			<div style={{ maxWidth: 1120, margin: "0 auto", paddingTop: 80 }}>
				<SectionLabel>Pricing</SectionLabel>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
						gap: mobile ? 40 : 64,
						alignItems: "start",
					}}
				>
					<div>
						<h2
							style={{
								fontFamily: T.display,
								fontSize: mobile
									? "clamp(26px,7vw,44px)"
									: "clamp(28px,3.5vw,48px)",
								fontStyle: "italic",
								color: T.text,
								lineHeight: 1.1,
								letterSpacing: "-0.025em",
							}}
						>
							No subscriptions.
							<br />
							Pay only for what you send.
						</h2>
						<p
							style={{
								fontFamily: T.body,
								fontSize: 14,
								color: T.textSub,
								lineHeight: 1.75,
								marginTop: 18,
								marginBottom: 28,
							}}
						>
							Top up your wallet in Naira and spend as you go. No monthly fees,
							no seat limits, no commitment.
						</p>
						<div
							style={{
								borderRadius: 12,
								border: `1px solid ${T.border}`,
								overflow: "hidden",
								marginBottom: 24,
							}}
						>
							{[
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
								{
									ch: "📱 SMS (Termii)",
									cost: "₦6",
									note: "Per message, any network",
								},
								{
									ch: "🔔 Consent (Prescreen)",
									cost: "₦8",
									note: "Utility template, pre-send",
								},
							].map((r, i) => (
								<div
									key={r.ch}
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										padding: "13px 16px",
										borderBottom: i < 3 ? `1px solid ${T.borderSub}` : "none",
										background:
											i % 2 === 0 ? "transparent" : "rgba(99,102,241,0.03)",
									}}
								>
									<div>
										<p
											style={{
												fontFamily: T.body,
												fontSize: 13,
												fontWeight: 600,
												color: T.text,
											}}
										>
											{r.ch}
										</p>
										<p
											style={{
												fontFamily: T.body,
												fontSize: 11,
												color: T.textSub,
												marginTop: 1,
											}}
										>
											{r.note}
										</p>
									</div>
									<p
										style={{
											fontFamily: T.mono,
											fontSize: 18,
											fontWeight: 700,
											color: r.cost === "Free" ? T.green : T.accent,
										}}
									>
										{r.cost}
									</p>
								</div>
							))}
						</div>
						<Link
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 8,
								fontFamily: T.body,
								fontSize: 14,
								fontWeight: 700,
								color: "#fff",
								background: T.accent,
								padding: "12px 22px",
								borderRadius: 10,
								boxShadow: `0 0 20px ${T.accentGlow}`,
								width: mobile ? "100%" : "auto",
								justifyContent: "center",
							}}
							to="/register"
						>
							Start for free <ArrowRight size={14} />
						</Link>
					</div>

					<div
						style={{
							borderRadius: 16,
							border: `1px solid ${T.border}`,
							background: T.bgCard,
							padding: 30,
						}}
					>
						<p
							style={{
								fontFamily: T.mono,
								fontSize: 10,
								color: T.textSub,
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								marginBottom: 18,
							}}
						>
							Everything included
						</p>
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							{included.map((f) => (
								<div
									key={f}
									style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
								>
									<CheckCircle2
										color={T.accent}
										size={14}
										style={{ flexShrink: 0, marginTop: 1 }}
									/>
									<span
										style={{
											fontFamily: T.body,
											fontSize: 13.5,
											color: "rgba(241,243,249,0.72)",
											lineHeight: 1.45,
										}}
									>
										{f}
									</span>
								</div>
							))}
						</div>
						<div
							style={{
								marginTop: 26,
								paddingTop: 22,
								borderTop: `1px solid ${T.borderSub}`,
							}}
						>
							<p
								style={{
									fontFamily: T.mono,
									fontSize: 10,
									color: T.textSub,
									marginBottom: 12,
								}}
							>
								EXAMPLE: 500 MEMBERS, WEEKLY MESSAGE
							</p>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<div>
									<p
										style={{
											fontFamily: T.body,
											fontSize: 12,
											color: T.textSub,
										}}
									>
										Direct WhatsApp
									</p>
									<p
										style={{
											fontFamily: T.mono,
											fontSize: 20,
											fontWeight: 700,
											color: "#ef4444",
										}}
									>
										₦45,000
									</p>
								</div>
								<p
									style={{ fontFamily: T.mono, fontSize: 18, color: T.textSub }}
								>
									→
								</p>
								<div style={{ textAlign: "right" }}>
									<p
										style={{
											fontFamily: T.body,
											fontSize: 12,
											color: T.textSub,
										}}
									>
										With Consent Flow
									</p>
									<p
										style={{
											fontFamily: T.mono,
											fontSize: 20,
											fontWeight: 700,
											color: T.accent,
										}}
									>
										~₦16,400
									</p>
								</div>
							</div>
							<p
								style={{
									fontFamily: T.body,
									fontSize: 11,
									color: T.textSub,
									marginTop: 8,
									textAlign: "center",
								}}
							>
								Assumes 60% reply rate · saves ₦28,600 per send
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
	const mobile = useIsMobile();
	const quotes = [
		{
			quote:
				"We used to spend two hours every Sunday morning copying names into WhatsApp. Now it takes 4 minutes. The whole team is relieved.",
			name: "Pastor Adebayo O.",
			role: "Senior Pastor",
			org: "Grace Assembly Lagos",
		},
		{
			quote:
				"The consent flow alone saved us ₦80,000 last month. We only send the full message to people who actually want it.",
			name: "Sister Ngozi A.",
			role: "Communications Lead",
			org: "St. Joseph Catholic Parish",
		},
		{
			quote:
				"I uploaded a photo of our old attendance register. MessageDesk parsed out 143 names with phone numbers in 30 seconds.",
			name: "Deacon Emmanuel T.",
			role: "Youth Coordinator",
			org: "RCCG City of David",
		},
	];
	return (
		<section style={{ padding: `80px ${mobile ? 18 : 28}px` }}>
			<Divider />
			<div style={{ maxWidth: 1120, margin: "0 auto", paddingTop: 80 }}>
				<SectionLabel>Testimonials</SectionLabel>
				<h2
					style={{
						fontFamily: T.display,
						fontSize: mobile ? "clamp(26px,7vw,44px)" : "clamp(28px,4vw,50px)",
						fontStyle: "italic",
						color: T.text,
						lineHeight: 1.1,
						letterSpacing: "-0.025em",
						marginBottom: 44,
					}}
				>
					What church leaders say.
				</h2>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: mobile
							? "1fr"
							: "repeat(auto-fill,minmax(280px,1fr))",
						gap: 20,
					}}
				>
					{quotes.map((q, i) => (
						<div
							key={i}
							style={{
								borderRadius: 14,
								border: `1px solid ${T.border}`,
								background: T.bgCard,
								padding: "24px 24px 20px",
								display: "flex",
								flexDirection: "column",
								gap: 16,
							}}
						>
							<div style={{ display: "flex", gap: 2 }}>
								{[1, 2, 3, 4, 5].map((s) => (
									<span key={s} style={{ color: "#f59e0b", fontSize: 13 }}>
										★
									</span>
								))}
							</div>
							<p
								style={{
									fontFamily: T.body,
									fontSize: 14.5,
									color: T.text,
									lineHeight: 1.7,
									letterSpacing: "-0.01em",
									flex: 1,
								}}
							>
								"{q.quote}"
							</p>
							<div
								style={{
									borderTop: `1px solid ${T.borderSub}`,
									paddingTop: 14,
								}}
							>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 13,
										fontWeight: 700,
										color: T.text,
									}}
								>
									{q.name}
								</p>
								<p
									style={{
										fontFamily: T.body,
										fontSize: 12,
										color: T.textSub,
										marginTop: 2,
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
	const mobile = useIsMobile();
	return (
		<section style={{ padding: `80px ${mobile ? 18 : 28}px 100px` }}>
			<div style={{ maxWidth: 1120, margin: "0 auto" }}>
				<div
					style={{
						borderRadius: 20,
						position: "relative",
						overflow: "hidden",
						background:
							"linear-gradient(140deg,rgba(99,102,241,0.18) 0%,rgba(139,92,246,0.1) 50%,rgba(8,11,18,0) 80%)",
						border: `1px solid ${T.border}`,
						padding: mobile ? "60px 24px" : "80px 60px",
						textAlign: "center",
					}}
				>
					{/* Grid overlay */}
					<div
						aria-hidden
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							backgroundImage: `linear-gradient(${T.borderSub} 1px,transparent 1px),linear-gradient(90deg,${T.borderSub} 1px,transparent 1px)`,
							backgroundSize: "56px 56px",
							opacity: 0.5,
							maskImage:
								"radial-gradient(ellipse 70% 70% at 50% 50%,black,transparent)",
						}}
					/>
					{/* Glow */}
					<div
						aria-hidden
						style={{
							position: "absolute",
							top: -80,
							left: "50%",
							transform: "translateX(-50%)",
							width: 500,
							height: 300,
							pointerEvents: "none",
							background: `radial-gradient(ellipse at 50% 0%,${T.accentGlow} 0%,transparent 70%)`,
						}}
					/>
					<div style={{ position: "relative" }}>
						<Badge>Get started today — free</Badge>
						<h2
							style={{
								fontFamily: T.display,
								fontSize: mobile
									? "clamp(30px,9vw,52px)"
									: "clamp(36px,5vw,68px)",
								fontStyle: "italic",
								color: T.text,
								lineHeight: 1.04,
								letterSpacing: "-0.025em",
								marginTop: 24,
								marginBottom: 16,
							}}
						>
							Your congregation is waiting
							<br />
							to hear from you.
						</h2>
						<p
							style={{
								fontFamily: T.body,
								fontSize: 16,
								color: T.textSub,
								maxWidth: 440,
								margin: "0 auto 36px",
							}}
						>
							Set up in under 5 minutes. No technical knowledge needed. Nigerian
							pricing in Naira.
						</p>
						<div
							style={{
								display: "flex",
								gap: 12,
								justifyContent: "center",
								flexWrap: "wrap",
							}}
						>
							<Link
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 8,
									fontFamily: T.body,
									fontSize: 15,
									fontWeight: 700,
									color: "#fff",
									background: T.accent,
									padding: "14px 30px",
									borderRadius: 12,
									boxShadow: `0 0 32px ${T.accentGlow}`,
									width: mobile ? "100%" : "auto",
									justifyContent: "center",
								}}
								to="/register"
							>
								Create free account <ArrowRight size={16} />
							</Link>
							<Link
								style={{
									display: "inline-flex",
									alignItems: "center",
									fontFamily: T.body,
									fontSize: 14,
									fontWeight: 500,
									color: T.textSub,
									background: "rgba(255,255,255,0.04)",
									border: `1px solid ${T.borderSub}`,
									padding: "14px 22px",
									borderRadius: 12,
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
	const mobile = useIsMobile();
	return (
		<footer
			style={{
				borderTop: `1px solid ${T.borderSub}`,
				padding: `48px ${mobile ? 18 : 28}px 40px`,
				position: "relative",
				overflow: "hidden",
			}}
		>
			<p
				aria-hidden
				style={{
					position: "absolute",
					bottom: -20,
					left: "50%",
					transform: "translateX(-50%)",
					fontFamily: T.display,
					fontSize: "clamp(64px,13vw,190px)",
					fontStyle: "italic",
					fontWeight: 400,
					color: "rgba(99,102,241,0.04)",
					whiteSpace: "nowrap",
					pointerEvents: "none",
					letterSpacing: "-0.04em",
					lineHeight: 1,
				}}
			>
				MessageDesk
			</p>
			<div style={{ maxWidth: 1120, margin: "0 auto", position: "relative" }}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						flexWrap: "wrap",
						gap: 32,
						marginBottom: 40,
					}}
				>
					<div style={{ maxWidth: 240 }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 9,
								marginBottom: 12,
							}}
						>
							<div
								style={{
									width: 28,
									height: 28,
									borderRadius: 8,
									background: T.accent,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<svg fill="none" height="15" viewBox="0 0 24 24" width="15">
									<title>MD</title>
									<path
										d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.03-1.3A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
										fill="white"
									/>
									<path
										d="M8 11h8M8 14.5h5"
										stroke={T.accent}
										strokeLinecap="round"
										strokeWidth="1.6"
									/>
								</svg>
							</div>
							<span
								style={{
									fontFamily: T.body,
									fontWeight: 700,
									fontSize: 15,
									color: T.text,
								}}
							>
								MessageDesk
							</span>
						</div>
						<p
							style={{
								fontFamily: T.body,
								fontSize: 13,
								color: T.textSub,
								lineHeight: 1.65,
							}}
						>
							WhatsApp and SMS messaging for churches and nonprofits in Nigeria.
						</p>
					</div>
					<div
						style={{ display: "flex", gap: mobile ? 32 : 56, flexWrap: "wrap" }}
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
										letterSpacing: "0.12em",
										textTransform: "uppercase",
										marginBottom: 14,
									}}
								>
									{col.heading}
								</p>
								<div
									style={{ display: "flex", flexDirection: "column", gap: 9 }}
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
												fontSize: 13,
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
						paddingTop: 18,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						flexWrap: "wrap",
						gap: 10,
					}}
				>
					<p style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
						© 2025 MessageDesk. Built for Nigerian faith communities.
					</p>
					<div style={{ display: "flex", gap: 18 }}>
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
	return (
		<>
			<FontLoader />
			<div
				style={{
					minHeight: "100vh",
					background: T.bg,
					color: T.text,
					fontFamily: T.body,
					width: "100%",
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
