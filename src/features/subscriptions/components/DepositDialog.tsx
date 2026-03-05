"use client";

import { Banknote, ExternalLink, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useInitDeposit } from "#/features/billing/hooks/use-billing";

interface DepositDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

const PRESETS = [1000, 5000, 10_000, 25_000, 50_000];

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
	const [amount, setAmount] = useState<string>("");
	const [customActive, setCustomActive] = useState(false);
	const { mutateAsync: initDeposit, isPending, error } = useInitDeposit();

	if (!open) {
		return null;
	}

	const selectedAmount = Number(amount);
	const isValid = selectedAmount >= 100 && selectedAmount <= 1_000_000;

	async function handlePay() {
		if (!isValid) {
			return;
		}
		const result = await initDeposit({
			amountNaira: selectedAmount,
			callbackUrl: `${window.location.origin}/billing/verify`,
		});
		window.location.href = result.checkoutUrl;
	}

	return (
		<>
			<div
				onClick={() => onOpenChange(false)}
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.7)",
					backdropFilter: "blur(4px)",
					zIndex: 40,
				}}
			/>
			<div
				style={{
					position: "fixed",
					top: "50%",
					left: "50%",
					transform: "translate(-50%,-50%)",
					zIndex: 50,
					width: "min(420px, calc(100vw - 32px))",
					background: "#0d1420",
					border: "1px solid #1e2a3a",
					borderRadius: 20,
					overflow: "hidden",
					animation: "fadeSlideUp 0.2s ease forwards",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "18px 22px",
						borderBottom: "1px solid #1e2a3a",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: 10,
								background: "#0d2016",
								border: "1px solid #25d36630",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Banknote color="#25d366" size={15} />
						</div>
						<span
							style={{
								fontFamily: "'Space Grotesk', sans-serif",
								fontWeight: 600,
								fontSize: 15,
								color: "#e2e8f0",
							}}
						>
							Top Up Wallet
						</span>
					</div>
					<button
						onClick={() => onOpenChange(false)}
						style={{
							width: 28,
							height: 28,
							borderRadius: 8,
							border: "none",
							background: "#1e2a3a",
							color: "#8899aa",
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						type="button"
					>
						<X size={14} />
					</button>
				</div>

				<div
					style={{
						padding: "20px 22px 24px",
						display: "flex",
						flexDirection: "column",
						gap: 18,
					}}
				>
					{/* Preset amounts */}
					<div>
						<p
							style={{
								fontSize: 11,
								fontWeight: 700,
								color: "#4a5568",
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								marginBottom: 10,
							}}
						>
							Select Amount
						</p>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(3,1fr)",
								gap: 8,
							}}
						>
							{PRESETS.map((p) => {
								const active = amount === String(p) && !customActive;
								return (
									<button
										key={p}
										onClick={() => {
											setAmount(String(p));
											setCustomActive(false);
										}}
										style={{
											padding: "10px 6px",
											borderRadius: 12,
											border: `1px solid ${active ? "#25d366" : "#1e2a3a"}`,
											background: active ? "#0d2016" : "#0a1020",
											color: active ? "#25d366" : "#8899aa",
											fontFamily: "'Space Grotesk',sans-serif",
											fontWeight: 600,
											fontSize: 13,
											cursor: "pointer",
											transition: "all 0.15s",
										}}
										type="button"
									>
										₦{p.toLocaleString()}
									</button>
								);
							})}
						</div>
					</div>

					{/* Custom amount */}
					<div>
						<p
							style={{
								fontSize: 11,
								fontWeight: 700,
								color: "#4a5568",
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								marginBottom: 8,
							}}
						>
							Or Enter Custom Amount
						</p>
						<div style={{ position: "relative" }}>
							<span
								style={{
									position: "absolute",
									left: 14,
									top: "50%",
									transform: "translateY(-50%)",
									color: customActive ? "#25d366" : "#8899aa",
									fontWeight: 600,
									fontSize: 15,
									pointerEvents: "none",
								}}
							>
								₦
							</span>
							<input
								max={1_000_000}
								min={100}
								onChange={(e) => setAmount(e.target.value)}
								onFocus={() => {
									setCustomActive(true);
									setAmount("");
								}}
								placeholder="Enter amount"
								style={{
									width: "100%",
									padding: "12px 14px 12px 30px",
									borderRadius: 12,
									border: `1px solid ${customActive ? "#25d36650" : "#1e2a3a"}`,
									background: "#0a1020",
									color: "#e2e8f0",
									fontSize: 14,
									outline: "none",
									boxSizing: "border-box",
								}}
								type="number"
								value={customActive ? amount : ""}
							/>
						</div>
						{selectedAmount > 0 && selectedAmount < 100 && (
							<p style={{ fontSize: 11, color: "#f87171", marginTop: 5 }}>
								Minimum deposit is ₦100
							</p>
						)}
					</div>

					{/* Coverage estimate */}
					{isValid && (
						<div
							style={{
								background: "#0a1020",
								border: "1px solid #1e2a3a",
								borderRadius: 12,
								padding: "12px 14px",
								display: "flex",
								gap: 20,
							}}
						>
							<div>
								<p
									style={{
										fontSize: 10,
										color: "#25d366",
										fontWeight: 700,
										textTransform: "uppercase",
										letterSpacing: "0.05em",
										margin: 0,
									}}
								>
									WhatsApp
								</p>
								<p
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "#e2e8f0",
										marginTop: 3,
									}}
								>
									~{Math.floor((selectedAmount * 100) / 500).toLocaleString()}{" "}
									msgs
								</p>
							</div>
							<div>
								<p
									style={{
										fontSize: 10,
										color: "#60a5fa",
										fontWeight: 700,
										textTransform: "uppercase",
										letterSpacing: "0.05em",
										margin: 0,
									}}
								>
									SMS
								</p>
								<p
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "#e2e8f0",
										marginTop: 3,
									}}
								>
									~{Math.floor((selectedAmount * 100) / 250).toLocaleString()}{" "}
									msgs
								</p>
							</div>
						</div>
					)}

					{error && (
						<p
							style={{
								fontSize: 12,
								color: "#f87171",
								padding: "8px 12px",
								background: "#2e0d0d",
								borderRadius: 8,
								border: "1px solid #f8717140",
							}}
						>
							{error instanceof Error
								? error.message
								: "Payment failed. Please try again."}
						</p>
					)}

					<button
						disabled={!isValid || isPending}
						onClick={handlePay}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 8,
							width: "100%",
							padding: "14px",
							borderRadius: 14,
							border: "none",
							background: isValid && !isPending ? "#25d366" : "#1e2a3a",
							color: isValid && !isPending ? "#080c14" : "#4a5568",
							fontFamily: "'Space Grotesk',sans-serif",
							fontWeight: 700,
							fontSize: 15,
							cursor: isValid && !isPending ? "pointer" : "not-allowed",
							transition: "all 0.2s",
						}}
						type="button"
					>
						{isPending ? (
							<>
								<Loader2
									size={16}
									style={{ animation: "spin 0.75s linear infinite" }}
								/>{" "}
								Opening Paystack…
							</>
						) : (
							<>
								<ExternalLink size={15} /> Pay{" "}
								{isValid ? `₦${selectedAmount.toLocaleString()}` : ""} via
								Paystack
							</>
						)}
					</button>

					<p
						style={{
							fontSize: 11,
							color: "#4a5568",
							textAlign: "center",
							margin: 0,
						}}
					>
						Secured by Paystack · Cards, bank transfer, USSD
					</p>
				</div>
			</div>
		</>
	);
}
