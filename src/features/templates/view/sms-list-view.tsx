/**
 * SmsTemplateListView
 *
 * Full SMS-only template management tab.
 *
 * States:
 *   "list"   — search + category filter + grid of SmsTemplateCards
 *   "create" — SmsOnlyTemplateEditor for new templates
 *   "edit"   — SmsOnlyTemplateEditor for existing template
 *
 * No approval flow — all SMS templates are APPROVED immediately.
 * Variables, segment counting, GSM-7 warnings surfaced in the editor.
 */

import { Link, useRouter } from "@tanstack/react-router";
import { Phone, Plus, Search } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "#/components/ui/button";
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
import type { WaCategory } from "../category/whatsapp/templates";
import { SmsTemplateCard } from "../components/sms-template-card";
import { useTemplates, type WaTemplate } from "../hooks/use-templates";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL = "ALL";

// ─── Skeletons ────────────────────────────────────────────────────────────────

function GridSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<div className="space-y-3 rounded-2xl border p-4" key={i.toString()}>
					<div className="flex items-center gap-2">
						<Skeleton className="h-8 w-8 rounded-lg" />
						<div className="flex-1 space-y-1.5">
							<Skeleton className="h-3.5 w-36" />
							<Skeleton className="h-3 w-20 rounded-full" />
						</div>
					</div>
					<Skeleton className="h-20 w-full rounded-xl" />
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
		<div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-20 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#60a5fa20] bg-[#60a5fa10]">
				{hasFilters ? (
					<Search className="h-6 w-6 text-[#60a5fa]" />
				) : (
					<Phone className="h-6 w-6 text-[#60a5fa]" />
				)}
			</div>
			<div className="max-w-xs space-y-1.5">
				<p className="font-semibold">
					{hasFilters ? "No SMS templates match" : "No SMS templates yet"}
				</p>
				<p className="text-muted-foreground text-sm">
					{hasFilters
						? "Try adjusting your search or category filter."
						: "Create reusable SMS templates with dynamic variables. No approval needed — they're ready to use immediately."}
				</p>
			</div>
			{!hasFilters && (
				<Button
					className="gap-2 rounded-xl bg-[#60a5fa] text-white hover:bg-[#60a5fa]/90"
					onClick={onCreateClick}
				>
					<Plus className="h-4 w-4" /> Create first SMS template
				</Button>
			)}
		</div>
	);
}

// ─── SmsTemplateListView ──────────────────────────────────────────────────────

interface SmsTemplateListViewProps {
	category?: WaCategory;
	createHref?: string;
	editHref?: (id: string) => string;
	onSelect?: (t: WaTemplate) => void;
	search?: string;
	selectedId?: string | null;
}

export function SmsTemplateListView({
	onSelect,
	selectedId,
	search: searchProp,
	category: categoryProp,
	createHref,
	editHref,
}: SmsTemplateListViewProps) {
	const [search, setSearch] = useQueryState(
		"search",
		parseAsString.withDefault(searchProp ?? "")
	);
	const [category, setCategory] = useQueryState(
		"category",
		parseAsString.withDefault(categoryProp ?? ALL)
	);
	// Always filter to sms channel only
	const { data: templates, isLoading } = useTemplates({
		channel: "sms",
		search: search || undefined,
		category: category === ALL ? undefined : (category as WaCategory),
	});

	const router = useRouter();

	// ── List view ──────────────────────────────────────────────────────────────
	const hasFilters = !!(search || category !== ALL);
	const CATEGORY_LABELS: Record<WaCategory, string> = {
		MARKETING: "Marketing",
		UTILITY: "Utility",
		AUTHENTICATION: "Auth",
	};

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="rounded-xl pl-9"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search SMS templates…"
						value={search}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Select onValueChange={(v) => setCategory(v)} value={category}>
						<SelectTrigger className="w-35 rounded-xl">
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
								className="shrink-0 gap-2 rounded-xl bg-[#60a5fa] text-white hover:bg-[#60a5fa]/90"
								render={
									<Link to={createHref}>
										<Plus className="h-4 w-4" /> New SMS template
									</Link>
								}
							/>
						) : null)}
				</div>
			</div>

			{/* Count */}
			{!isLoading && (templates?.length ?? 0) > 0 && (
				<p className="text-muted-foreground text-xs">
					{templates?.length} template{templates?.length !== 1 ? "s" : ""}
					{hasFilters && " matching filters"}
				</p>
			)}

			{/* Content */}
			{isLoading ? (
				<GridSkeleton />
			) : !templates || templates.length === 0 ? (
				<EmptyState
					hasFilters={hasFilters}
					onCreateClick={() =>
						router.navigate({
							to: "/templates/create/sms",
						})
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{templates.map((t) => (
						<SmsTemplateCard
							editHref={editHref ? editHref(t.id) : undefined}
							key={t.id}
							onSelect={onSelect}
							selected={selectedId === t.id}
							template={t as WaTemplate}
						/>
					))}
				</div>
			)}
		</div>
	);
}
