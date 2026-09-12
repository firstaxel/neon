import {
	ArrowDownLeft,
	ArrowUpRight,
	ChevronLeft,
	ChevronRight,
	Clock,
	Lock,
	MessageSquare,
	Plus,
	RefreshCw,
	RotateCcw,
	Smartphone,
	Sparkles,
	TrendingUp,
	Unlock,
	Wallet,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { PageHeader } from "#/components/shared/page-header";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { DepositDialog } from "#/features/billing/components/deposit-dialog";
import {
	type TransactionTypeFilter,
	useTransactions,
	useWallet,
} from "#/features/billing/hooks/use-billing";
import { formatNaira, PRICING } from "#/features/billing/utils/format";
import { cn } from "#/lib/utils";

// ─── Quick Presets ────────────────────────────────────────────────────────────

const PRESET_TOPUPS = [1000, 5000, 10_000, 25_000, 50_000, 100_000] as const;

interface PresetTopupButtonProps {
	onSelect: (preset: number) => void;
	preset: number;
}

const PresetTopupButton = memo(function PresetTopupButtonComponent({
	preset,
	onSelect,
}: PresetTopupButtonProps) {
	const handleClick = useCallback(() => {
		onSelect(preset);
	}, [onSelect, preset]);

	return (
		<Button
			className="rounded-xl border-border/80 font-bold font-mono text-xs hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
			onClick={handleClick}
			size="sm"
			variant="outline"
		>
			₦{preset.toLocaleString()}
		</Button>
	);
});

// ─── Wallet Balance Card ──────────────────────────────────────────────────────

function WalletSummaryCard({
	onOpenDeposit,
}: {
	onOpenDeposit: (preset?: number) => void;
}) {
	const { data: wallet, isLoading, refetch, isFetching } = useWallet();

	const balanceKobo = wallet?.balanceKobo ?? 0;
	const heldKobo = wallet?.heldKobo ?? 0;
	const availableKobo = Math.max(0, balanceKobo - heldKobo);

	const handleRefresh = useCallback(() => {
		refetch();
	}, [refetch]);

	const handleTopUpClick = useCallback(() => {
		onOpenDeposit();
	}, [onOpenDeposit]);

	return (
		<Card className="relative overflow-hidden border-border/80 bg-linear-to-b from-card to-card/50 shadow-sm">
			<div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

			<div className="border-border/60 border-b p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
							<Wallet className="h-4 w-4" />
						</div>
						<span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
							Spendable Balance
						</span>
					</div>

					<Button
						className="h-8 w-8 rounded-xl"
						disabled={isFetching}
						onClick={handleRefresh}
						size="icon"
						title="Refresh wallet balance"
						variant="ghost"
					>
						<RefreshCw
							className={cn(
								"h-3.5 w-3.5 text-muted-foreground",
								isFetching && "animate-spin text-primary"
							)}
						/>
					</Button>
				</div>

				<div className="mt-4">
					{isLoading ? (
						<Skeleton className="h-10 w-44 rounded-xl" />
					) : (
						<div className="flex items-baseline gap-2">
							<span className="font-black font-mono text-3xl text-foreground tracking-tight sm:text-4xl">
								{formatNaira(availableKobo)}
							</span>
							<span className="font-semibold text-muted-foreground text-xs">
								NGN
							</span>
						</div>
					)}
				</div>

				{heldKobo > 0 ? (
					<div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
						<Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
						<span className="text-muted-foreground">
							Reserved in active campaigns:
						</span>
						<span className="font-bold font-mono text-amber-500">
							{formatNaira(heldKobo)}
						</span>
						<span className="text-muted-foreground/60">·</span>
						<span className="text-muted-foreground">Total:</span>
						<span className="font-mono font-semibold text-foreground">
							{formatNaira(balanceKobo)}
						</span>
					</div>
				) : null}

				<div className="mt-5 flex gap-2.5">
					<Button
						className="flex-1 rounded-2xl font-bold text-xs"
						onClick={handleTopUpClick}
						size="default"
					>
						<Plus className="mr-1.5 h-3.5 w-3.5" /> Top Up Wallet
					</Button>
				</div>
			</div>

			<CardContent className="p-6">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Quick Top Up Presets
				</p>
				<div className="mt-3 grid grid-cols-3 gap-2">
					{PRESET_TOPUPS.map((preset) => (
						<PresetTopupButton
							key={preset}
							onSelect={onOpenDeposit}
							preset={preset}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// ─── Transparent Rates Card ───────────────────────────────────────────────────

function PricingRatesCard() {
	return (
		<Card className="border-border/80 bg-card/60">
			<CardHeader className="p-6 pb-4">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary" />
					<CardTitle className="font-bold text-sm">
						Broadcast Delivery Rates
					</CardTitle>
				</div>
				<p className="text-muted-foreground text-xs">
					Pay as you go. Funds are deducted per recipient only when sent.
				</p>
			</CardHeader>

			<CardContent className="space-y-3 p-6 pt-0">
				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					<div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
						<div className="flex items-center gap-2">
							<MessageSquare className="h-4 w-4 text-primary" />
							<span className="font-semibold text-foreground text-xs">
								WhatsApp Marketing
							</span>
						</div>
						<div className="mt-2 flex items-baseline justify-between">
							<span className="font-bold font-mono text-foreground text-lg">
								{formatNaira(PRICING.PER_MESSAGE.whatsapp_marketing)}
							</span>
							<span className="text-[11px] text-muted-foreground">
								per recipient
							</span>
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Meta template broadcast conversation
						</p>
					</div>

					<div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5">
						<div className="flex items-center gap-2">
							<Smartphone className="h-4 w-4 text-blue-400" />
							<span className="font-semibold text-foreground text-xs">
								SMS Broadcast
							</span>
						</div>
						<div className="mt-2 flex items-baseline justify-between">
							<span className="font-bold font-mono text-foreground text-lg">
								{formatNaira(PRICING.PER_MESSAGE.sms)}
							</span>
							<span className="text-[11px] text-muted-foreground">
								per message
							</span>
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Flat rate via direct Termii route
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					<div className="rounded-xl border border-border/80 bg-muted/20 p-3">
						<p className="font-semibold text-foreground text-xs">
							WhatsApp Utility & Consent
						</p>
						<p className="mt-1 font-bold font-mono text-primary text-sm">
							{formatNaira(PRICING.PER_MESSAGE.whatsapp_utility)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Pre screen consent conversations
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-muted/20 p-3">
						<p className="font-semibold text-foreground text-xs">
							Inbound Service Window
						</p>
						<p className="mt-1 font-bold font-mono text-primary text-sm">
							FREE
						</p>
						<p className="text-[11px] text-muted-foreground">
							Replies inside active 24 hour customer session
						</p>
					</div>
				</div>

				<div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-[11px] text-muted-foreground">
					No recurring subscription plans or expiry dates. Unspent wallet
					balance remains in your account indefinitely.
				</div>
			</CardContent>
		</Card>
	);
}

// ─── Transaction Ledger Table ─────────────────────────────────────────────────

const FILTER_ITEMS: Array<{
	label: string;
	value: "all" | TransactionTypeFilter;
}> = [
	{ label: "All Events", value: "all" },
	{ label: "Deposits", value: "deposit" },
	{ label: "Message Debits", value: "message_debit" },
	{ label: "Campaign Holds", value: "campaign_hold" },
	{ label: "Refunds", value: "campaign_refund" },
];

function getTransactionIcon(
	type: string,
	isCredit: boolean,
	isHoldRelease?: boolean
) {
	if (isHoldRelease) {
		return <Unlock className="h-4 w-4 text-primary" />;
	}
	if (isCredit) {
		return <ArrowDownLeft className="h-4 w-4 text-primary" />;
	}
	if (type === "campaign_hold") {
		return <Lock className="h-4 w-4 text-amber-400" />;
	}
	if (type === "campaign_refund" || type === "refund") {
		return <RotateCcw className="h-4 w-4 text-primary" />;
	}
	return <ArrowUpRight className="h-4 w-4 text-muted-foreground" />;
}

function getStatusBadge(status: string) {
	switch (status) {
		case "completed":
			return (
				<Badge
					className="border-primary/30 bg-primary/10 font-semibold text-[10px] text-primary"
					variant="outline"
				>
					Completed
				</Badge>
			);
		case "failed":
			return (
				<Badge
					className="border-destructive/30 bg-destructive/10 font-semibold text-[10px] text-destructive"
					variant="outline"
				>
					Failed
				</Badge>
			);
		default:
			return (
				<Badge
					className="border-amber-500/30 bg-amber-500/10 font-semibold text-[10px] text-amber-500"
					variant="outline"
				>
					Pending
				</Badge>
			);
	}
}

interface FilterChipButtonProps {
	active: boolean;
	label: string;
	onSelect: (val: "all" | TransactionTypeFilter) => void;
	value: "all" | TransactionTypeFilter;
}

const FilterChipButton = memo(function FilterChipButtonComponent({
	label,
	value,
	active,
	onSelect,
}: FilterChipButtonProps) {
	const handleClick = useCallback(() => {
		onSelect(value);
	}, [onSelect, value]);

	return (
		<button
			className={cn(
				"rounded-xl px-3 py-1.5 font-semibold text-xs transition-all",
				active
					? "border border-primary/30 bg-primary/10 text-primary"
					: "border border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground"
			)}
			onClick={handleClick}
			type="button"
		>
			{label}
		</button>
	);
});

function TransactionLedger() {
	const [activeFilter, setActiveFilter] = useState<
		"all" | TransactionTypeFilter
	>("all");
	const [page, setPage] = useState(1);

	const { data, isLoading, isFetching } = useTransactions({
		page,
		pageSize: 15,
		type: activeFilter === "all" ? undefined : activeFilter,
	});

	const transactions = data?.transactions ?? [];
	const pagination = data?.pagination;

	const handleFilterChange = useCallback(
		(val: "all" | TransactionTypeFilter) => {
			setActiveFilter(val);
			setPage(1);
		},
		[]
	);

	const handlePrevPage = useCallback(() => {
		setPage((prev) => Math.max(1, prev - 1));
	}, []);

	const handleNextPage = useCallback(() => {
		setPage((prev) => prev + 1);
	}, []);

	return (
		<Card className="border-border/80 bg-card/60 shadow-sm">
			<CardHeader className="flex-col gap-4 border-border/60 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<CardTitle className="font-bold text-base">
						Transaction Ledger
					</CardTitle>
					<p className="mt-0.5 text-muted-foreground text-xs">
						Serialized record of all deposits, campaign holds, and message
						debits
					</p>
				</div>

				<div className="flex flex-wrap gap-1.5">
					{FILTER_ITEMS.map((tab) => (
						<FilterChipButton
							active={activeFilter === tab.value}
							key={tab.value}
							label={tab.label}
							onSelect={handleFilterChange}
							value={tab.value}
						/>
					))}
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading ? (
					<div className="space-y-3 p-6">
						{[...new Array(5)].map((_, i) => (
							<Skeleton className="h-12 w-full rounded-xl" key={i.toString()} />
						))}
					</div>
				) : transactions.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
							<TrendingUp className="h-6 w-6" />
						</div>
						<p className="mt-3 font-semibold text-foreground text-sm">
							No transactions found
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Transactions will appear here once you top up or dispatch
							broadcast campaigns
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="border-border/60 hover:bg-transparent">
									<TableHead className="pl-6 font-semibold text-xs">
										Event
									</TableHead>
									<TableHead className="font-semibold text-xs">
										Reference
									</TableHead>
									<TableHead className="font-semibold text-xs">
										Status
									</TableHead>
									<TableHead className="text-right font-semibold text-xs">
										Amount
									</TableHead>
									<TableHead className="hidden text-right font-semibold text-xs sm:table-cell">
										Balance After
									</TableHead>
									<TableHead className="hidden pr-6 text-right font-semibold text-xs md:table-cell">
										Date
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{transactions.map((tx) => {
									const isCredit = Boolean(tx.isCredit);
									const isHoldRelease = Boolean(
										(tx as { isHoldRelease?: boolean }).isHoldRelease
									);
									return (
										<TableRow
											className="border-border/60 transition-colors hover:bg-muted/30"
											key={tx.id}
										>
											<TableCell className="pl-6">
												<div className="flex items-center gap-3">
													<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card">
														{getTransactionIcon(
															tx.type,
															isCredit,
															isHoldRelease
														)}
													</div>
													<div className="min-w-0">
														<p className="truncate font-medium text-foreground text-xs sm:text-sm">
															{tx.description}
														</p>
														<p className="text-[11px] text-muted-foreground uppercase tracking-wider">
															{tx.type.replace(/_/g, " ")}
														</p>
													</div>
												</div>
											</TableCell>

											<TableCell>
												<span className="font-mono text-muted-foreground text-xs">
													{tx.reference.slice(0, 16)}...
												</span>
											</TableCell>

											<TableCell>{getStatusBadge(tx.status)}</TableCell>

											<TableCell className="text-right font-bold font-mono text-sm">
												<span
													className={
														isHoldRelease
															? "text-muted-foreground"
															: isCredit
																? "text-primary"
																: "text-foreground"
													}
												>
													{isHoldRelease ? "" : isCredit ? "+" : "−"}
													{tx.amountFormatted}
												</span>
											</TableCell>

											<TableCell className="hidden text-right font-mono text-muted-foreground text-xs sm:table-cell">
												{tx.balanceAfterFormatted}
											</TableCell>

											<TableCell className="hidden pr-6 text-right text-muted-foreground text-xs md:table-cell">
												{new Date(tx.createdAt).toLocaleDateString("en-GB", {
													day: "numeric",
													month: "short",
													year: "numeric",
												})}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}

				{/* Pagination Footer */}
				{pagination && pagination.totalPages > 1 ? (
					<div className="flex items-center justify-between border-border/60 border-t px-6 py-4">
						<p className="text-muted-foreground text-xs">
							Showing page {pagination.page} of {pagination.totalPages} (
							{pagination.total} total)
						</p>

						<div className="flex items-center gap-2">
							<Button
								className="h-8 w-8 rounded-xl"
								disabled={pagination.page <= 1 || isFetching}
								onClick={handlePrevPage}
								size="icon"
								variant="outline"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button
								className="h-8 w-8 rounded-xl"
								disabled={
									pagination.page >= pagination.totalPages || isFetching
								}
								onClick={handleNextPage}
								size="icon"
								variant="outline"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

// ─── Root Billing View ────────────────────────────────────────────────────────

export function BillingView() {
	const [depositDialogOpen, setDepositDialogOpen] = useState(false);
	const [initialDepositAmount, setInitialDepositAmount] = useState<
		number | undefined
	>();

	const handleOpenDeposit = useCallback((preset?: number) => {
		setInitialDepositAmount(preset);
		setDepositDialogOpen(true);
	}, []);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
			<PageHeader
				action={{
					icon: <Plus size={15} />,
					label: "Top Up Wallet",
					onClick: () => handleOpenDeposit(),
				}}
				description="Prepaid messaging wallet, pay as you go balance, and transaction ledger."
				title="Billing"
			/>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
				<div className="space-y-6 lg:col-span-5">
					<WalletSummaryCard onOpenDeposit={handleOpenDeposit} />
					<PricingRatesCard />
				</div>

				<div className="lg:col-span-7">
					<TransactionLedger />
				</div>
			</div>

			<DepositDialog
				defaultAmount={initialDepositAmount}
				onOpenChange={setDepositDialogOpen}
				open={depositDialogOpen}
			/>
		</div>
	);
}
