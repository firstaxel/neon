import { CheckCircle2, Loader2, Sparkles, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import {
	useCancelSubscription,
	useInitSubscription,
	useSubscription,
} from "#/features/billing/hooks/use-billing";

const COLORS: Record<string, { accent: string; bg: string; border: string }> = {
	growth: { accent: "#a78bfa", bg: "#1a0d2e", border: "#a78bfa30" },
	pro: { accent: "#f59e0b", bg: "#1a1200", border: "#f59e0b30" },
	starter: { accent: "#60a5fa", bg: "#0d1a2e", border: "#60a5fa30" },
};

const FEATURES: Record<string, string[]> = {
	growth: [
		"Up to 2,000 messages/month",
		"WhatsApp + SMS",
		"Campaign history",
		"Priority support",
	],
	pro: [
		"Unlimited messages",
		"WhatsApp + SMS",
		"Campaign history",
		"Dedicated support",
		"Analytics",
	],
	starter: ["Up to 500 messages/month", "WhatsApp + SMS", "Campaign history"],
};

export function SubscriptionCard() {
	const { data, isLoading } = useSubscription();
	const { mutateAsync: initSub, isPending: subPending } = useInitSubscription();
	const { mutateAsync: cancelSub, isPending: cancelPending } =
		useCancelSubscription();
	const [cancelConfirm, setCancelConfirm] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const sub = data?.subscription;
	const plans = data?.plans ?? [];

	async function handleSubscribe(planKey: string) {
		setError(null);
		try {
			const result = await initSub({
				callbackUrl: `${window.location.origin}/billing/verify?type=subscription`,
				plan: planKey as "starter" | "growth" | "pro",
			});
			window.location.href = result.checkoutUrl;
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to start subscription");
		}
	}

	async function handleCancel() {
		setError(null);
		try {
			await cancelSub(undefined);
			setCancelConfirm(false);
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Failed to cancel subscription"
			);
		}
	}

	// ── Active plan ──────────────────────────────────────────────────────────────
	if (sub) {
		const c = COLORS[sub.plan] ?? COLORS.starter;
		const usagePct = Math.min(100, sub.usagePercent);
		const renewDate = new Date(sub.currentPeriodEnd).toLocaleDateString(
			"en-GB",
			{ day: "numeric", month: "long", year: "numeric" }
		);

		return (
			<div
				style={{
					background: "#0d1420",
					border: `1px solid ${c.border}`,
					borderRadius: 20,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						alignItems: "center",
						background: c.bg,
						borderBottom: `1px solid ${c.border}`,
						display: "flex",
						justifyContent: "space-between",
						padding: "16px 20px",
					}}
				>
					<div style={{ alignItems: "center", display: "flex", gap: 8 }}>
						<Sparkles color={c.accent} size={15} />
						<span
							style={{
								color: c.accent,
								fontFamily: "'Space Grotesk',sans-serif",
								fontSize: 14,
								fontWeight: 700,
								textTransform: "uppercase",
							}}
						>
							{sub.plan} Plan
						</span>
					</div>
					<span
						style={{
							background: sub.status === "active" ? "#0d2016" : "#2e0d0d",
							border: `1px solid ${sub.status === "active" ? "#25d36640" : "#f8717140"}`,
							borderRadius: 20,
							color: sub.status === "active" ? "#25d366" : "#f87171",
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: "0.05em",
							padding: "3px 8px",
							textTransform: "uppercase",
						}}
					>
						{sub.status}
					</span>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 14,
						padding: 20,
					}}
				>
					{/* Usage */}
					<div>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								marginBottom: 6,
							}}
						>
							<span style={{ color: "#8899aa", fontSize: 12 }}>
								Messages this cycle
							</span>
							<span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
								{sub.messagesUsedThisCycle.toLocaleString()} /{" "}
								{sub.monthlyMessageLimit === 999_999
									? "∞"
									: sub.monthlyMessageLimit.toLocaleString()}
							</span>
						</div>
						<div
							style={{
								background: "#1e2a3a",
								borderRadius: 99,
								height: 6,
								overflow: "hidden",
							}}
						>
							<div
								style={{
									background: usagePct > 85 ? "#f59e0b" : c.accent,
									borderRadius: 99,
									height: "100%",
									transition: "width 0.4s",
									width: `${usagePct}%`,
								}}
							/>
						</div>
						{usagePct > 85 && (
							<p style={{ color: "#f59e0b", fontSize: 11, marginTop: 5 }}>
								⚠️ Approaching monthly limit
							</p>
						)}
					</div>

					<p style={{ color: "#8899aa", fontSize: 12, margin: 0 }}>
						{sub.status === "cancelled" ? "Active until" : "Renews on"}{" "}
						<strong style={{ color: "#c8d6e5" }}>{renewDate}</strong>
					</p>

					{sub.status === "active" && !cancelConfirm && (
						<button
							onClick={() => setCancelConfirm(true)}
							style={{
								background: "none",
								border: "none",
								color: "#4a5568",
								cursor: "pointer",
								fontSize: 12,
								padding: 0,
								textAlign: "left",
								textDecoration: "underline",
							}}
							type="button"
						>
							Cancel subscription
						</button>
					)}

					{cancelConfirm && (
						<div
							style={{
								background: "#2e0d0d",
								border: "1px solid #f8717140",
								borderRadius: 12,
								display: "flex",
								flexDirection: "column",
								gap: 10,
								padding: "12px 14px",
							}}
						>
							<p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>
								Cancel your plan? Access continues until {renewDate}.
							</p>
							<div style={{ display: "flex", gap: 8 }}>
								<button
									onClick={() => setCancelConfirm(false)}
									style={{
										background: "#0a1020",
										border: "1px solid #1e2a3a",
										borderRadius: 10,
										color: "#8899aa",
										cursor: "pointer",
										flex: 1,
										fontSize: 13,
										fontWeight: 600,
										padding: "8px",
									}}
									type="button"
								>
									Keep plan
								</button>
								<button
									disabled={cancelPending}
									onClick={handleCancel}
									style={{
										alignItems: "center",
										background: "#f87171",
										border: "none",
										borderRadius: 10,
										color: "#080c14",
										cursor: cancelPending ? "not-allowed" : "pointer",
										display: "flex",
										flex: 1,
										fontSize: 13,
										fontWeight: 700,
										gap: 6,
										justifyContent: "center",
										padding: "8px",
									}}
									type="button"
								>
									{cancelPending ? (
										<>
											<Loader2
												size={13}
												style={{ animation: "spin 0.75s linear infinite" }}
											/>{" "}
											Cancelling…
										</>
									) : (
										<>
											<XCircle size={13} /> Yes, cancel
										</>
									)}
								</button>
							</div>
						</div>
					)}
					{error && (
						<p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{error}</p>
					)}
				</div>
			</div>
		);
	}

	// ── Plan picker ──────────────────────────────────────────────────────────────
	return (
		<div>
			<div style={{ marginBottom: 18 }}>
				<h2
					style={{
						color: "#e2e8f0",
						fontFamily: "'Space Grotesk',sans-serif",
						fontSize: 17,
						fontWeight: 600,
						margin: 0,
					}}
				>
					Choose a Plan
				</h2>
				<p style={{ color: "#8899aa", fontSize: 13, marginTop: 4 }}>
					Subscription gives you a monthly message allowance. Top up your wallet
					for extra sends beyond the limit.
				</p>
			</div>

			{isLoading ? (
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{[...new Array(3)].map((_, i) => (
						<div
							className="skeleton"
							key={i.toString()}
							style={{ borderRadius: 16, height: 130 }}
						/>
					))}
				</div>
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{plans.map((plan) => {
						const c = COLORS[plan.key] ?? COLORS.starter;
						const features = FEATURES[plan.key] ?? [];
						return (
							<div
								key={plan.key}
								style={{
									background: "#0a1020",
									border: `1px solid ${c.border}`,
									borderRadius: 16,
									overflow: "hidden",
								}}
							>
								<div
									style={{
										alignItems: "center",
										background: c.bg,
										display: "flex",
										justifyContent: "space-between",
										padding: "14px 16px",
									}}
								>
									<div>
										<p
											style={{
												color: c.accent,
												fontFamily: "'Space Grotesk',sans-serif",
												fontSize: 14,
												fontWeight: 700,
												margin: 0,
												textTransform: "uppercase",
											}}
										>
											{plan.label}
										</p>
										<p style={{ color: "#8899aa", fontSize: 12, marginTop: 2 }}>
											{plan.monthlyLimit} msgs/month
										</p>
									</div>
									<div style={{ textAlign: "right" }}>
										<p
											style={{
												color: "#e2e8f0",
												fontFamily: "'Space Grotesk',sans-serif",
												fontSize: 20,
												fontWeight: 700,
												margin: 0,
											}}
										>
											{plan.priceFormatted}
										</p>
										<p style={{ color: "#8899aa", fontSize: 10, margin: 0 }}>
											/ month
										</p>
									</div>
								</div>
								<div style={{ padding: "12px 16px 16px" }}>
									<div
										style={{
											display: "flex",
											flexWrap: "wrap",
											gap: "6px 16px",
											marginBottom: 14,
										}}
									>
										{features.map((f) => (
											<div
												key={f}
												style={{
													alignItems: "center",
													display: "flex",
													gap: 5,
												}}
											>
												<CheckCircle2 color={c.accent} size={11} />
												<span style={{ color: "#8899aa", fontSize: 12 }}>
													{f}
												</span>
											</div>
										))}
									</div>
									<button
										disabled={subPending}
										onClick={() => handleSubscribe(plan.key)}
										style={{
											alignItems: "center",
											background: c.bg,
											border: `1px solid ${c.border}`,
											borderRadius: 10,
											color: c.accent,
											cursor: subPending ? "not-allowed" : "pointer",
											display: "flex",
											fontFamily: "'Space Grotesk',sans-serif",
											fontSize: 13,
											fontWeight: 700,
											gap: 7,
											justifyContent: "center",
											padding: "10px",
											width: "100%",
										}}
										type="button"
									>
										{subPending ? (
											<>
												<Loader2
													size={13}
													style={{ animation: "spin 0.75s linear infinite" }}
												/>{" "}
												Redirecting…
											</>
										) : (
											<>
												<Zap size={13} /> Subscribe to {plan.label}
											</>
										)}
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}
			{error && (
				<p style={{ color: "#f87171", fontSize: 12, marginTop: 12 }}>{error}</p>
			)}
		</div>
	);
}
