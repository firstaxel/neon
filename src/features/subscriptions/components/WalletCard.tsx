import { Plus, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { useWallet } from "#/features/billing/hooks/use-billing";
import { DepositDialog } from "./DepositDialog";

export function WalletCard() {
	const { data: wallet, isLoading, refetch, isFetching } = useWallet();
	const [depositOpen, setDepositOpen] = useState(false);

	const balance = wallet?.balanceFormatted ?? "₦0.00";
	const available = wallet?.availableFormatted ?? "₦0.00";
	const hasHeld = (wallet?.heldKobo ?? 0) > 0;

	return (
		<>
			<div
				style={{
					background: "#0d1420",
					border: "1px solid #1e2a3a",
					borderRadius: 20,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						alignItems: "center",
						background: "#0a1520",
						borderBottom: "1px solid #1e2a3a",
						display: "flex",
						justifyContent: "space-between",
						padding: "16px 20px",
					}}
				>
					<div style={{ alignItems: "center", display: "flex", gap: 10 }}>
						<div
							style={{
								alignItems: "center",
								background: "#0d2016",
								border: "1px solid #25d36630",
								borderRadius: 9,
								display: "flex",
								height: 32,
								justifyContent: "center",
								width: 32,
							}}
						>
							<Wallet color="#25d366" size={15} />
						</div>
						<span
							style={{
								color: "#e2e8f0",
								fontFamily: "'Space Grotesk', sans-serif",
								fontSize: 14,
								fontWeight: 600,
							}}
						>
							Wallet Balance
						</span>
					</div>
					<button
						disabled={isFetching}
						onClick={() => refetch()}
						style={{
							alignItems: "center",
							background: "#0a1020",
							border: "1px solid #1e2a3a",
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
						<RefreshCw
							size={13}
							style={{
								animation: isFetching ? "spin 0.75s linear infinite" : "none",
							}}
						/>
					</button>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 16,
						padding: "20px",
					}}
				>
					{isLoading ? (
						<div className="skeleton" style={{ height: 48 }} />
					) : (
						<div>
							<p
								style={{
									color: "#e2e8f0",
									fontFamily: "'Space Grotesk', sans-serif",
									fontSize: 28,
									fontWeight: 700,
									lineHeight: 1,
								}}
							>
								{balance}
							</p>
							{hasHeld && (
								<p style={{ color: "#8899aa", fontSize: 11, marginTop: 6 }}>
									{available} available · funds reserved for active campaigns
								</p>
							)}
						</div>
					)}

					<div
						style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}
					>
						{[
							{ color: "#25d366", label: "WhatsApp", rate: "₦5.00/msg" },
							{ color: "#60a5fa", label: "SMS", rate: "₦2.50/msg" },
						].map(({ label, rate, color }) => (
							<div
								key={label}
								style={{
									background: "#0a1020",
									border: "1px solid #1e2a3a",
									borderRadius: 10,
									padding: "10px 12px",
								}}
							>
								<p
									style={{
										color,
										fontSize: 10,
										fontWeight: 700,
										letterSpacing: "0.05em",
										textTransform: "uppercase",
									}}
								>
									{label}
								</p>
								<p
									style={{
										color: "#e2e8f0",
										fontSize: 13,
										fontWeight: 600,
										marginTop: 3,
									}}
								>
									{rate}
								</p>
							</div>
						))}
					</div>

					<button
						onClick={() => setDepositOpen(true)}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLButtonElement).style.opacity = "1";
						}}
						style={{
							alignItems: "center",
							background: "#25d366",
							border: "none",
							borderRadius: 12,
							color: "#080c14",
							cursor: "pointer",
							display: "flex",
							fontFamily: "'Space Grotesk', sans-serif",
							fontSize: 14,
							fontWeight: 700,
							gap: 8,
							justifyContent: "center",
							padding: "12px",
							transition: "opacity 0.15s",
							width: "100%",
						}}
						type="button"
					>
						<Plus size={15} /> Top Up Wallet
					</button>
				</div>
			</div>

			<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
		</>
	);
}
