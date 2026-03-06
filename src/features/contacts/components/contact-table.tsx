"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	GitMerge,
	Loader2,
	MessageCircle,
	Phone,
	Search,
	SlidersHorizontal,
	Trash2,
	X,
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
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
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { getContactTypeLabels } from "#/features/miscellaneous/org";
import { useProfile } from "#/features/profile/hooks/use-profile";
import { orpc } from "#/orpc/client";
import { useContacts } from "../hooks/use-contacts";
import { ContactDialog } from "./contact-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectedContact {
	channel: "whatsapp" | "sms";
	id: string;
	name: string;
	phone: string;
	type: string;
}

interface ContactsTableProps {
	/**
	 * When true, filters are kept in local React state rather than the URL.
	 * Set this when the table is embedded inside a dialog or wizard so it
	 * doesn't clobber the page URL.
	 */
	disableUrlSync?: boolean;
	/** Lift selection up — used by CampaignWizard */
	onSelectionChange?: (contacts: SelectedContact[]) => void;
	/** Show checkboxes */
	selectable?: boolean;
	/** Controlled selected ids — drives checkboxes when passed */
	selectedIds?: Set<string>;
	/** Full controlled selection map — needed for cross-page deselect */
	selectionMap?: Map<string, SelectedContact>;
}

// ─── Styling constants ────────────────────────────────────────────────────────

const CHANNEL_CLASS: Record<string, string> = {
	whatsapp: "border-[#25d36640] bg-[#0d2016] text-[#25d366]",
	sms: "border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa]",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton({
	rows = 8,
	cols = 5,
}: {
	rows?: number;
	cols?: number;
}) {
	return (
		<>
			{Array.from({ length: rows }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
				<TableRow key={i}>
					{Array.from({ length: cols }).map((__, j) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
						<TableCell key={j}>
							<Skeleton className="h-4 w-full max-w-[120px]" />
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
}

// ─── Filter state — URL or local depending on disableUrlSync ─────────────────

function useFilterState(disableUrlSync: boolean) {
	// URL-synced (standalone contacts page)
	const [urlSearch, setUrlSearch] = useQueryState(
		"q",
		parseAsString.withDefault("")
	);
	const [urlChannel, setUrlChannel] = useQueryState(
		"channel",
		parseAsString.withDefault("")
	);
	const [urlType, setUrlType] = useQueryState(
		"type",
		parseAsString.withDefault("")
	);
	const [urlPage, setUrlPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1)
	);
	const [urlDupes, setUrlDupes] = useQueryState(
		"dupes",
		parseAsString.withDefault("")
	);

	// Local state (wizard / embedded)
	const [localSearch, setLocalSearch] = useState("");
	const [localChannel, setLocalChannel] = useState("");
	const [localType, setLocalType] = useState("");
	const [localPage, setLocalPage] = useState(1);
	const [localDupes, setLocalDupes] = useState("");

	if (disableUrlSync) {
		return {
			search: localSearch,
			setSearch: (v: string | null) => setLocalSearch(v ?? ""),
			channel: localChannel,
			setChannel: (v: string | null) => setLocalChannel(v ?? ""),
			type: localType,
			setType: (v: string | null) => setLocalType(v ?? ""),
			page: localPage,
			setPage: (v: number) => setLocalPage(v),
			duplicates: localDupes,
			setDuplicates: (v: string | null) => setLocalDupes(v ?? ""),
		};
	}
	return {
		search: urlSearch,
		setSearch: setUrlSearch,
		channel: urlChannel,
		setChannel: setUrlChannel,
		type: urlType,
		setType: setUrlType,
		page: urlPage,
		setPage: setUrlPage,
		duplicates: urlDupes,
		setDuplicates: setUrlDupes,
	};
}

// ─── ContactsTable ────────────────────────────────────────────────────────────

export function ContactsTable({
	onSelectionChange,
	selectedIds,
	selectionMap,
	selectable = false,
	disableUrlSync = false,
}: ContactsTableProps) {
	const {
		search,
		setSearch,
		channel,
		setChannel,
		type,
		setType,
		page,
		setPage,
		duplicates,
		setDuplicates,
	} = useFilterState(disableUrlSync);

	// Internal selection — only used when not controlled externally
	const [internalMap, setInternalMap] = useState<Map<string, SelectedContact>>(
		new Map()
	);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	// Dialog state
	const [detailId, setDetailId] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	const qc = useQueryClient();

	// Resolve which selection map to use
	const activeMap = selectionMap ?? internalMap;
	const activeIds = selectedIds ?? new Set(activeMap.keys());

	// Org-aware labels
	const { data: profile } = useProfile();
	const typeLabels = getContactTypeLabels(profile?.orgType);

	// Mutations
	const deleteMutation = useMutation(
		orpc.contacts.delete.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: ["contacts"] });
				toast.success("Contact deleted");
			},
			onError: (e) =>
				toast.error("Delete failed", {
					description: e instanceof Error ? e.message : "Unknown error",
				}),
		})
	);

	const autoMergeMutation = useMutation(
		orpc.contacts.autoMergeDuplicates.mutationOptions({
			onSuccess: (r) => {
				qc.invalidateQueries({ queryKey: ["contacts"] });
				qc.invalidateQueries({ queryKey: ["contacts.duplicates"] });
				toast.success(
					`Merged ${r.groupsResolved} duplicate group${r.groupsResolved !== 1 ? "s" : ""}`,
					{
						description: `${r.contactsDeleted} duplicate entries removed.`,
					}
				);
			},
			onError: (e) =>
				toast.error("Merge failed", {
					description: e instanceof Error ? e.message : "Unknown error",
				}),
		})
	);

	// Duplicate groups query
	const { data: dupData } = useQuery(
		orpc.contacts.getDuplicates.queryOptions({
			queryKey: ["contacts.duplicates"],
			staleTime: 60_000,
		})
	);

	const duplicateCount = dupData?.totalDuplicates ?? 0;

	// Query
	const { data, isLoading, isFetching } = useContacts({
		search: search || undefined,
		channel: (channel as "whatsapp" | "sms") || undefined,
		type:
			(type as "first_timer" | "returning" | "member" | "visitor") || undefined,
		duplicatesOnly: duplicates === "1",
		page,
		pageSize: 15,
	});

	const contacts = data?.contacts ?? [];
	const pagination = data?.pagination;
	const hasFilters = !!(search || channel || type || duplicates);

	// ── Selection ──────────────────────────────────────────────────────────────

	function toggleOne(c: SelectedContact) {
		const next = new Map(activeMap);
		if (next.has(c.id)) {
			next.delete(c.id);
		} else {
			next.set(c.id, c);
		}
		if (!selectionMap) {
			setInternalMap(next);
		}
		onSelectionChange?.(Array.from(next.values()));
	}

	function togglePage() {
		const pageItems = contacts.map((c) => ({
			id: c.id,
			name: c.name,
			phone: c.phone,
			channel: c.channel,
			type: c.type,
		}));
		const allChecked = pageItems.every((c) => activeIds.has(c.id));
		const next = new Map(activeMap);
		if (allChecked) {
			for (const c of pageItems) {
				next.delete(c.id);
			}
		} else {
			for (const c of pageItems) {
				next.set(c.id, c);
			}
		}
		if (!selectionMap) {
			setInternalMap(next);
		}
		onSelectionChange?.(Array.from(next.values()));
	}

	const allPageChecked =
		contacts.length > 0 && contacts.every((c) => activeIds.has(c.id));
	const somePageChecked =
		contacts.some((c) => activeIds.has(c.id)) && !allPageChecked;
	const totalSelected = activeIds.size;

	function clearFilters() {
		setSearch(null);
		setChannel(null);
		setType(null);
		setDuplicates(null);
		setPage(1);
	}

	return (
		<div className="space-y-4">
			{/* ── Duplicate banner (only when there are pre-migration dupes) ── */}
			{duplicateCount > 0 && (
				<div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
					<AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-amber-400 text-sm">
							{duplicateCount} duplicate contact
							{duplicateCount !== 1 ? "s" : ""} found
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							The same phone number appears more than once. Auto-merge keeps the
							newest entry and deletes the rest.
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button
							className="h-8 gap-1.5 rounded-lg border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/10"
							onClick={() => setDuplicates(duplicates === "1" ? null : "1")}
							size="sm"
							variant="outline"
						>
							<AlertTriangle className="h-3.5 w-3.5" />
							{duplicates === "1" ? "Show all" : "Show dupes"}
						</Button>
						<Button
							className="h-8 gap-1.5 rounded-lg text-xs"
							disabled={autoMergeMutation.isPending}
							onClick={() => autoMergeMutation.mutate({})}
							size="sm"
						>
							{autoMergeMutation.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<GitMerge className="h-3.5 w-3.5" />
							)}
							Auto-merge all
						</Button>
					</div>
				</div>
			)}

			{/* ── Toolbar ── */}
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-[180px] flex-1">
					<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="h-9 rounded-xl pl-9"
						onChange={(e) => {
							setSearch(e.target.value || null);
							setPage(1);
						}}
						placeholder="Search name, phone, email…"
						value={search}
					/>
				</div>

				<Select
					onValueChange={(v) => {
						setChannel(v === "all" ? null : v);
						setPage(1);
					}}
					value={channel || "all"}
				>
					<SelectTrigger className="h-9 w-[130px] rounded-xl">
						<SelectValue placeholder="Channel" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All channels</SelectItem>
						<SelectItem value="whatsapp">WhatsApp</SelectItem>
						<SelectItem value="sms">SMS</SelectItem>
					</SelectContent>
				</Select>

				<Select
					onValueChange={(v) => {
						setType(v === "all" ? null : v);
						setPage(1);
					}}
					value={type || "all"}
				>
					<SelectTrigger className="h-9 w-[140px] rounded-xl">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						<SelectItem value="first_timer">
							{typeLabels.first_timer}
						</SelectItem>
						<SelectItem value="returning">{typeLabels.returning}</SelectItem>
						<SelectItem value="member">{typeLabels.member}</SelectItem>
						<SelectItem value="visitor">{typeLabels.visitor}</SelectItem>
					</SelectContent>
				</Select>

				{hasFilters && (
					<Button
						className="h-9 gap-1.5 px-3"
						onClick={clearFilters}
						size="sm"
						variant="ghost"
					>
						<X className="h-3.5 w-3.5" /> Clear
					</Button>
				)}

				{duplicates !== "1" && (
					<Button
						className="h-9 gap-1.5 px-3 text-xs"
						onClick={() => {
							setDuplicates(duplicates === "1" ? null : "1");
							setPage(1);
						}}
						size="sm"
						variant={duplicates === "1" ? "secondary" : "ghost"}
					>
						<AlertTriangle className="h-3.5 w-3.5" />
						Duplicates
					</Button>
				)}

				<div className="ml-auto flex items-center gap-2 text-muted-foreground text-xs">
					<SlidersHorizontal className="h-3.5 w-3.5" />
					{isFetching && !isLoading
						? "Updating…"
						: `${pagination?.total ?? 0} total`}
					{selectable && totalSelected > 0 && (
						<Badge variant="secondary">{totalSelected} selected</Badge>
					)}
				</div>
			</div>

			{/* ── Table ── */}
			<div className="overflow-hidden rounded-xl border">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/40 hover:bg-muted/40">
							{selectable && (
								<TableHead className="w-10 pl-4">
									<Checkbox
										aria-label="Select all on page"
										// indeterminate via data attr — shadcn Checkbox supports this
										checked={allPageChecked}
										data-state={
											somePageChecked
												? "indeterminate"
												: allPageChecked
													? "checked"
													: "unchecked"
										}
										onCheckedChange={togglePage}
									/>
								</TableHead>
							)}
							<TableHead>Name</TableHead>
							<TableHead>Phone</TableHead>
							<TableHead>Channel</TableHead>
							<TableHead>Type</TableHead>
							<TableHead className="hidden sm:table-cell">Added</TableHead>
							{!selectable && <TableHead className="w-10" />}
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableSkeleton cols={selectable ? 6 : 5} rows={8} />
						) : contacts.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-16 text-center text-muted-foreground text-sm"
									colSpan={selectable ? 6 : 5}
								>
									{hasFilters
										? "No contacts match your filters."
										: "No contacts yet — upload a contact list image to get started."}
								</TableCell>
							</TableRow>
						) : (
							contacts.map((contact) => {
								const isSelected = activeIds.has(contact.id);
								const asSelected: SelectedContact = {
									id: contact.id,
									name: contact.name,
									phone: contact.phone,
									channel: contact.channel,
									type: contact.type,
								};
								return (
									<TableRow
										className="cursor-pointer transition-colors"
										data-state={isSelected ? "selected" : undefined}
										key={contact.id}
										onClick={() => {
											if (selectable) {
												toggleOne(asSelected);
											} else {
												setDetailId(contact.id);
												setDialogOpen(true);
											}
										}}
									>
										{selectable && (
											<TableCell
												className="w-10 pl-4"
												onClick={(e) => e.stopPropagation()}
											>
												<Checkbox
													aria-label={`Select ${contact.name}`}
													checked={isSelected}
													onCheckedChange={() => toggleOne(asSelected)}
												/>
											</TableCell>
										)}
										<TableCell>
											<div className="flex items-center gap-2.5">
												<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-xs">
													{contact.name.charAt(0).toUpperCase()}
												</span>
												<div className="flex min-w-0 flex-col">
													<span
														className="font-medium text-sm"
														onClick={(e) => {
															if (!selectable) {
																return;
															}
															e.stopPropagation();
															setDetailId(contact.id);
															setDialogOpen(true);
														}}
													>
														{contact.name}
													</span>
													{contact.isDuplicate && (
														<span className="flex items-center gap-1 font-medium text-[10px] text-amber-400">
															<AlertTriangle className="h-2.5 w-2.5" />{" "}
															duplicate phone
														</span>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											<span className="flex items-center gap-1.5">
												<Phone className="h-3.5 w-3.5 shrink-0" />
												{contact.phone}
											</span>
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold text-[10px] uppercase tracking-wide ${CHANNEL_CLASS[contact.channel]}`}
											>
												<MessageCircle className="h-2.5 w-2.5" />
												{contact.channel === "whatsapp" ? "WhatsApp" : "SMS"}
											</span>
										</TableCell>
										<TableCell>
											<Badge
												className="font-normal text-xs"
												variant="secondary"
											>
												{typeLabels[contact.type as keyof typeof typeLabels] ??
													contact.type}
											</Badge>
										</TableCell>
										<TableCell className="hidden text-muted-foreground text-xs sm:table-cell">
											{new Date(contact.createdAt).toLocaleDateString("en-GB", {
												day: "numeric",
												month: "short",
												year: "numeric",
											})}
										</TableCell>
										{!selectable && (
											<TableCell
												className="w-10 pr-3"
												onClick={(e) => e.stopPropagation()}
											>
												<Button
													className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													onClick={() => setDeleteConfirmId(contact.id)}
													size="icon"
													variant="ghost"
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</TableCell>
										)}
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>

			{/* ── Pagination ── */}
			{pagination && pagination.totalPages > 1 && (
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span>
						Page {pagination.page} of {pagination.totalPages}
					</span>
					<div className="flex items-center gap-1.5">
						<Button
							className="h-7 w-7"
							disabled={pagination.page <= 1}
							onClick={() => setPage(pagination.page - 1)}
							size="icon"
							variant="outline"
						>
							<ChevronLeft className="h-3.5 w-3.5" />
						</Button>
						<Button
							className="h-7 w-7"
							disabled={pagination.page >= pagination.totalPages}
							onClick={() => setPage(pagination.page + 1)}
							size="icon"
							variant="outline"
						>
							<ChevronRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			)}

			{/* ── Detail dialog ── */}
			<ContactDialog
				contactId={detailId}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setDetailId(null);
					}
				}}
				open={dialogOpen}
			/>

			{/* ── Delete confirm dialog ── */}
			<AlertDialog
				onOpenChange={(o) => {
					if (!o) {
						setDeleteConfirmId(null);
					}
				}}
				open={!!deleteConfirmId}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete contact?</AlertDialogTitle>
						<AlertDialogDescription>
							This contact will be permanently removed. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								if (deleteConfirmId) {
									deleteMutation.mutate({
										id: deleteConfirmId,
									});
								}
								setDeleteConfirmId(null);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
