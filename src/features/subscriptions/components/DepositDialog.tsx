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
					backdropFilter: "blur(4px)",
					background: "rgba(0,0,0,0.7)",
					inset: 0,
					position: "fixed",
					zIndex: 40,
				}}
			/>
			<div
				style={{
					animation: "fadeSlideUp 0.2s ease forwards",
					background: "#0d1420",
					border: "1px solid #1e2a3a",
					borderRadius: 20,
					left: "50%",
					overflow: "hidden",
					position: "fixed",
					top: "50%",
					transform: "translate(-50%,-50%)",
					width: "min(420px, calc(100vw - 32px))",
					zIndex: 50,
				}}
			>
				{/* Header */}
				<div
					style={{
						alignItems: "center",
						borderBottom: "1px solid #1e2a3a",
						display: "flex",
						justifyContent: "space-between",
						padding: "18px 22px",
					}}
				>
					<div style={{ alignItems: "center", display: "flex", gap: 10 }}>
						<div
							style={{
								alignItems: "center",
								background: "#0d2016",
								border: "1px solid #25d36630",
								borderRadius: 10,
								display: "flex",
								height: 32,
								justifyContent: "center",
								width: 32,
							}}
						>
							<Banknote color="#25d366" size={15} />
						</div>
						<span
							style={{
								color: "#e2e8f0",
								fontFamily: "'Space Grotesk', sans-serif",
								fontSize: 15,
								fontWeight: 600,
							}}
						>
							Top Up Wallet
						</span>
					</div>
					<button
						onClick={() => onOpenChange(false)}
						style={{
							alignItems: "center",
							background: "#1e2a3a",
							border: "none",
							borderRadius: 8,
							color: "#8899aa",
							cursor: "pointer",
							display: "flex",
							height: 28,
							justifyContent: "center",
							width: 28,
						}}
						type="button"
					>
						<X size={14} />
					</button>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 18,
						padding: "20px 22px 24px",
					}}
				>
					{/* Preset amounts */}
					<div>
						<p
							style={{
								color: "#4a5568",
								fontSize: 11,
								fontWeight: 700,
								letterSpacing: "0.05em",
								marginBottom: 10,
								textTransform: "uppercase",
							}}
						>
							Select Amount
						</p>
						<div
							style={{
								display: "grid",
								gap: 8,
								gridTemplateColumns: "repeat(3,1fr)",
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
											background: active ? "#0d2016" : "#0a1020",
											border: `1px solid ${active ? "#25d366" : "#1e2a3a"}`,
											borderRadius: 12,
											color: active ? "#25d366" : "#8899aa",
											cursor: "pointer",
											fontFamily: "'Space Grotesk',sans-serif",
											fontSize: 13,
											fontWeight: 600,
											padding: "10px 6px",
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
								color: "#4a5568",
								fontSize: 11,
								fontWeight: 700,
								letterSpacing: "0.05em",
								marginBottom: 8,
								textTransform: "uppercase",
							}}
						>
							Or Enter Custom Amount
						</p>
						<div style={{ position: "relative" }}>
							<span
								style={{
									color: customActive ? "#25d366" : "#8899aa",
									fontSize: 15,
									fontWeight: 600,
									left: 14,
									pointerEvents: "none",
									position: "absolute",
									top: "50%",
									transform: "translateY(-50%)",
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
									background: "#0a1020",
									border: `1px solid ${customActive ? "#25d36650" : "#1e2a3a"}`,
									borderRadius: 12,
									boxSizing: "border-box",
									color: "#e2e8f0",
									fontSize: 14,
									outline: "none",
									padding: "12px 14px 12px 30px",
									width: "100%",
								}}
								type="number"
								value={customActive ? amount : ""}
							/>
						</div>
						{selectedAmount > 0 && selectedAmount < 100 && (
							<p style={{ color: "#f87171", fontSize: 11, marginTop: 5 }}>
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
								display: "flex",
								gap: 20,
								padding: "12px 14px",
							}}
						>
							<div>
								<p
									style={{
										color: "#25d366",
										fontSize: 10,
										fontWeight: 700,
										letterSpacing: "0.05em",
										margin: 0,
										textTransform: "uppercase",
									}}
								>
									WhatsApp
								</p>
								<p
									style={{
										color: "#e2e8f0",
										fontSize: 13,
										fontWeight: 600,
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
										color: "#60a5fa",
										fontSize: 10,
										fontWeight: 700,
										letterSpacing: "0.05em",
										margin: 0,
										textTransform: "uppercase",
									}}
								>
									SMS
								</p>
								<p
									style={{
										color: "#e2e8f0",
										fontSize: 13,
										fontWeight: 600,
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
								background: "#2e0d0d",
								border: "1px solid #f8717140",
								borderRadius: 8,
								color: "#f87171",
								fontSize: 12,
								padding: "8px 12px",
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
							alignItems: "center",
							background: isValid && !isPending ? "#25d366" : "#1e2a3a",
							border: "none",
							borderRadius: 14,
							color: isValid && !isPending ? "#080c14" : "#4a5568",
							cursor: isValid && !isPending ? "pointer" : "not-allowed",
							display: "flex",
							fontFamily: "'Space Grotesk',sans-serif",
							fontSize: 15,
							fontWeight: 700,
							gap: 8,
							justifyContent: "center",
							padding: "14px",
							transition: "all 0.2s",
							width: "100%",
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
							color: "#4a5568",
							fontSize: 11,
							margin: 0,
							textAlign: "center",
						}}
					>
						Secured by Paystack · Cards, bank transfer, USSD
					</p>
				</div>
			</div>
		</>
	);
}
