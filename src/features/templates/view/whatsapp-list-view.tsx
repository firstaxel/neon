/**
 * WaTemplateListView
 *
 * Full-page template management view.
 *
 * States:
 *   "list"   — grid of template cards with filters
 *   "create" — full WaTemplateEditor for new templates
 *   "edit"   — full WaTemplateEditor for existing template
 *
 * Card actions:
 *   DRAFT    → Edit, Submit to WhatsApp, Delete
 *   PENDING  → Sync status, Delete
 *   APPROVED → View (read-only), Sync status, Delete
 *   REJECTED → Edit (re-opens editor), Delete
 */

import { Link, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	ExternalLink,
	FileText,
	Loader2,
	MessageSquare,
	MoreHorizontal,
	Pencil,
	Phone,
	Plus,
	RefreshCw,
	Search,
	Send,
	Trash2,
	XCircle,
	Zap,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import {
	useDeleteTemplate,
	useSubmitTemplate,
	useSyncTemplateStatus,
	useTemplates,
	type WaCategory,
	type WaTemplate,
	type WaTemplateStatus,
} from "../hooks/use-templates";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
	WaTemplateStatus,
	{
		label: string;
		icon: React.ReactNode;
		badge: string;
	}
> = {
	DRAFT: {
		label: "Draft",
		icon: <FileText className="h-3 w-3" />,
		badge: "border-border text-muted-foreground bg-muted/30",
	},
	PENDING: {
		label: "Pending",
		icon: <Clock className="h-3 w-3" />,
		badge: "border-amber-500/40 text-amber-400 bg-amber-500/8",
	},
	APPROVED: {
		label: "Approved",
		icon: <CheckCircle2 className="h-3 w-3" />,
		badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/8",
	},
	REJECTED: {
		label: "Rejected",
		icon: <XCircle className="h-3 w-3" />,
		badge: "border-destructive/40 text-destructive bg-destructive/8",
	},
	PAUSED: {
		label: "Paused",
		icon: <AlertCircle className="h-3 w-3" />,
		badge: "border-orange-500/40 text-orange-400 bg-orange-500/8",
	},
	DISABLED: {
		label: "Disabled",
		icon: <XCircle className="h-3 w-3" />,
		badge: "border-muted-foreground/30 text-muted-foreground bg-muted/20",
	},
};

const CATEGORY_LABELS: Record<WaCategory, string> = {
	MARKETING: "Marketing",
	UTILITY: "Utility",
	AUTHENTICATION: "Auth",
};

const ALL = "ALL";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WaTemplateStatus }) {
	const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-[10px] ${cfg.badge}`}
		>
			{cfg.icon}
			{cfg.label}
		</span>
	);
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
	template,
	onEdit,
	onSelect,
	selected,
}: {
	template: WaTemplate;
	onEdit: (t: WaTemplate) => void;
	onSelect?: (t: WaTemplate) => void;
	selected?: boolean;
}) {
	const [delOpen, setDelOpen] = useState(false);
	const { mutate: del, isPending: deleting } = useDeleteTemplate();
	const { mutate: submit, isPending: submitting } = useSubmitTemplate();
	const { mutate: sync, isPending: syncing } = useSyncTemplateStatus();

	const canEdit = ["DRAFT", "REJECTED"].includes(template.status);
	const canSubmit = ["DRAFT", "REJECTED"].includes(template.status);
	const canSync =
		["PENDING", "APPROVED", "PAUSED", "DISABLED"].includes(template.status) &&
		!!template.waTemplateId;

	function handleSubmit() {
		submit(
			{
				id: template.id,
			},
			{
				onSuccess: () =>
					toast.success("Submitted!", {
						description: `"${template.displayName}" is now pending Meta review.`,
					}),
				onError: (e) =>
					toast.error("Submission failed", {
						description: (e as Error).message,
					}),
			}
		);
	}

	function handleSync() {
		sync(
			{ id: template.id },
			{
				onSuccess: (t) =>
					toast.success("Status updated", {
						description: `Template is now ${t.status}.`,
					}),
				onError: (e) =>
					toast.error("Sync failed", {
						description: (e as Error).message,
					}),
			}
		);
	}

	return (
		<>
			<div
				className={[
					"group flex flex-col rounded-2xl border bg-card transition-all duration-200",
					selected
						? "border-primary ring-2 ring-primary/20"
						: "hover:border-muted-foreground/30",
				].join(" ")}
			>
				{/* Header */}
				<div className="flex items-start gap-3 p-4">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate font-semibold text-sm">
								{template.displayName}
							</p>
							<StatusBadge status={template.status as WaTemplateStatus} />
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-2">
							<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
								{template.name}
							</code>
							<Badge className="rounded-full text-[10px]" variant="outline">
								{CATEGORY_LABELS[template.category as WaCategory] ??
									template.category}
							</Badge>
							<span className="text-[10px] text-muted-foreground">
								{template.language}
							</span>
						</div>
					</div>

					{/* Actions dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
									size="icon"
									variant="ghost"
								>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="end" className="w-44 rounded-xl">
							{canEdit && (
								<DropdownMenuItem onClick={() => onEdit(template)}>
									<Pencil className="mr-2 h-3.5 w-3.5" /> Edit
								</DropdownMenuItem>
							)}
							{!canEdit && (
								<DropdownMenuItem onClick={() => onEdit(template)}>
									<FileText className="mr-2 h-3.5 w-3.5" /> View
								</DropdownMenuItem>
							)}
							{canSubmit && (
								<DropdownMenuItem disabled={submitting} onClick={handleSubmit}>
									<Send className="mr-2 h-3.5 w-3.5" />
									{submitting ? "Submitting…" : "Submit to WhatsApp"}
								</DropdownMenuItem>
							)}
							{canSync && (
								<DropdownMenuItem disabled={syncing} onClick={handleSync}>
									<RefreshCw
										className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
									/>
									{syncing ? "Syncing…" : "Sync status"}
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => setDelOpen(true)}
							>
								<Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<Separator />

				{/* Preview snippets */}
				<div className="flex flex-1 flex-col gap-2 p-4 pt-3">
					{/* WhatsApp body preview */}
					<div className="rounded-lg border border-[#25d36625] bg-[#0d2016] px-3 py-2">
						<div className="mb-1 flex items-center gap-1">
							<MessageSquare className="h-2.5 w-2.5 text-[#25d366]" />
							<span className="font-bold text-[#25d366] text-[9px] uppercase tracking-wider">
								WhatsApp
							</span>
							{template.headerFormat && (
								<span className="ml-auto text-[9px] text-muted-foreground uppercase">
									{template.headerFormat.toLowerCase()} header
								</span>
							)}
						</div>
						<p className="line-clamp-2 text-[11px] text-foreground/70 leading-relaxed">
							{template.bodyText.replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`)}
						</p>
					</div>

					{/* SMS fallback */}
					<div className="rounded-lg border border-[#60a5fa25] bg-[#0d1a2e] px-3 py-2">
						<div className="mb-1 flex items-center gap-1">
							<Phone className="h-2.5 w-2.5 text-[#60a5fa]" />
							<span className="font-bold text-[#60a5fa] text-[9px] uppercase tracking-wider">
								SMS Fallback
							</span>
						</div>
						<p className="line-clamp-1 text-[11px] text-foreground/70 leading-relaxed">
							{template.smsBody.replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`)}
						</p>
					</div>

					{/* Buttons summary */}
					{template.buttons && template.buttons.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{template.buttons.map((btn, i) => (
								<span
									className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
									key={i.toString()}
								>
									{(btn as { type: string }).type === "URL" && (
										<ExternalLink className="h-2.5 w-2.5" />
									)}
									{(btn as { type: string }).type === "PHONE_NUMBER" && (
										<Phone className="h-2.5 w-2.5" />
									)}
									{(btn as { text: string }).text}
								</span>
							))}
						</div>
					)}
				</div>

				{/* Footer: usage + submission actions */}
				<Separator />
				<div className="flex items-center justify-between px-4 py-2.5">
					<div className="flex items-center gap-3">
						{template.usageCount > 0 && (
							<span className="flex items-center gap-1 text-[10px] text-muted-foreground">
								<Zap className="h-2.5 w-2.5" /> {template.usageCount}× used
							</span>
						)}
						{template.rejectionReason && (
							<span
								className="flex items-center gap-1 text-[10px] text-destructive"
								title={template.rejectionReason}
							>
								<AlertCircle className="h-2.5 w-2.5" /> Rejected
							</span>
						)}
					</div>

					<div className="flex items-center gap-1.5">
						{canSubmit && (
							<Button
								className="h-7 gap-1 rounded-lg text-xs"
								disabled={submitting}
								onClick={handleSubmit}
								size="sm"
								variant="outline"
							>
								{submitting ? (
									<>
										<Loader2 className="h-3 w-3 animate-spin" /> Submitting…
									</>
								) : (
									<>
										<Send className="h-3 w-3" /> Submit
									</>
								)}
							</Button>
						)}
						{canSync && (
							<Button
								className="h-7 gap-1 rounded-lg text-xs"
								disabled={syncing}
								onClick={handleSync}
								size="sm"
								variant="ghost"
							>
								<RefreshCw
									className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
								/>
							</Button>
						)}
						{onSelect &&
							(() => {
								const statusLabel =
									STATUS_CONFIG[template.status as WaTemplateStatus]?.label;
								const buttonContent = selected ? (
									<>
										<CheckCircle2 className="h-3 w-3" /> Selected
									</>
								) : template.status === "APPROVED" ? (
									"Use"
								) : (
									`(${statusLabel})`
								);

								return (
									<Button
										className="h-7 gap-1 rounded-lg text-xs"
										disabled={template.status !== "APPROVED"}
										onClick={() => onSelect(template)}
										size="sm"
										variant={selected ? "default" : "outline"}
									>
										{buttonContent}
									</Button>
								);
							})()}
					</div>
				</div>
			</div>

			{/* Delete confirmation */}
			<AlertDialog onOpenChange={setDelOpen} open={delOpen}>
				<AlertDialogContent className="rounded-2xl">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete template?</AlertDialogTitle>
						<AlertDialogDescription>
							<strong className="text-foreground">
								"{template.displayName}"
							</strong>{" "}
							will be permanently deleted
							{template.waTemplateId &&
								" and removed from your WhatsApp Business Account"}
							. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleting}
							onClick={() =>
								del({
									id: template.id,
								})
							}
						>
							{deleting ? (
								<>
									<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{" "}
									Deleting…
								</>
							) : (
								"Delete template"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

// ─── Grid skeletons ───────────────────────────────────────────────────────────

function GridSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<div className="space-y-3 rounded-2xl border p-4" key={i.toString()}>
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-5 w-16 rounded-full" />
					</div>
					<Skeleton className="h-16 w-full rounded-lg" />
					<Skeleton className="h-10 w-full rounded-lg" />
					<div className="flex justify-between">
						<Skeleton className="h-7 w-20 rounded-lg" />
						<Skeleton className="h-7 w-16 rounded-lg" />
					</div>
				</div>
			))}
		</div>
	);
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
	hasFilters,
	onCreateClick,
}: {
	hasFilters: boolean;
	onCreateClick: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-20 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
				{hasFilters ? (
					<Search className="h-7 w-7 text-muted-foreground" />
				) : (
					<MessageSquare className="h-7 w-7 text-muted-foreground" />
				)}
			</div>
			<div className="max-w-xs space-y-1.5">
				<p className="font-semibold text-base">
					{hasFilters ? "No templates match" : "No templates yet"}
				</p>
				<p className="text-muted-foreground text-sm">
					{hasFilters
						? "Try adjusting your filters or search."
						: "Create WhatsApp Business message templates. Once approved by Meta, you can use them in campaigns."}
				</p>
			</div>
			{!hasFilters && (
				<Button className="gap-2 rounded-xl" onClick={onCreateClick}>
					<Plus className="h-4 w-4" /> Create your first template
				</Button>
			)}
		</div>
	);
}

// ─── WaTemplateListView ───────────────────────────────────────────────────────

interface WaTemplateListViewProps {
	category: WaCategory | undefined;
	createHref: string | undefined;
	editHref: (id: string) => string | undefined;
	/** If provided, renders "Use" buttons and calls this on selection (for picker context) */
	onSelect?: (t: WaTemplate) => void;
	search: string | undefined;
	selectedId?: string | null;
	/** Pre-set status filter — used when the parent page manages tab filtering */
	statusFilter?: WaTemplateStatus;
}

export function WaTemplateListView({
	onSelect,
	selectedId,
	statusFilter,
	search: searchProp,
	category: categoryProp,
	createHref,
	editHref,
}: WaTemplateListViewProps) {
	const [status, setStatus] = useQueryState(
		"status",
		parseAsString.withDefault(statusFilter ?? ALL)
	);
	const [search, setSearch] = useQueryState(
		"search",
		parseAsString.withDefault(searchProp ?? "")
	);
	const [category, setCategory] = useQueryState(
		"category",
		parseAsString.withDefault(categoryProp ?? "")
	);

	const { data: templates, isLoading } = useTemplates({
		channel: "whatsapp",
		search: search || undefined,
		status: status === ALL ? undefined : (status as WaTemplateStatus),
		category: category === ALL ? undefined : (category as WaCategory),
	});

	const router = useRouter();

	// ── List view ──
	const hasFilters = !!(search || status !== ALL || category !== ALL);
	const totalCount = templates?.length ?? 0;
	const isEmpty = !templates || templates.length === 0;
	const contentComponent = isLoading ? (
		<GridSkeleton />
	) : isEmpty ? (
		<EmptyState
			hasFilters={hasFilters}
			onCreateClick={() =>
				router.navigate({
					to: "/templates/create/whatsapp",
				})
			}
		/>
	) : (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{templates.map((t) => (
				<TemplateCard
					key={t.id}
					onEdit={(t) => editHref(t.id)}
					onSelect={onSelect}
					selected={selectedId === t.id}
					template={t as WaTemplate}
				/>
			))}
		</div>
	);

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="rounded-xl pl-9"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search templates…"
						value={search}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Select
						onValueChange={(v) => setStatus(v as WaTemplateStatus | typeof ALL)}
						value={status}
					>
						<SelectTrigger className="w-32.5 rounded-xl">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							<SelectItem value={ALL}>All statuses</SelectItem>
							<Separator className="my-1" />
							{(Object.keys(STATUS_CONFIG) as WaTemplateStatus[]).map((s) => (
								<SelectItem key={s} value={s}>
									<span className="flex items-center gap-1.5">
										{STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) => setCategory(v as WaCategory | typeof ALL)}
						value={category}
					>
						<SelectTrigger className="w-32.5 rounded-xl">
							<SelectValue placeholder="All categories" />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							<SelectItem value={ALL}>All categories</SelectItem>
							<Separator className="my-1" />
							{(Object.keys(CATEGORY_LABELS) as WaCategory[]).map((c) => (
								<SelectItem key={c} value={c}>
									{CATEGORY_LABELS[c]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{!onSelect &&
						(createHref ? (
							<Button
								className={[
									"gap-2 rounded-xl",
									"bg-[#25d366] text-white hover:bg-[#25d366]/90",
								].join(" ")}
								render={
									<Link to={"/templates/create/whatsapp"}>
										<Plus className="h-4 w-4" />
										New {"WhatsApp"} template
									</Link>
								}
							/>
						) : null)}
				</div>
			</div>

			{/* Count */}
			{!isLoading && totalCount > 0 && (
				<p className="text-muted-foreground text-xs">
					{totalCount} template{totalCount !== 1 ? "s" : ""}
					{hasFilters && " matching filters"}
				</p>
			)}

			{/* Content */}
			{contentComponent}
		</div>
	);
}
