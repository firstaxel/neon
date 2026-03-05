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
					borderRadius: 20,
					border: "1px solid #1e2a3a",
					background: "#0d1420",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						background: "#0a1520",
						padding: "16px 20px",
						borderBottom: "1px solid #1e2a3a",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: 9,
								background: "#0d2016",
								border: "1px solid #25d36630",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Wallet color="#25d366" size={15} />
						</div>
						<span
							style={{
								fontFamily: "'Space Grotesk', sans-serif",
								fontWeight: 600,
								fontSize: 14,
								color: "#e2e8f0",
							}}
						>
							Wallet Balance
						</span>
					</div>
					<button
						disabled={isFetching}
						onClick={() => refetch()}
						style={{
							width: 28,
							height: 28,
							borderRadius: 8,
							border: "1px solid #1e2a3a",
							background: "#0a1020",
							color: "#8899aa",
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
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
						padding: "20px",
						display: "flex",
						flexDirection: "column",
						gap: 16,
					}}
				>
					{isLoading ? (
						<div className="skeleton" style={{ height: 48 }} />
					) : (
						<div>
							<p
								style={{
									fontFamily: "'Space Grotesk', sans-serif",
									fontWeight: 700,
									fontSize: 28,
									color: "#e2e8f0",
									lineHeight: 1,
								}}
							>
								{balance}
							</p>
							{hasHeld && (
								<p style={{ fontSize: 11, color: "#8899aa", marginTop: 6 }}>
									{available} available · funds reserved for active campaigns
								</p>
							)}
						</div>
					)}

					<div
						style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
					>
						{[
							{ label: "WhatsApp", rate: "₦5.00/msg", color: "#25d366" },
							{ label: "SMS", rate: "₦2.50/msg", color: "#60a5fa" },
						].map(({ label, rate, color }) => (
							<div
								key={label}
								style={{
									borderRadius: 10,
									border: "1px solid #1e2a3a",
									background: "#0a1020",
									padding: "10px 12px",
								}}
							>
								<p
									style={{
										fontSize: 10,
										fontWeight: 700,
										color,
										textTransform: "uppercase",
										letterSpacing: "0.05em",
									}}
								>
									{label}
								</p>
								<p
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "#e2e8f0",
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
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 8,
							width: "100%",
							padding: "12px",
							borderRadius: 12,
							border: "none",
							background: "#25d366",
							color: "#080c14",
							fontFamily: "'Space Grotesk', sans-serif",
							fontWeight: 700,
							fontSize: 14,
							cursor: "pointer",
							transition: "opacity 0.15s",
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
