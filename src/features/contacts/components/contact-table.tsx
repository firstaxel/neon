"use client";

import {
	ChevronLeft,
	ChevronRight,
	MessageCircle,
	Phone,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
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

const TYPE_LABELS: Record<string, string> = {
	first_timer: "First Timer",
	returning: "Returning",
	member: "Member",
	visitor: "Visitor",
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
							<Skeleton className="h-4 w-full max-w-30" />
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

	// Local state (wizard / embedded)
	const [localSearch, setLocalSearch] = useState("");
	const [localChannel, setLocalChannel] = useState("");
	const [localType, setLocalType] = useState("");
	const [localPage, setLocalPage] = useState(1);

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
	};
}

// ─── ContactsTable ────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <not complex>
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
	} = useFilterState(disableUrlSync);

	// Internal selection — only used when not controlled externally
	const [internalMap, setInternalMap] = useState<Map<string, SelectedContact>>(
		new Map()
	);

	// Dialog state
	const [detailId, setDetailId] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	// Resolve which selection map to use
	const activeMap = selectionMap ?? internalMap;
	const activeIds = selectedIds ?? new Set(activeMap.keys());

	// Query
	const { data, isLoading, isFetching } = useContacts({
		search: search || undefined,
		channel: (channel as "whatsapp" | "sms") || undefined,
		type:
			(type as "first_timer" | "returning" | "member" | "visitor") || undefined,
		page,
		pageSize: 15,
	});

	const contacts = data?.contacts ?? [];
	const pagination = data?.pagination;
	const hasFilters = !!(search || channel || type);

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
		setPage(1);
	}

	return (
		<div className="space-y-4">
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
						<SelectItem value="first_timer">First Timer</SelectItem>
						<SelectItem value="returning">Returning</SelectItem>
						<SelectItem value="member">Member</SelectItem>
						<SelectItem value="visitor">Visitor</SelectItem>
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
									{(() => {
										let checkboxState:
											| "indeterminate"
											| "checked"
											| "unchecked";
										if (somePageChecked) {
											checkboxState = "indeterminate";
										} else if (allPageChecked) {
											checkboxState = "checked";
										} else {
											checkboxState = "unchecked";
										}
										return (
											<Checkbox
												aria-label="Select all on page"
												checked={allPageChecked}
												data-state={checkboxState}
												onCheckedChange={togglePage}
											/>
										);
									})()}
								</TableHead>
							)}
							<TableHead>Name</TableHead>
							<TableHead>Phone</TableHead>
							<TableHead>Channel</TableHead>
							<TableHead>Type</TableHead>
							<TableHead className="hidden sm:table-cell">Added</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableSkeleton cols={selectable ? 6 : 5} rows={8} />
						) : null}
						{!isLoading && contacts.length === 0 && (
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
						)}
						{!isLoading &&
							contacts.length > 0 &&
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
												{selectable ? (
													<button
														className="font-medium text-sm"
														onClick={(e) => {
															e.stopPropagation();
															setDetailId(contact.id);
															setDialogOpen(true);
														}}
														onKeyDown={(e) => {
															if (e.key === "Enter" || e.key === " ") {
																e.preventDefault();
																setDetailId(contact.id);
																setDialogOpen(true);
															}
														}}
														type="button"
													>
														{contact.name}
													</button>
												) : (
													<span className="font-medium text-sm">
														{contact.name}
													</span>
												)}
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
												{TYPE_LABELS[contact.type] ?? contact.type}
											</Badge>
										</TableCell>
										<TableCell className="hidden text-muted-foreground text-xs sm:table-cell">
											{new Date(contact.createdAt).toLocaleDateString("en-GB", {
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
		</div>
	);
}
