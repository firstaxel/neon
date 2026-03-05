"use client";

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
	deposit: <ArrowDownLeft size={13} />,
	message_debit: <MessageCircle size={13} />,
	subscription: <RefreshCw size={13} />,
	campaign_refund: <RotateCcw size={13} />,
	refund: <RotateCcw size={13} />,
};

const TYPE_LABEL: Record<string, string> = {
	deposit: "Deposit",
	message_debit: "Message",
	subscription: "Subscription",
	campaign_refund: "Refund",
	refund: "Refund",
};

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
	completed: { color: "#25d366", bg: "#0d2016", label: "Completed" },
	pending: { color: "#f59e0b", bg: "#1a1200", label: "Pending" },
	failed: { color: "#f87171", bg: "#2e0d0d", label: "Failed" },
	reversed: { color: "#8899aa", bg: "#0d1420", label: "Reversed" },
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
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 16,
					flexWrap: "wrap",
					gap: 10,
				}}
			>
				<h2
					style={{
						fontFamily: "'Space Grotesk',sans-serif",
						fontWeight: 600,
						fontSize: 15,
						color: "#e2e8f0",
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
								padding: "5px 12px",
								borderRadius: 20,
								border: `1px solid ${filter === f.value ? "#25d36650" : "#1e2a3a"}`,
								background: filter === f.value ? "#0d2016" : "transparent",
								color: filter === f.value ? "#25d366" : "#8899aa",
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
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
						display: "grid",
						gridTemplateColumns: "1fr auto auto auto",
						gap: 12,
						padding: "10px 16px",
						background: "#0a1020",
						borderBottom: "1px solid #1e2a3a",
					}}
				>
					{["Description", "Amount", "Balance After", "Date"].map((h) => (
						<span
							key={h}
							style={{
								fontSize: 11,
								fontWeight: 700,
								color: "#4a5568",
								textTransform: "uppercase",
								letterSpacing: "0.04em",
							}}
						>
							{h}
						</span>
					))}
				</div>

				{isLoading ? (
					<div
						style={{
							padding: "16px",
							display: "flex",
							flexDirection: "column",
							gap: 12,
						}}
					>
						{[...new Array(5)].map((_, i) => (
							<div className="skeleton" key={i} style={{ height: 44 }} />
						))}
					</div>
				) : rows.length === 0 ? (
					<div
						style={{
							padding: "48px 24px",
							textAlign: "center",
							color: "#4a5568",
							fontSize: 14,
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
									display: "grid",
									gridTemplateColumns: "1fr auto auto auto",
									alignItems: "center",
									gap: 12,
									padding: "12px 16px",
									borderBottom:
										i < rows.length - 1 ? "1px solid #0d1420" : "none",
								}}
							>
								{/* Description */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										minWidth: 0,
									}}
								>
									<div
										style={{
											width: 30,
											height: 30,
											borderRadius: 9,
											background: isCredit ? "#0d2016" : "#0d1a2e",
											border: `1px solid ${isCredit ? "#25d36630" : "#60a5fa30"}`,
											color: isCredit ? "#25d366" : "#60a5fa",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											flexShrink: 0,
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
												fontSize: 13,
												fontWeight: 500,
												color: "#c8d6e5",
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
												margin: 0,
											}}
										>
											{tx.description}
										</p>
										<div style={{ display: "flex", gap: 6, marginTop: 2 }}>
											<span
												style={{
													fontSize: 10,
													fontWeight: 700,
													color: s.color,
													background: s.bg,
													padding: "1px 6px",
													borderRadius: 4,
												}}
											>
												{s.label}
											</span>
											<span style={{ fontSize: 10, color: "#4a5568" }}>
												{TYPE_LABEL[tx.type] ?? tx.type}
											</span>
										</div>
									</div>
								</div>
								{/* Amount */}
								<span
									style={{
										fontFamily: "'Space Grotesk',sans-serif",
										fontWeight: 700,
										fontSize: 14,
										color: isCredit ? "#25d366" : "#f87171",
										whiteSpace: "nowrap",
									}}
								>
									{isCredit ? "+" : "−"}
									{tx.amountFormatted}
								</span>
								{/* Balance after */}
								<span
									style={{
										fontSize: 12,
										color: "#8899aa",
										whiteSpace: "nowrap",
									}}
								>
									{tx.balanceAfterFormatted}
								</span>
								{/* Date */}
								<span
									style={{
										fontSize: 11,
										color: "#4a5568",
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
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginTop: 12,
						fontSize: 12,
						color: "#8899aa",
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
								width: 30,
								height: 30,
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
							<ChevronLeft size={14} />
						</button>
						<button
							disabled={pagination.page >= pagination.totalPages || isFetching}
							onClick={() => setPage((p) => p + 1)}
							style={{
								width: 30,
								height: 30,
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
							<ChevronRight size={14} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
