import {
	AlertTriangle,
	ArrowDownLeft,
	ArrowUpRight,
	Banknote,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	ExternalLink,
	Loader2,
	MessageCircle,
	Plus,
	RefreshCw,
	RotateCcw,
	Shield,
	Sparkles,
	TrendingUp,
	Wallet,
	XCircle,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	DialogHeader as DHeader,
	Dialog,
	DialogContent,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Progress } from "#/components/ui/progress";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import {
	useCancelSubscription,
	useInitDeposit,
	useInitSubscription,
	useSubscription,
	useTransactions,
	useWallet,
} from "#/features/billing/hooks/use-billing";
import { cn } from "#/lib/utils";

// ─── Deposit Dialog ───────────────────────────────────────────────────────────

const PRESETS = [1000, 5000, 10_000, 25_000, 50_000, 100_000];

function DepositDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const [selected, setSelected] = useState<number | null>(null);
	const [custom, setCustom] = useState("");
	const [mode, setMode] = useState<"preset" | "custom">("preset");
	const { mutateAsync: initDeposit, isPending, error } = useInitDeposit();

	const amount = mode === "custom" ? Number(custom) : (selected ?? 0);
	const valid = amount >= 100 && amount <= 5_000_000;
	const waMsgs = valid ? Math.floor((amount * 100) / 500) : 0;
	const smsMsgs = valid ? Math.floor((amount * 100) / 250) : 0;

	async function pay() {
		if (!valid) {
			return;
		}
		const r = await initDeposit({
			amountNaira: amount,
			callbackUrl: `${window.location.origin}/billing/verify?type=deposit`,
		});
		window.location.href = r.checkoutUrl;
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-border p-0">
				{/* Header */}
				<DHeader className="flex-row items-center gap-3 space-y-0 border-border border-b p-5 pb-4">
					<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
						<Banknote className="h-4 w-4 text-primary" />
					</div>
					<div>
						<DialogTitle className="font-semibold text-sm leading-none">
							Top Up Wallet
						</DialogTitle>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							Secured by Paystack
						</p>
					</div>
				</DHeader>

				<div className="flex flex-col gap-5 p-5">
					{/* Mode toggle */}
					<div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
						{(["preset", "custom"] as const).map((m) => (
							<button
								className={cn(
									"rounded-md py-1.5 font-semibold text-xs transition-all",
									mode === m
										? "bg-card text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground"
								)}
								key={m}
								onClick={() => setMode(m)}
								type="button"
							>
								{m === "preset" ? "Quick amounts" : "Custom"}
							</button>
						))}
					</div>

					{/* Amount input */}
					{mode === "preset" ? (
						<div className="grid grid-cols-3 gap-2">
							{PRESETS.map((p) => {
								const active = selected === p;
								return (
									<button
										className={cn(
											"rounded-xl border py-3 font-bold text-xs transition-all",
											active
												? "border-primary/50 bg-primary/10 text-primary"
												: "border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:text-foreground"
										)}
										key={p}
										onClick={() => setSelected(p)}
										type="button"
									>
										₦{p.toLocaleString()}
									</button>
								);
							})}
						</div>
					) : (
						<div className="relative">
							<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-bold text-primary text-sm">
								₦
							</span>
							<Input
								autoFocus
								className={cn(
									"h-11 pl-7 font-bold font-mono text-lg",
									custom && valid && "border-primary/50 ring-primary/20"
								)}
								max={5_000_000}
								min={100}
								onChange={(e) => setCustom(e.target.value)}
								placeholder="0"
								type="number"
								value={custom}
							/>
						</div>
					)}

					{/* Coverage */}
					{valid && (
						<div className="grid grid-cols-2 gap-2">
							{[
								{
									label: "WhatsApp",
									count: waMsgs,
									color: "text-primary",
									bg: "bg-primary/5 border-primary/15",
								},
								{
									label: "SMS",
									count: smsMsgs,
									color: "text-blue-400",
									bg: "bg-blue-400/5 border-blue-400/15",
								},
							].map(({ label, count, color, bg }) => (
								<div className={cn("rounded-xl border p-3", bg)} key={label}>
									<p
										className={cn(
											"font-bold text-[10px] uppercase tracking-wider",
											color
										)}
									>
										{label}
									</p>
									<p className="mt-1 font-bold font-mono text-base text-foreground">
										~{count.toLocaleString()}
									</p>
								</div>
							))}
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-destructive text-xs">
							<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
							{error instanceof Error
								? error.message
								: "Payment failed. Please try again."}
						</div>
					)}

					{/* Pay button */}
					<Button
						className="w-full rounded-xl font-bold"
						disabled={!valid || isPending}
						onClick={pay}
						size="lg"
					>
						{isPending ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" /> Opening Paystack…
							</>
						) : (
							<>
								<ExternalLink className="h-4 w-4" /> Pay{" "}
								{valid ? `₦${amount.toLocaleString()}` : ""} via Paystack
							</>
						)}
					</Button>

					<p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground">
						<Shield className="h-3 w-3" /> Cards · Bank transfer · USSD · POS
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── Wallet Card ──────────────────────────────────────────────────────────────

function WalletCard({ onDeposit }: { onDeposit: () => void }) {
	const { data: wallet, isLoading, refetch, isFetching } = useWallet();

	const balanceKobo = wallet?.balanceKobo ?? 0;
	const heldKobo = wallet?.heldKobo ?? 0;
	const availKobo = balanceKobo - heldKobo;

	return (
		<Card className="overflow-hidden">
			{/* Balance area — subtle gradient tint */}
			<div className="border-border border-b bg-linear-to-br from-primary/5 to-transparent px-5 pt-5 pb-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
							<Wallet className="h-3.5 w-3.5 text-primary" />
						</div>
						<span className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
							Wallet Balance
						</span>
					</div>
					<Button
						className="h-7 w-7 rounded-lg"
						disabled={isFetching}
						onClick={() => refetch()}
						size="icon"
						variant="ghost"
					>
						<RefreshCw
							className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
						/>
					</Button>
				</div>

				{isLoading ? (
					<Skeleton className="mb-1 h-10 w-40" />
				) : (
					<>
						<p className="font-bold font-mono text-3xl text-foreground tracking-tight">
							₦{(balanceKobo / 100).toLocaleString()}
						</p>
						{heldKobo > 0 && (
							<p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
								<Clock className="h-3 w-3" />₦
								{(availKobo / 100).toLocaleString()} available
								<span className="text-muted-foreground/50">·</span>₦
								{(heldKobo / 100).toLocaleString()} reserved
							</p>
						)}
					</>
				)}
			</div>

			<CardContent className="flex flex-col gap-3 p-4">
				{/* Rate pills */}
				<div className="grid grid-cols-2 gap-2">
					{[
						{
							label: "WhatsApp",
							rate: "₦5 / msg",
							color: "text-primary",
							bg: "bg-primary/5 border-primary/15",
						},
						{
							label: "SMS",
							rate: "₦2.50 / msg",
							color: "text-blue-400",
							bg: "bg-blue-400/5 border-blue-400/15",
						},
					].map(({ label, rate, color, bg }) => (
						<div
							className={cn("rounded-xl border px-3 py-2.5", bg)}
							key={label}
						>
							<p
								className={cn(
									"font-bold text-[10px] uppercase tracking-wider",
									color
								)}
							>
								{label}
							</p>
							<p className="mt-0.5 font-mono font-semibold text-foreground text-sm">
								{rate}
							</p>
						</div>
					))}
				</div>

				<Button
					className="w-full rounded-xl border-primary/30 font-bold text-primary hover:bg-primary/10 hover:text-primary"
					onClick={onDeposit}
					variant="outline"
				>
					<Plus className="h-4 w-4" /> Top Up Wallet
				</Button>
			</CardContent>
		</Card>
	);
}

// ─── Subscription Card ────────────────────────────────────────────────────────

const PLAN_META: Record<
	string,
	{ color: string; bg: string; border: string; badgeCls: string }
> = {
	starter: {
		color: "text-blue-400",
		bg: "bg-blue-400/5",
		border: "border-blue-400/20",
		badgeCls: "bg-blue-400/10 text-blue-400 border-blue-400/30",
	},
	growth: {
		color: "text-violet-400",
		bg: "bg-violet-400/5",
		border: "border-violet-400/20",
		badgeCls: "bg-violet-400/10 text-violet-400 border-violet-400/30",
	},
	pro: {
		color: "text-amber-400",
		bg: "bg-amber-400/5",
		border: "border-amber-400/20",
		badgeCls: "bg-amber-400/10 text-amber-400 border-amber-400/30",
	},
};
const PLAN_FEATURES: Record<string, string[]> = {
	starter: ["500 msgs / month", "WhatsApp + SMS", "Campaign history"],
	growth: ["2,000 msgs / month", "WhatsApp + SMS", "Priority support"],
	pro: [
		"Unlimited messages",
		"WhatsApp + SMS",
		"Dedicated support",
		"Analytics",
	],
};

function SubscriptionCard() {
	const { data, isLoading } = useSubscription();
	const { mutateAsync: initSub, isPending: subPending } = useInitSubscription();
	const { mutateAsync: cancelSub, isPending: cancelPending } =
		useCancelSubscription();
	const [cancelConfirm, setCancelConfirm] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const sub = data?.subscription;
	const plans = data?.plans ?? [];

	async function subscribe(planKey: string) {
		setErr(null);
		try {
			const r = await initSub({
				plan: planKey as "starter" | "growth" | "pro",
				callbackUrl: `${window.location.origin}/billing/verify?type=subscription`,
			});
			window.location.href = r.checkoutUrl;
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Failed to start subscription");
		}
	}

	async function cancel() {
		setErr(null);
		try {
			await cancelSub({});
			setCancelConfirm(false);
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Failed to cancel");
		}
	}

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2.5">
				{[0, 1, 2].map((i) => (
					<Skeleton className="h-28 rounded-2xl" key={i} />
				))}
			</div>
		);
	}

	// ── Active subscription ───────────────────────────────────────────────────
	if (sub) {
		const m = PLAN_META[sub.plan] ?? PLAN_META.starter;
		const pct = Math.min(100, sub.usagePercent ?? 0);
		const renewStr = new Date(sub.currentPeriodEnd).toLocaleDateString(
			"en-GB",
			{
				day: "numeric",
				month: "long",
			}
		);

		return (
			<Card className={cn("overflow-hidden border", m.border)}>
				<div
					className={cn(
						"flex items-center justify-between border-b px-5 py-3.5",
						m.bg,
						m.border
					)}
				>
					<div className="flex items-center gap-2">
						<Sparkles className={cn("h-3.5 w-3.5", m.color)} />
						<span className={cn("font-bold text-sm capitalize", m.color)}>
							{sub.plan} Plan
						</span>
					</div>
					<Badge
						className={cn(
							"font-bold text-[10px] capitalize",
							sub.status === "active"
								? "border-primary/30 bg-primary/10 text-primary"
								: "border-destructive/30 bg-destructive/10 text-destructive"
						)}
						variant="outline"
					>
						{sub.status}
					</Badge>
				</div>

				<CardContent className="flex flex-col gap-4 p-4">
					{/* Usage */}
					<div>
						<div className="mb-2 flex justify-between text-xs">
							<span className="text-muted-foreground">Messages used</span>
							<span className="font-mono font-semibold text-foreground">
								{sub.messagesUsedThisCycle?.toLocaleString() ?? 0}
								{" / "}
								{sub.monthlyMessageLimit === 999_999
									? "∞"
									: sub.monthlyMessageLimit?.toLocaleString()}
							</span>
						</div>
						<Progress
							className={cn("h-1.5", pct > 85 && "[&>div]:bg-amber-400")}
							value={pct}
						/>
						{pct > 85 && (
							<p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-400">
								<AlertTriangle className="h-3 w-3" /> Approaching monthly limit
							</p>
						)}
					</div>

					<p className="text-muted-foreground text-xs">
						{sub.status === "cancelled" ? "Active until" : "Renews"}{" "}
						<strong className="text-foreground">{renewStr}</strong>
					</p>

					{sub.status === "active" && !cancelConfirm && (
						<button
							className="w-fit text-muted-foreground/60 text-xs underline transition-colors hover:text-muted-foreground"
							onClick={() => setCancelConfirm(true)}
							type="button"
						>
							Cancel subscription
						</button>
					)}

					{cancelConfirm && (
						<div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5">
							<p className="text-destructive text-xs">
								Cancel plan? Access continues until {renewStr}.
							</p>
							<div className="grid grid-cols-2 gap-2">
								<Button
									className="rounded-lg"
									onClick={() => setCancelConfirm(false)}
									size="sm"
									variant="outline"
								>
									Keep plan
								</Button>
								<Button
									className="rounded-lg"
									disabled={cancelPending}
									onClick={cancel}
									size="sm"
									variant="destructive"
								>
									{cancelPending ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
									) : (
										<XCircle className="h-3.5 w-3.5" />
									)}
									Yes, cancel
								</Button>
							</div>
						</div>
					)}

					{err && <p className="text-destructive text-xs">{err}</p>}
				</CardContent>
			</Card>
		);
	}

	// ── Plan picker ───────────────────────────────────────────────────────────
	return (
		<div className="flex gap-2.5">
			{plans.map((plan) => {
				const m = PLAN_META[plan.key] ?? PLAN_META.starter;
				const feats = PLAN_FEATURES[plan.key] ?? [];
				return (
					<Card
						className={cn("overflow-hidden border", m.border)}
						key={plan.key}
					>
						<div
							className={cn(
								"flex items-center justify-between border-b px-4 py-3.5",
								m.bg,
								m.border
							)}
						>
							<div>
								<p className={cn("font-bold text-sm capitalize", m.color)}>
									{plan.label}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{plan.monthlyLimit?.toLocaleString()} msgs / month
								</p>
							</div>
							<div className="text-right">
								<p className="font-bold font-mono text-foreground text-lg">
									{plan.priceFormatted}
								</p>
								<p className="text-[10px] text-muted-foreground">/ month</p>
							</div>
						</div>
						<CardContent className="flex flex-col gap-3 p-4">
							<div className="flex flex-wrap gap-x-3 gap-y-1.5">
								{feats.map((f) => (
									<span
										className="flex items-center gap-1.5 text-muted-foreground text-xs"
										key={f}
									>
										<CheckCircle2 className={cn("h-3 w-3 shrink-0", m.color)} />{" "}
										{f}
									</span>
								))}
							</div>
							<Button
								className={cn(
									"w-full rounded-xl border font-bold",
									m.border,
									m.bg,
									m.color,
									"hover:opacity-80"
								)}
								disabled={subPending}
								onClick={() => subscribe(plan.key)}
								size="sm"
								variant="outline"
							>
								{subPending ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Zap className="h-3.5 w-3.5" />
								)}
								Subscribe to {plan.label}
							</Button>
						</CardContent>
					</Card>
				);
			})}
			{err && <p className="text-destructive text-xs">{err}</p>}
		</div>
	);
}

// ─── Transaction Table ────────────────────────────────────────────────────────

type TxFilter =
	| "all"
	| "deposit"
	| "message_debit"
	| "subscription"
	| "campaign_refund";
const TX_FILTERS: { label: string; value: TxFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Deposits", value: "deposit" },
	{ label: "Messages", value: "message_debit" },
	{ label: "Plans", value: "subscription" },
	{ label: "Refunds", value: "campaign_refund" },
];

const TX_ICON: Record<string, React.ReactNode> = {
	deposit: <ArrowDownLeft className="h-3.5 w-3.5" />,
	message_debit: <MessageCircle className="h-3.5 w-3.5" />,
	subscription: <RefreshCw className="h-3.5 w-3.5" />,
	campaign_refund: <RotateCcw className="h-3.5 w-3.5" />,
	refund: <RotateCcw className="h-3.5 w-3.5" />,
};
const TX_LABEL: Record<string, string> = {
	deposit: "Deposit",
	message_debit: "Message",
	subscription: "Subscription",
	campaign_refund: "Refund",
	refund: "Refund",
};

function TransactionTable() {
	const [filter, setFilter] = useState<TxFilter>("all");
	const [page, setPage] = useState(1);
	const { data, isLoading, isFetching } = useTransactions(page);

	const rows = (data?.transactions ?? []) as Record<string, unknown>[];
	const pages = data?.pagination;

	return (
		<Card>
			{/* Filter bar */}
			<CardHeader className="flex-row flex-wrap items-center gap-2.5 border-border border-b px-5 py-3.5">
				<CardTitle className="mr-auto text-sm">Transaction History</CardTitle>
				<div className="flex flex-wrap gap-1.5">
					{TX_FILTERS.map((f) => {
						const active = filter === f.value;
						return (
							<button
								className={cn(
									"rounded-full border px-3 py-1 font-semibold text-xs transition-all",
									active
										? "border-primary/40 bg-primary/10 text-primary"
										: "border-border bg-transparent text-muted-foreground hover:border-border/70 hover:text-foreground"
								)}
								key={f.value}
								onClick={() => {
									setFilter(f.value);
									setPage(1);
								}}
								type="button"
							>
								{f.label}
							</button>
						);
					})}
				</div>
			</CardHeader>

			{/* Table */}
			{isLoading ? (
				<div className="flex flex-col gap-2.5 p-5">
					{[...new Array(6)].map((_, i) => (
						<Skeleton
							className="h-14 w-full rounded-xl"
							key={i.toString()}
							style={{ animationDelay: `${i * 60}ms` }}
						/>
					))}
				</div>
			) : rows.length === 0 ? (
				<div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
						<TrendingUp className="h-5 w-5 text-muted-foreground" />
					</div>
					<p className="text-muted-foreground text-sm">No transactions yet</p>
					<p className="text-muted-foreground/60 text-xs">
						Top up your wallet to get started
					</p>
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow className="border-border hover:bg-transparent">
							<TableHead className="h-9 pl-5 font-bold text-[10px] text-muted-foreground/60 uppercase tracking-wider">
								Description
							</TableHead>
							<TableHead className="h-9 text-right font-bold text-[10px] text-muted-foreground/60 uppercase tracking-wider">
								Amount
							</TableHead>
							<TableHead className="hidden h-9 text-right font-bold text-[10px] text-muted-foreground/60 uppercase tracking-wider sm:table-cell">
								Balance
							</TableHead>
							<TableHead className="hidden h-9 pr-5 text-right font-bold text-[10px] text-muted-foreground/60 uppercase tracking-wider md:table-cell">
								Date
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((tx) => {
							const type = tx.type as string;
							const isCredit = tx.isCredit as boolean;
							const status = tx.status as string;
							const statusCls =
								status === "completed"
									? "bg-primary/10 text-primary border-primary/20"
									: status === "failed"
										? "bg-destructive/10 text-destructive border-destructive/20"
										: "bg-amber-400/10 text-amber-400 border-amber-400/20";

							return (
								<TableRow className="group border-border" key={tx.id as string}>
									{/* Description */}
									<TableCell className="py-3 pl-5">
										<div className="flex items-center gap-3">
											<div
												className={cn(
													"flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
													isCredit
														? "border-primary/20 bg-primary/10 text-primary"
														: "border-blue-400/20 bg-blue-400/10 text-blue-400"
												)}
											>
												{isCredit ? (
													<ArrowDownLeft className="h-3.5 w-3.5" />
												) : (
													(TX_ICON[type] ?? (
														<ArrowUpRight className="h-3.5 w-3.5" />
													))
												)}
											</div>
											<div className="min-w-0">
												<p className="max-w-[200px] truncate font-medium text-foreground text-sm">
													{tx.description as string}
												</p>
												<div className="mt-0.5 flex items-center gap-1.5">
													<Badge
														className={cn(
															"px-1.5 py-0 font-bold text-[9px]",
															statusCls
														)}
														variant="outline"
													>
														{status}
													</Badge>
													<span className="text-[10px] text-muted-foreground/60">
														{TX_LABEL[type] ?? type}
													</span>
												</div>
											</div>
										</div>
									</TableCell>

									{/* Amount */}
									<TableCell className="text-right font-bold font-mono text-sm">
										<span
											className={isCredit ? "text-primary" : "text-foreground"}
										>
											{isCredit ? "+" : "−"}
											{tx.amountFormatted as string}
										</span>
									</TableCell>

									{/* Balance after */}
									<TableCell className="hidden text-right font-mono text-muted-foreground text-xs sm:table-cell">
										{tx.balanceAfterFormatted as string}
									</TableCell>

									{/* Date */}
									<TableCell className="hidden pr-5 text-right text-muted-foreground text-xs md:table-cell">
										{new Date(tx.createdAt as string).toLocaleDateString(
											"en-GB",
											{
												day: "numeric",
												month: "short",
												year: "numeric",
											}
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}

			{/* Pagination */}
			{pages && pages.totalPages > 1 && (
				<>
					<Separator />
					<div className="flex items-center justify-between px-5 py-3">
						<span className="text-muted-foreground text-xs">
							Page {pages.page} of {pages.totalPages}
						</span>
						<div className="flex gap-1.5">
							<Button
								className="h-7 w-7 rounded-lg"
								disabled={pages.page <= 1 || isFetching}
								onClick={() => setPage((p) => p - 1)}
								size="icon"
								variant="outline"
							>
								<ChevronLeft className="h-3.5 w-3.5" />
							</Button>
							<Button
								className="h-7 w-7 rounded-lg"
								disabled={pages.page >= pages.totalPages || isFetching}
								onClick={() => setPage((p) => p + 1)}
								size="icon"
								variant="outline"
							>
								<ChevronRight className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				</>
			)}
		</Card>
	);
}

// ─── Root BillingView ─────────────────────────────────────────────────────────

export function BillingView() {
	const [depositOpen, setDepositOpen] = useState(false);

	return (
		<section className="mx-auto w-full max-w-6xl">
			<div className="w-full animate-fade-up px-6 py-10">
				{/* Page header */}
				<div className="mb-8">
					<h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
						Billing
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage your wallet, subscription and view transaction history
					</p>
				</div>

				<div className="grid grid-cols-1 items-start gap-6">
					{/* Left column */}
					<div className="flex flex-col gap-5">
						<div>
							<p className="mb-3 font-bold text-[10px] text-muted-foreground uppercase tracking-widest">
								Wallet
							</p>
							<WalletCard onDeposit={() => setDepositOpen(true)} />
						</div>
						<div>
							<p className="mb-3 font-bold text-[10px] text-muted-foreground uppercase tracking-widest">
								Plan
							</p>
							<SubscriptionCard />
						</div>
						{/* Right column */}
						<TransactionTable />
					</div>
				</div>
			</div>

			<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
		</section>
	);
}
