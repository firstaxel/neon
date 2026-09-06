import {
	ArrowDownLeft,
	ArrowUpRight,
	ChevronLeft,
	ChevronRight,
	MessageCircle,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useTransactions } from "#/features/billing/hooks/use-billing";

type TxFilter =
	| "all"
	| "deposit"
	| "message_debit"
	| "subscription"
	| "campaign_refund";

const FILTERS: { label: string; value: TxFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Deposits", value: "deposit" },
	{ label: "Messages", value: "message_debit" },
	{ label: "Subscription", value: "subscription" },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
	campaign_refund: <RotateCcw size={13} />,
	deposit: <ArrowDownLeft size={13} />,
	message_debit: <MessageCircle size={13} />,
	refund: <RotateCcw size={13} />,
	subscription: <RefreshCw size={13} />,
};

const TYPE_LABEL: Record<string, string> = {
	campaign_refund: "Refund",
	deposit: "Deposit",
	message_debit: "Message",
	refund: "Refund",
	subscription: "Subscription",
};

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
	completed: { bg: "#0d2016", color: "#25d366", label: "Completed" },
	failed: { bg: "#2e0d0d", color: "#f87171", label: "Failed" },
	pending: { bg: "#1a1200", color: "#f59e0b", label: "Pending" },
	reversed: { bg: "#0d1420", color: "#8899aa", label: "Reversed" },
};

export function TransactionTable() {
	const [filter, setFilter] = useState<TxFilter>("all");
	const [page, setPage] = useState(1);

	const { data, isLoading, isFetching } = useTransactions(page);
	const rows = data?.transactions ?? [];
	const pagination = data?.pagination;

	return (
		<div>
			{/* Header + filter */}
			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexWrap: "wrap",
					gap: 10,
					justifyContent: "space-between",
					marginBottom: 16,
				}}
			>
				<h2
					style={{
						color: "#e2e8f0",
						fontFamily: "'Space Grotesk',sans-serif",
						fontSize: 15,
						fontWeight: 600,
						margin: 0,
					}}
				>
					Transaction History
				</h2>
				<div style={{ display: "flex", gap: 6 }}>
					{FILTERS.map((f) => (
						<button
							key={f.value}
							onClick={() => {
								setFilter(f.value);
								setPage(1);
							}}
							style={{
								background: filter === f.value ? "#0d2016" : "transparent",
								border: `1px solid ${filter === f.value ? "#25d36650" : "#1e2a3a"}`,
								borderRadius: 20,
								color: filter === f.value ? "#25d366" : "#8899aa",
								cursor: "pointer",
								fontSize: 12,
								fontWeight: 600,
								padding: "5px 12px",
								transition: "all 0.15s",
							}}
							type="button"
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{/* Table */}
			<div
				style={{
					border: "1px solid #1e2a3a",
					borderRadius: 16,
					overflow: "hidden",
				}}
			>
				{/* Column headers */}
				<div
					style={{
						background: "#0a1020",
						borderBottom: "1px solid #1e2a3a",
						display: "grid",
						gap: 12,
						gridTemplateColumns: "1fr auto auto auto",
						padding: "10px 16px",
					}}
				>
					{["Description", "Amount", "Balance After", "Date"].map((h) => (
						<span
							key={h}
							style={{
								color: "#4a5568",
								fontSize: 11,
								fontWeight: 700,
								letterSpacing: "0.04em",
								textTransform: "uppercase",
							}}
						>
							{h}
						</span>
					))}
				</div>

				{isLoading ? (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 12,
							padding: "16px",
						}}
					>
						{[...new Array(5)].map((_, i) => (
							<div className="skeleton" key={i} style={{ height: 44 }} />
						))}
					</div>
				) : rows.length === 0 ? (
					<div
						style={{
							color: "#4a5568",
							fontSize: 14,
							padding: "48px 24px",
							textAlign: "center",
						}}
					>
						No transactions yet.
					</div>
				) : (
					rows.map((tx, i) => {
						const isCredit = tx.isCredit;
						const s = STATUS[tx.status] ?? STATUS.completed;
						return (
							<div
								key={tx.id}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background = "#0a1020")
								}
								onMouseLeave={(e) => (e.currentTarget.style.background = "")}
								style={{
									alignItems: "center",
									borderBottom:
										i < rows.length - 1 ? "1px solid #0d1420" : "none",
									display: "grid",
									gap: 12,
									gridTemplateColumns: "1fr auto auto auto",
									padding: "12px 16px",
								}}
							>
								{/* Description */}
								<div
									style={{
										alignItems: "center",
										display: "flex",
										gap: 10,
										minWidth: 0,
									}}
								>
									<div
										style={{
											alignItems: "center",
											background: isCredit ? "#0d2016" : "#0d1a2e",
											border: `1px solid ${isCredit ? "#25d36630" : "#60a5fa30"}`,
											borderRadius: 9,
											color: isCredit ? "#25d366" : "#60a5fa",
											display: "flex",
											flexShrink: 0,
											height: 30,
											justifyContent: "center",
											width: 30,
										}}
									>
										{isCredit ? (
											<ArrowDownLeft size={13} />
										) : (
											(TYPE_ICON[tx.type] ?? <ArrowUpRight size={13} />)
										)}
									</div>
									<div style={{ minWidth: 0 }}>
										<p
											style={{
												color: "#c8d6e5",
												fontSize: 13,
												fontWeight: 500,
												margin: 0,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{tx.description}
										</p>
										<div style={{ display: "flex", gap: 6, marginTop: 2 }}>
											<span
												style={{
													background: s.bg,
													borderRadius: 4,
													color: s.color,
													fontSize: 10,
													fontWeight: 700,
													padding: "1px 6px",
												}}
											>
												{s.label}
											</span>
											<span style={{ color: "#4a5568", fontSize: 10 }}>
												{TYPE_LABEL[tx.type] ?? tx.type}
											</span>
										</div>
									</div>
								</div>
								{/* Amount */}
								<span
									style={{
										color: isCredit ? "#25d366" : "#f87171",
										fontFamily: "'Space Grotesk',sans-serif",
										fontSize: 14,
										fontWeight: 700,
										whiteSpace: "nowrap",
									}}
								>
									{isCredit ? "+" : "−"}
									{tx.amountFormatted}
								</span>
								{/* Balance after */}
								<span
									style={{
										color: "#8899aa",
										fontSize: 12,
										whiteSpace: "nowrap",
									}}
								>
									{tx.balanceAfterFormatted}
								</span>
								{/* Date */}
								<span
									style={{
										color: "#4a5568",
										fontSize: 11,
										whiteSpace: "nowrap",
									}}
								>
									{new Date(tx.createdAt).toLocaleDateString("en-GB", {
										day: "numeric",
										month: "short",
										year: "numeric",
									})}
								</span>
							</div>
						);
					})
				)}
			</div>

			{/* Pagination */}
			{pagination && pagination.totalPages > 1 && (
				<div
					style={{
						alignItems: "center",
						color: "#8899aa",
						display: "flex",
						fontSize: 12,
						justifyContent: "space-between",
						marginTop: 12,
					}}
				>
					<span>
						Page {pagination.page} of {pagination.totalPages}
					</span>
					<div style={{ display: "flex", gap: 6 }}>
						<button
							disabled={pagination.page <= 1 || isFetching}
							onClick={() => setPage((p) => p - 1)}
							style={{
								alignItems: "center",
								background: "#0a1020",
								border: "1px solid #1e2a3a",
								borderRadius: 8,
								color: "#8899aa",
								cursor: "pointer",
								display: "flex",
								height: 30,
								justifyContent: "center",
								width: 30,
							}}
							type="button"
						>
							<ChevronLeft size={14} />
						</button>
						<button
							disabled={pagination.page >= pagination.totalPages || isFetching}
							onClick={() => setPage((p) => p + 1)}
							style={{
								alignItems: "center",
								background: "#0a1020",
								border: "1px solid #1e2a3a",
								borderRadius: 8,
								color: "#8899aa",
								cursor: "pointer",
								display: "flex",
								height: 30,
								justifyContent: "center",
								width: 30,
							}}
							type="button"
						>
							<ChevronRight size={14} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
