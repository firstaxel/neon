/**
 * TemplatePickerDialog
 *
 * Full-screen Dialog for picking a saved template inside CampaignWizard.
 *
 * Two channel tabs:
 *   WhatsApp — only APPROVED WA templates (safe to send). Shows name, category,
 *              body preview, SMS fallback preview. Filtering by search + category.
 *   SMS       — all SMS-only templates (always ready). Blue-themed cards.
 *
 * On confirm:
 *   - For WA templates:  passes { bodyText, smsBody, bodyVars, smsVars, ... }
 *   - For SMS templates: passes { smsBody, smsVars } (bodyText == smsBody)
 *
 * Both shapes are normalised into WizardTemplate before calling onConfirm.
 */

import { CheckCircle2, MessageSquare, Phone, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
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
import { useTemplates, type WaTemplate } from "../hooks/use-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Normalised shape handed back to CampaignWizard */
export interface WizardTemplate {
	category: string;
	channel: "whatsapp" | "sms";
	displayName: string;
	id: string;
	/** Resolved body for SMS contacts */
	smsBody: string;
	/** Named variables in smsBody */
	smsVars: string[];
	/** Resolved body for WhatsApp contacts (already has named vars like {{name}}) */
	whatsappBody: string;
	/** Named variables in whatsappBody, e.g. ["name","org"] */
	whatsappVars: string[];
}

interface TemplatePickerDialogProps {
	currentId?: string | null;
	onConfirm: (tpl: WizardTemplate) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/** If provided, only show templates relevant to this channel */
	preferChannel?: "whatsapp" | "sms" | null;
}

type PickerTab = "whatsapp" | "sms";
const ALL = "__all__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toWizardTemplate(t: WaTemplate): WizardTemplate {
	return {
		id: t.id,
		displayName: t.displayName,
		channel: t.channel,
		whatsappBody: t.bodyText,
		smsBody: t.smsBody,
		whatsappVars: t.bodyVars,
		smsVars: t.smsVars,
		category: t.category,
	};
}

const PREVIEW_VALUES: Record<string, string> = {
	name: "Sarah",
	org: "Grace Assembly",
	date: "Sunday, 15 Dec",
	time: "10:00 AM",
	amount: "₦5,000",
	event: "Easter Sunday",
	code: "ABC123",
	phone: "+2348012345678",
};

function resolvePreview(text: string, vars: string[]): string {
	let result = text;
	for (const v of vars) {
		const val = PREVIEW_VALUES[v] ?? `[${v}]`;
		result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), val);
	}
	return result;
}

function truncate(s: string, n = 120) {
	return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

// ─── WA template mini-card ────────────────────────────────────────────────────

function WaPickerCard({
	template,
	selected,
	onSelect,
}: {
	template: WaTemplate;
	selected: boolean;
	onSelect: () => void;
}) {
	const preview = truncate(
		resolvePreview(template.bodyText, template.bodyVars)
	);
	const smsPreview = truncate(
		resolvePreview(template.smsBody, template.smsVars),
		80
	);

	return (
		<button
			className={[
				"w-full overflow-hidden rounded-2xl border text-left transition-all duration-150",
				selected
					? "border-[#25d36660] ring-2 ring-[#25d36620]"
					: "border-border hover:border-[#25d36630]",
			].join(" ")}
			onClick={onSelect}
			type="button"
		>
			{/* Header */}
			<div className="flex items-center gap-2.5 p-3 pb-2">
				<div
					className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
						selected
							? "border border-[#25d36640] bg-[#0d2016]"
							: "border border-border bg-muted/40"
					}`}
				>
					<MessageSquare
						className={`h-3.5 w-3.5 ${selected ? "text-[#25d366]" : "text-muted-foreground"}`}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<p className="truncate font-semibold text-sm leading-tight">
							{template.displayName}
						</p>
						{selected && (
							<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#25d366]" />
						)}
					</div>
					<div className="mt-0.5 flex items-center gap-1.5">
						<Badge
							className="h-4 rounded-full py-0 text-[9px] uppercase"
							variant="outline"
						>
							{template.category}
						</Badge>
						<span className="text-[9px] text-muted-foreground">
							{template.language}
						</span>
					</div>
				</div>
			</div>

			{/* WA body preview */}
			<div className="mx-3 mb-1.5 rounded-xl border border-[#25d36625] bg-[#0d2016] px-2.5 py-2">
				<p className="mb-1 font-bold text-[#25d366] text-[10px] uppercase tracking-wider">
					WhatsApp
				</p>
				<p className="line-clamp-2 text-[11px] text-foreground/70 leading-relaxed">
					{preview}
				</p>
			</div>

			{/* SMS fallback */}
			<div className="mx-3 mb-3 rounded-xl border border-[#60a5fa20] bg-[#0d1a2e] px-2.5 py-2">
				<p className="mb-1 font-bold text-[#60a5fa] text-[10px] uppercase tracking-wider">
					SMS Fallback
				</p>
				<p className="line-clamp-1 text-[11px] text-foreground/60 leading-snug">
					{smsPreview}
				</p>
			</div>
		</button>
	);
}

// ─── SMS template mini-card ───────────────────────────────────────────────────

function SmsPickerCard({
	template,
	selected,
	onSelect,
}: {
	template: WaTemplate;
	selected: boolean;
	onSelect: () => void;
}) {
	const preview = truncate(resolvePreview(template.smsBody, template.smsVars));

	return (
		<button
			className={[
				"w-full overflow-hidden rounded-2xl border text-left transition-all duration-150",
				selected
					? "border-[#60a5fa60] ring-2 ring-[#60a5fa20]"
					: "border-border hover:border-[#60a5fa30]",
			].join(" ")}
			onClick={onSelect}
			type="button"
		>
			<div className="flex items-center gap-2.5 p-3 pb-2">
				<div
					className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
						selected
							? "border border-[#60a5fa40] bg-[#0d1a2e]"
							: "border border-border bg-muted/40"
					}`}
				>
					<Phone
						className={`h-3.5 w-3.5 ${selected ? "text-[#60a5fa]" : "text-muted-foreground"}`}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						<p className="truncate font-semibold text-sm leading-tight">
							{template.displayName}
						</p>
						{selected && (
							<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#60a5fa]" />
						)}
					</div>
					<Badge
						className="mt-0.5 h-4 rounded-full border-[#60a5fa20] bg-[#60a5fa08] py-0 text-[#60a5fa] text-[9px] uppercase"
						variant="secondary"
					>
						{template.category}
					</Badge>
				</div>
			</div>

			<div className="mx-3 mb-3 rounded-xl border border-[#60a5fa25] bg-[#0d1a2e] px-2.5 py-2">
				<p className="line-clamp-3 text-[11px] text-foreground/70 leading-relaxed">
					{preview}
				</p>
			</div>
		</button>
	);
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyPicker({
	tab,
	hasFilters,
}: {
	tab: PickerTab;
	hasFilters: boolean;
}) {
	const isWa = tab === "whatsapp";
	return (
		<div className="flex flex-col items-center gap-3 py-12 text-center">
			<div
				className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
					isWa
						? "border border-[#25d36630] bg-[#0d2016]"
						: "border border-[#60a5fa30] bg-[#0d1a2e]"
				}`}
			>
				{isWa ? (
					<MessageSquare className="h-5 w-5 text-[#25d366]" />
				) : (
					<Phone className="h-5 w-5 text-[#60a5fa]" />
				)}
			</div>
			<div>
				<p className="font-medium text-sm">
					{hasFilters
						? "No templates match"
						: isWa
							? "No approved WhatsApp templates"
							: "No SMS templates yet"}
				</p>
				<p className="mt-1 max-w-[240px] text-muted-foreground text-xs">
					{hasFilters
						? "Try adjusting your search or category."
						: isWa
							? "Create a WhatsApp template and submit it to Meta for approval."
							: "Create SMS templates from the Templates page — they're ready to use instantly."}
				</p>
			</div>
		</div>
	);
}

// ─── TemplatePickerDialog ─────────────────────────────────────────────────────

export function TemplatePickerDialog({
	open,
	onOpenChange,
	onConfirm,
	preferChannel,
}: TemplatePickerDialogProps) {
	const [tab, setTab] = useState<PickerTab>(preferChannel ?? "whatsapp");
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<WaCategory | null>(null);
	const [selected, setSelected] = useState<WaTemplate | null>(null);

	// WhatsApp — APPROVED only
	const { data: waTemplates, isLoading: waLoading } = useTemplates({
		channel: "whatsapp",
		status: "APPROVED",
		search: search || undefined,
		category: category === null ? undefined : category,
	});

	// SMS — "all" (always approved)
	const { data: smsTemplates, isLoading: smsLoading } = useTemplates({
		channel: "sms",
		search: search || undefined,
		category: category === null ? undefined : category,
	});

	const isWa = tab === "whatsapp";
	const templates = isWa ? waTemplates : smsTemplates;
	const isLoading = isWa ? waLoading : smsLoading;
	const hasFilters = !!(search || category !== null);

	const waCount = waTemplates?.length ?? 0;
	const smsCount = smsTemplates?.length ?? 0;

	const uniqueCategories = [
		...new Set((templates ?? []).map((t) => t.category)),
	].sort();

	function handleConfirm() {
		if (!selected) {
			return;
		}
		onConfirm(toWizardTemplate(selected));
		onOpenChange(false);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			setSearch("");
			setCategory(null);
			setSelected(null);
		}
		onOpenChange(v);
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 rounded-2xl p-0">
				{/* Header */}
				<DialogHeader className="shrink-0 border-b px-6 py-4">
					<DialogTitle>Choose a template</DialogTitle>
					<DialogDescription>
						Pick a saved template to use in this campaign.
					</DialogDescription>
				</DialogHeader>

				{/* Channel tab switcher */}
				<div className="flex shrink-0 border-b">
					<button
						className={[
							"flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 font-medium text-sm transition-colors",
							isWa
								? "border-[#25d366] text-[#25d366]"
								: "border-transparent text-muted-foreground hover:text-foreground",
						].join(" ")}
						onClick={() => {
							setTab("whatsapp");
							setSelected(null);
							setCategory(null);
						}}
						type="button"
					>
						<MessageSquare className="h-3.5 w-3.5" />
						WhatsApp
						{waCount > 0 && (
							<span
								className={`rounded-full px-1.5 text-[10px] tabular-nums ${
									isWa
										? "bg-[#25d36620] text-[#25d366]"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{waCount}
							</span>
						)}
					</button>
					<div className="w-px bg-border" />
					<button
						className={[
							"flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 font-medium text-sm transition-colors",
							isWa
								? "border-transparent text-muted-foreground hover:text-foreground"
								: "border-[#60a5fa] text-[#60a5fa]",
						].join(" ")}
						onClick={() => {
							setTab("sms");
							setSelected(null);
							setCategory(null);
						}}
						type="button"
					>
						<Phone className="h-3.5 w-3.5" />
						SMS
						{smsCount > 0 && (
							<span
								className={`rounded-full px-1.5 text-[10px] tabular-nums ${
									isWa
										? "bg-muted text-muted-foreground"
										: "bg-[#60a5fa20] text-[#60a5fa]"
								}`}
							>
								{smsCount}
							</span>
						)}
					</button>
				</div>

				{/* Toolbar */}
				<div className="flex shrink-0 gap-2 border-b px-5 py-3">
					<div className="relative flex-1">
						<Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="h-9 rounded-xl pl-9"
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search templates…"
							value={search}
						/>
					</div>
					<Select onValueChange={setCategory} value={category}>
						<SelectTrigger className="h-9 w-[140px] rounded-xl">
							<SelectValue placeholder="All categories" />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							<SelectItem value={ALL}>All categories</SelectItem>
							{uniqueCategories.length > 0 && <Separator className="my-1" />}
							{uniqueCategories.map((c) => (
								<SelectItem className="uppercase" key={c} value={c}>
									{c}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Scrollable grid */}
				<div className="flex-1 overflow-y-auto px-5 py-4">
					{isLoading ? (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{Array.from({ length: 4 }).map((_, i) => (
								<div
									className="space-y-2 rounded-2xl border p-3"
									key={i.toString()}
								>
									<div className="flex items-center gap-2">
										<Skeleton className="h-7 w-7 rounded-lg" />
										<Skeleton className="h-4 w-32" />
									</div>
									<Skeleton className="h-16 w-full rounded-xl" />
									<Skeleton className="h-10 w-full rounded-xl" />
								</div>
							))}
						</div>
					) : templates?.length ? (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{templates.map((t) =>
								isWa ? (
									<WaPickerCard
										key={t.id}
										onSelect={() => setSelected(t as WaTemplate)}
										selected={selected?.id === t.id}
										template={t as WaTemplate}
									/>
								) : (
									<SmsPickerCard
										key={t.id}
										onSelect={() => setSelected(t as WaTemplate)}
										selected={selected?.id === t.id}
										template={t as WaTemplate}
									/>
								)
							)}
						</div>
					) : (
						<EmptyPicker hasFilters={hasFilters} tab={tab} />
					)}
				</div>

				{/* Selected bar + footer */}
				{selected && (
					<div
						className={`flex shrink-0 items-center gap-2 border-t px-5 py-2.5 ${
							isWa
								? "border-[#25d36620] bg-[#0d2016]"
								: "border-[#60a5fa20] bg-[#0d1a2e]"
						}`}
					>
						<div
							className={`h-2 w-2 rounded-full ${isWa ? "bg-[#25d366]" : "bg-[#60a5fa]"}`}
						/>
						<p className="flex-1 truncate font-medium text-sm">
							Selected:{" "}
							<span className={isWa ? "text-[#25d366]" : "text-[#60a5fa]"}>
								{selected.displayName}
							</span>
						</p>
						<Badge
							className="rounded-full text-[10px] uppercase"
							variant="outline"
						>
							{selected.category}
						</Badge>
					</div>
				)}

				<Separator />
				<DialogFooter className="shrink-0 px-6 py-4">
					<Button
						className="rounded-xl"
						onClick={() => handleOpenChange(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className={`rounded-xl ${isWa ? "" : "bg-[#60a5fa] text-white hover:bg-[#60a5fa]/90"}`}
						disabled={!selected}
						onClick={handleConfirm}
					>
						Use template
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
