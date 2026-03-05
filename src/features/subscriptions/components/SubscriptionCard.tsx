import { CheckCircle2, Loader2, Sparkles, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import {
	useCancelSubscription,
	useInitSubscription,
	useSubscription,
} from "#/features/billing/hooks/use-billing";

const COLORS: Record<string, { accent: string; bg: string; border: string }> = {
	starter: { accent: "#60a5fa", bg: "#0d1a2e", border: "#60a5fa30" },
	growth: { accent: "#a78bfa", bg: "#1a0d2e", border: "#a78bfa30" },
	pro: { accent: "#f59e0b", bg: "#1a1200", border: "#f59e0b30" },
};

const FEATURES: Record<string, string[]> = {
	starter: ["Up to 500 messages/month", "WhatsApp + SMS", "Campaign history"],
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
				plan: planKey as "starter" | "growth" | "pro",
				callbackUrl: `${window.location.origin}/billing/verify?type=subscription`,
			});
			window.location.href = result.checkoutUrl;
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to start subscription");
		}
	}

	async function handleCancel() {
		setError(null);
		try {
			await cancelSub({});
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
					borderRadius: 20,
					border: `1px solid ${c.border}`,
					background: "#0d1420",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "16px 20px",
						background: c.bg,
						borderBottom: `1px solid ${c.border}`,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<Sparkles color={c.accent} size={15} />
						<span
							style={{
								fontFamily: "'Space Grotesk',sans-serif",
								fontWeight: 700,
								fontSize: 14,
								color: c.accent,
								textTransform: "uppercase",
							}}
						>
							{sub.plan} Plan
						</span>
					</div>
					<span
						style={{
							fontSize: 10,
							fontWeight: 700,
							color: sub.status === "active" ? "#25d366" : "#f87171",
							background: sub.status === "active" ? "#0d2016" : "#2e0d0d",
							border: `1px solid ${sub.status === "active" ? "#25d36640" : "#f8717140"}`,
							padding: "3px 8px",
							borderRadius: 20,
							textTransform: "uppercase",
							letterSpacing: "0.05em",
						}}
					>
						{sub.status}
					</span>
				</div>

				<div
					style={{
						padding: 20,
						display: "flex",
						flexDirection: "column",
						gap: 14,
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
							<span style={{ fontSize: 12, color: "#8899aa" }}>
								Messages this cycle
							</span>
							<span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>
								{sub.messagesUsedThisCycle.toLocaleString()} /{" "}
								{sub.monthlyMessageLimit === 999_999
									? "∞"
									: sub.monthlyMessageLimit.toLocaleString()}
							</span>
						</div>
						<div
							style={{
								height: 6,
								borderRadius: 99,
								background: "#1e2a3a",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${usagePct}%`,
									borderRadius: 99,
									background: usagePct > 85 ? "#f59e0b" : c.accent,
									transition: "width 0.4s",
								}}
							/>
						</div>
						{usagePct > 85 && (
							<p style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>
								⚠️ Approaching monthly limit
							</p>
						)}
					</div>

					<p style={{ fontSize: 12, color: "#8899aa", margin: 0 }}>
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
								fontSize: 12,
								cursor: "pointer",
								textDecoration: "underline",
								padding: 0,
								textAlign: "left",
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
								padding: "12px 14px",
								display: "flex",
								flexDirection: "column",
								gap: 10,
							}}
						>
							<p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
								Cancel your plan? Access continues until {renewDate}.
							</p>
							<div style={{ display: "flex", gap: 8 }}>
								<button
									onClick={() => setCancelConfirm(false)}
									style={{
										flex: 1,
										padding: "8px",
										borderRadius: 10,
										border: "1px solid #1e2a3a",
										background: "#0a1020",
										color: "#8899aa",
										fontSize: 13,
										fontWeight: 600,
										cursor: "pointer",
									}}
									type="button"
								>
									Keep plan
								</button>
								<button
									disabled={cancelPending}
									onClick={handleCancel}
									style={{
										flex: 1,
										padding: "8px",
										borderRadius: 10,
										border: "none",
										background: "#f87171",
										color: "#080c14",
										fontSize: 13,
										fontWeight: 700,
										cursor: cancelPending ? "not-allowed" : "pointer",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										gap: 6,
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
						<p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>
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
						fontFamily: "'Space Grotesk',sans-serif",
						fontWeight: 600,
						fontSize: 17,
						color: "#e2e8f0",
						margin: 0,
					}}
				>
					Choose a Plan
				</h2>
				<p style={{ fontSize: 13, color: "#8899aa", marginTop: 4 }}>
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
							style={{ height: 130, borderRadius: 16 }}
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
									borderRadius: 16,
									border: `1px solid ${c.border}`,
									background: "#0a1020",
									overflow: "hidden",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "14px 16px",
										background: c.bg,
									}}
								>
									<div>
										<p
											style={{
												fontFamily: "'Space Grotesk',sans-serif",
												fontWeight: 700,
												fontSize: 14,
												color: c.accent,
												textTransform: "uppercase",
												margin: 0,
											}}
										>
											{plan.label}
										</p>
										<p style={{ fontSize: 12, color: "#8899aa", marginTop: 2 }}>
											{plan.monthlyLimit} msgs/month
										</p>
									</div>
									<div style={{ textAlign: "right" }}>
										<p
											style={{
												fontFamily: "'Space Grotesk',sans-serif",
												fontWeight: 700,
												fontSize: 20,
												color: "#e2e8f0",
												margin: 0,
											}}
										>
											{plan.priceFormatted}
										</p>
										<p style={{ fontSize: 10, color: "#8899aa", margin: 0 }}>
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
													display: "flex",
													alignItems: "center",
													gap: 5,
												}}
											>
												<CheckCircle2 color={c.accent} size={11} />
												<span style={{ fontSize: 12, color: "#8899aa" }}>
													{f}
												</span>
											</div>
										))}
									</div>
									<button
										disabled={subPending}
										onClick={() => handleSubscribe(plan.key)}
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: 7,
											width: "100%",
											padding: "10px",
											borderRadius: 10,
											border: `1px solid ${c.border}`,
											background: c.bg,
											color: c.accent,
											fontFamily: "'Space Grotesk',sans-serif",
											fontWeight: 700,
											fontSize: 13,
											cursor: subPending ? "not-allowed" : "pointer",
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
				<p style={{ fontSize: 12, color: "#f87171", marginTop: 12 }}>{error}</p>
			)}
		</div>
	);
}
