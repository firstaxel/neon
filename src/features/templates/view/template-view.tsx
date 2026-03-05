/**
 * TemplatesView  —  /templates
 *
 * URL state (nuqs):
 *   ?channel=whatsapp|sms          active channel tab
 *   ?status=ALL|DRAFT|PENDING|...  WA status sub-tab
 *   ?search=...                     search query
 *   ?category=...                   category filter
 *
 * Create / edit navigate to dedicated pages:
 *   /templates/whatsapp/new   /templates/whatsapp/[id]
 *   /templates/sms/new        /templates/sms/[id]
 */

import {
	CheckCircle2,
	Clock,
	MessageSquare,
	Phone,
	XCircle,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { PageHeader } from "#/components/shared/page-header";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import {
	useTemplates,
	type WaTemplateStatus,
} from "#/features/templates/hooks/use-templates";
import { SmsTemplateListView } from "#/features/templates/view/sms-list-view";
import { WaTemplateListView } from "#/features/templates/view/whatsapp-list-view";
import type { WaCategory } from "../category/whatsapp/templates";

// ─── Param parsers ─────────────────────────────────────────────────────────────

const CHANNELS = ["whatsapp", "sms"] as const;
const WA_STATUS = ["ALL", "DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
	icon,
	label,
	count,
	accent,
	loading,
}: {
	icon: React.ReactNode;
	label: string;
	count: number;
	accent: string;
	loading: boolean;
}) {
	return (
		<div
			className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${accent}`}
		>
			<div className="shrink-0 opacity-70">{icon}</div>
			<div className="min-w-0">
				{loading ? (
					<Skeleton className="mb-0.5 h-5 w-8" />
				) : (
					<p className="font-bold text-lg tabular-nums leading-tight">
						{count}
					</p>
				)}
				<p className="truncate text-[11px] text-muted-foreground">{label}</p>
			</div>
		</div>
	);
}

// ─── Channel tab ───────────────────────────────────────────────────────────────

function ChannelTab({
	channel,
	active,
	label,
	icon,
	count,
	loading,
	onClick,
}: {
	channel: "whatsapp" | "sms";
	active: boolean;
	label: string;
	icon: React.ReactNode;
	count: number;
	loading: boolean;
	onClick: () => void;
}) {
	const isWa = channel === "whatsapp";
	const activeCs = isWa
		? "border-[#25d36650] bg-[#0d2016] ring-1 ring-[#25d36625]"
		: "border-[#60a5fa50] bg-[#0d1a2e] ring-1 ring-[#60a5fa25]";
	const iconCs = isWa ? "text-[#25d366]" : "text-[#60a5fa]";
	const iconBg = isWa
		? "bg-[#0d2016] border-[#25d36630]"
		: "bg-[#0d1a2e] border-[#60a5fa30]";
	const dotCs = isWa ? "bg-[#25d366]" : "bg-[#60a5fa]";

	return (
		<button
			className={[
				"flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-left transition-all duration-200",
				active
					? activeCs
					: "border-border bg-card hover:border-muted-foreground/30",
			].join(" ")}
			onClick={onClick}
			type="button"
		>
			<div
				className={`flex h-9 w-9 items-center justify-center rounded-xl border ${active ? iconBg : "border-border bg-muted/40"}`}
			>
				<span className={active ? iconCs : "text-muted-foreground"}>
					{icon}
				</span>
			</div>
			<div className="min-w-0 flex-1">
				<p
					className={`font-semibold text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}
				>
					{label}
				</p>
				<p className="text-[11px] text-muted-foreground">
					{loading ? "…" : `${count} template${count !== 1 ? "s" : ""}`}
				</p>
			</div>
			{active && <div className={`h-2 w-2 shrink-0 rounded-full ${dotCs}`} />}
		</button>
	);
}

// ─── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({
	label,
	active,
	count,
	onClick,
}: {
	label: string;
	active: boolean;
	count: number;
	onClick: () => void;
}) {
	return (
		<button
			className={[
				"flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs transition-all",
				active
					? "border-primary bg-primary/10 text-primary"
					: "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
			].join(" ")}
			onClick={onClick}
			type="button"
		>
			{label}
			<span
				className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-primary/20" : "bg-muted"}`}
			>
				{count}
			</span>
		</button>
	);
}

// ─── TemplatesView ─────────────────────────────────────────────────────────────

export function TemplatesView() {
	const [channel, setChannel] = useQueryState(
		"channel",
		parseAsStringLiteral(CHANNELS).withDefault("whatsapp")
	);
	const [status, setStatus] = useQueryState(
		"status",
		parseAsStringLiteral(WA_STATUS).withDefault("ALL")
	);
	const [search, setSearch] = useQueryState(
		"search",
		parseAsString.withDefault("")
	);
	const [category, setCategory] = useQueryState(
		"category",
		parseAsString.withDefault("")
	);

	const isWa = channel === "whatsapp";

	const { data: waTemplates, isLoading: waLoading } = useTemplates({
		channel: "whatsapp",
	});
	const { data: smsTemplates, isLoading: smsLoading } = useTemplates({
		channel: "sms",
	});

	const waCounts = {
		total: waTemplates?.length ?? 0,
		approved: waTemplates?.filter((t) => t.status === "APPROVED").length ?? 0,
		pending: waTemplates?.filter((t) => t.status === "PENDING").length ?? 0,
		rejected: waTemplates?.filter((t) => t.status === "REJECTED").length ?? 0,
		draft: waTemplates?.filter((t) => t.status === "DRAFT").length ?? 0,
	};
	const smsCount = smsTemplates?.length ?? 0;

	function handleChannelChange(ch: (typeof CHANNELS)[number]) {
		setChannel(ch);
		setStatus("ALL");
		setSearch("");
		setCategory("");
	}

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-8">
			<PageHeader
				description="Manage message templates for WhatsApp campaigns and SMS outreach."
				title="Templates"
			/>

			{/* ── Channel toggles ── */}
			<div className="mt-6 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
				<ChannelTab
					active={isWa}
					channel="whatsapp"
					count={waCounts.total}
					icon={<MessageSquare className="h-4 w-4" />}
					label="WhatsApp"
					loading={waLoading}
					onClick={() => handleChannelChange("whatsapp")}
				/>
				<ChannelTab
					active={!isWa}
					channel="sms"
					count={smsCount}
					icon={<Phone className="h-4 w-4" />}
					label="SMS"
					loading={smsLoading}
					onClick={() => handleChannelChange("sms")}
				/>
			</div>

			{/* ── WA stat bar ── */}
			{isWa && (
				<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<StatCard
						accent="border-border"
						count={waCounts.total}
						icon={<MessageSquare className="h-4 w-4" />}
						label="Total"
						loading={waLoading}
					/>
					<StatCard
						accent="border-emerald-500/20 text-emerald-400"
						count={waCounts.approved}
						icon={<CheckCircle2 className="h-4 w-4" />}
						label="Approved"
						loading={waLoading}
					/>
					<StatCard
						accent="border-amber-500/20 text-amber-400"
						count={waCounts.pending}
						icon={<Clock className="h-4 w-4" />}
						label="Pending"
						loading={waLoading}
					/>
					<StatCard
						accent="border-destructive/20 text-destructive"
						count={waCounts.rejected}
						icon={<XCircle className="h-4 w-4" />}
						label="Rejected"
						loading={waLoading}
					/>
				</div>
			)}

			{/* ── Toolbar: status pills + search + category + new button ── */}
			<div className="mt-5 space-y-3">
				{/* WA status sub-tabs */}
				{isWa && (
					<div className="flex flex-wrap gap-2">
						{(
							[
								["ALL", "All", waCounts.total],
								["DRAFT", "Draft", waCounts.draft],
								["PENDING", "Pending", waCounts.pending],
								["APPROVED", "Approved", waCounts.approved],
								["REJECTED", "Rejected", waCounts.rejected],
							] as const
						).map(([tab, label, count]) => (
							<StatusPill
								active={status === tab}
								count={count}
								key={tab}
								label={label}
								onClick={() => setStatus(tab)}
							/>
						))}
					</div>
				)}

				{/* Search + category + new button */}
			</div>

			<Separator className="mt-4 mb-6" />

			{/* ── Content — pass URL state down as props ── */}
			{isWa ? (
				<WaTemplateListView
					category={category as WaCategory | undefined}
					createHref="/templates/create/whatsapp"
					editHref={(id) => `/template/whatsapp/${id}`}
					// Navigation handled by list view — no inline create/edit
					search={search || undefined}
					statusFilter={
						status === "ALL" ? undefined : (status as WaTemplateStatus)
					}
				/>
			) : (
				<SmsTemplateListView
					category={category as WaCategory | undefined}
					createHref="/templates/create/sms"
					editHref={(id) => `/templates/sms/${id}`}
					search={search || undefined}
				/>
			)}
		</div>
	);
}
