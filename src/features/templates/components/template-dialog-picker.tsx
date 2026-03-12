"use client";

/**
 * TemplatePickerDialog — v2
 *
 * KEY CHANGE: The dialog now returns TWO independent picks instead of one:
 *   - waTemplate:  the Meta-approved WhatsApp template (bodyText from MessageTemplate where channel=whatsapp)
 *   - smsTemplate: the SMS template body (smsBody from MessageTemplate where channel=sms)
 *
 * This fixes the original bug where picking a WA template forced its embedded
 * `smsBody` fallback onto all SMS contacts — preventing users from choosing a
 * different, dedicated SMS template.
 *
 * The dialog is context-aware:
 *   - hasBothChannels: shows two separate picker rows (WA + SMS)
 *   - waOnly:          shows WA picker only
 *   - smsOnly:         shows SMS picker only
 *
 * Both picks are optional — leaving one empty falls back to the scenario default.
 */

import {
	CheckCircle2,
	ChevronRight,
	MessageSquare,
	Phone,
	Search,
	X,
} from "lucide-react";
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

/** A single resolved template choice for one channel */
export interface ChannelTemplate {
	body: string; // the actual message text for this channel
	category: string;
	displayName: string;
	id: string;
	vars: string[]; // named vars in body
}

/** What the dialog hands back — each channel's template chosen independently */
export interface WizardTemplatePair {
	sms: ChannelTemplate | null; // null = use scenario default for SMS contacts
	wa: ChannelTemplate | null; // null = use scenario default for WA contacts
}

interface TemplatePickerDialogProps {
	currentSmsId?: string | null;
	currentWaId?: string | null;
	hasSms: boolean;
	/** Which channels are present in the campaign (controls which pickers to show) */
	hasWa: boolean;
	onConfirm: (pair: WizardTemplatePair) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

const ALL = "__all__";

// Preview substitution values for rendering example messages
const PREVIEW_VALUES: Record<string, string> = {
	name: "Sarah",
	org: "Velocast",
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
		result = result.replace(
			new RegExp(`\\{\\{${v}\\}\\}`, "g"),
			PREVIEW_VALUES[v] ?? `[${v}]`
		);
	}
	return result;
}

function truncate(s: string, n = 110) {
	return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

// ─── Template card for WA channel picker ─────────────────────────────────────

function WaTemplateCard({
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

	return (
		<button
			className={[
				"w-full overflow-hidden rounded-xl border text-left transition-all duration-150",
				selected
					? "border-[#25d36660] bg-[#0d2016] ring-2 ring-[#25d36620]"
					: "border-border bg-muted/20 hover:border-[#25d36630]",
			].join(" ")}
			onClick={onSelect}
			type="button"
		>
			<div className="flex items-start gap-2.5 p-3">
				<div
					className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
						selected
							? "border border-[#25d36640] bg-[#25d36620]"
							: "border border-border bg-muted"
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
					<div className="mt-0.5 mb-2 flex items-center gap-1.5">
						<Badge
							className="h-4 rounded-full py-0 text-[9px] capitalize"
							variant="outline"
						>
							{template.category}
						</Badge>
						<span className="text-[9px] text-muted-foreground">
							{template.language}
						</span>
					</div>
					<p className="line-clamp-2 text-[11px] text-foreground/70 leading-relaxed">
						{preview}
					</p>
				</div>
			</div>
		</button>
	);
}

// ─── Template card for SMS channel picker ────────────────────────────────────

function SmsTemplateCard({
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
				"w-full overflow-hidden rounded-xl border text-left transition-all duration-150",
				selected
					? "border-[#60a5fa60] bg-[#0d1a2e] ring-2 ring-[#60a5fa20]"
					: "border-border bg-muted/20 hover:border-[#60a5fa30]",
			].join(" ")}
			onClick={onSelect}
			type="button"
		>
			<div className="flex items-start gap-2.5 p-3">
				<div
					className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
						selected
							? "border border-[#60a5fa40] bg-[#60a5fa20]"
							: "border border-border bg-muted"
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
						className="mt-0.5 mb-2 h-4 rounded-full border-[#60a5fa20] bg-[#60a5fa08] py-0 text-[#60a5fa] text-[9px] capitalize"
						variant="secondary"
					>
						{template.category}
					</Badge>
					<p className="line-clamp-2 text-[11px] text-foreground/70 leading-relaxed">
						{preview}
					</p>
				</div>
			</div>
		</button>
	);
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function PickerSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{Array.from({ length: 4 }).map((_, i) => (
				<div className="space-y-2 rounded-xl border p-3" key={i.toString()}>
					<div className="flex items-center gap-2">
						<Skeleton className="h-7 w-7 rounded-lg" />
						<Skeleton className="h-4 w-32" />
					</div>
					<Skeleton className="h-10 w-full rounded-lg" />
				</div>
			))}
		</div>
	);
}

// ─── Single-channel picker panel ─────────────────────────────────────────────

function ChannelPickerPanel({
	channel,
	search,
	onSearchChange,
	category,
	onCategoryChange,
	templates,
	isLoading,
	selectedId,
	onSelect,
}: {
	channel: "whatsapp" | "sms";
	search: string;
	onSearchChange: (v: string) => void;
	category: string;
	onCategoryChange: (v: string) => void;
	templates: WaTemplate[] | undefined;
	isLoading: boolean;
	selectedId: string | null;
	onSelect: (t: WaTemplate | null) => void;
}) {
	const isWa = channel === "whatsapp";
	const hasFilters = !!(search || category !== ALL);
	const uniqueCategories = [
		...new Set((templates ?? []).map((t) => t.category)),
	].sort();

	return (
		<div className="space-y-3">
			{/* Toolbar */}
			<div className="flex gap-2">
				<div className="relative flex-1">
					<Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="h-8 rounded-xl pl-9 text-xs"
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={`Search ${isWa ? "WhatsApp" : "SMS"} templates…`}
						value={search}
					/>
				</div>
				<Select
					onValueChange={(v) => onCategoryChange(v as WaCategory)}
					value={category}
				>
					<SelectTrigger className="h-8 w-32.5 rounded-xl text-xs">
						<SelectValue placeholder="All" />
					</SelectTrigger>
					<SelectContent className="rounded-xl">
						<SelectItem value={ALL}>All categories</SelectItem>
						{uniqueCategories.length > 0 && <Separator className="my-1" />}
						{uniqueCategories.map((c) => (
							<SelectItem className="capitalize" key={c} value={c}>
								{c}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Selected pill */}
			{selectedId &&
				templates &&
				(() => {
					const sel = templates.find((t) => t.id === selectedId);
					if (!sel) {
						return null;
					}
					return (
						<div
							className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
								isWa
									? "border-[#25d36630] bg-[#0d2016]"
									: "border-[#60a5fa30] bg-[#0d1a2e]"
							}`}
						>
							<div
								className={`h-1.5 w-1.5 rounded-full ${isWa ? "bg-[#25d366]" : "bg-[#60a5fa]"}`}
							/>
							<span className="flex-1 truncate font-medium text-xs">
								{sel.displayName}
							</span>
							<button
								className="text-muted-foreground transition-colors hover:text-foreground"
								onClick={() => onSelect(null)}
								type="button"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					);
				})()}

			{/* Grid */}
			<div className="max-h-70 overflow-y-auto pr-0.5">
				{isLoading ? (
					<PickerSkeleton />
				) : templates?.length ? (
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{templates.map((t) =>
							isWa ? (
								<WaTemplateCard
									key={t.id}
									onSelect={() => onSelect(selectedId === t.id ? null : t)}
									selected={selectedId === t.id}
									template={t}
								/>
							) : (
								<SmsTemplateCard
									key={t.id}
									onSelect={() => onSelect(selectedId === t.id ? null : t)}
									selected={selectedId === t.id}
									template={t}
								/>
							)
						)}
					</div>
				) : (
					<div className="flex flex-col items-center gap-2 py-10 text-center">
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-xl ${
								isWa
									? "border border-[#25d36630] bg-[#0d2016]"
									: "border border-[#60a5fa30] bg-[#0d1a2e]"
							}`}
						>
							{isWa ? (
								<MessageSquare className="h-4 w-4 text-[#25d366]" />
							) : (
								<Phone className="h-4 w-4 text-[#60a5fa]" />
							)}
						</div>
						<div>
							<p className="font-medium text-sm">
								{hasFilters
									? "No templates match"
									: isWa
										? "No approved WA templates"
										: "No SMS templates yet"}
							</p>
							<p className="mt-0.5 max-w-55 text-muted-foreground text-xs">
								{hasFilters
									? "Try adjusting search or category."
									: isWa
										? "Submit a template to Meta and wait for approval."
										: "Create SMS templates from the Templates page."}
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── TemplatePickerDialog ─────────────────────────────────────────────────────

export function TemplatePickerDialog({
	open,
	onOpenChange,
	onConfirm,

	hasWa,
	hasSms,
}: TemplatePickerDialogProps) {
	// Separate state for each channel's search + category + selection
	const [waSearch, setWaSearch] = useState("");
	const [waCategory, setWaCategory] = useState(ALL);
	const [selectedWa, setSelectedWa] = useState<WaTemplate | null>(null);

	const [smsSearch, setSmsSearch] = useState("");
	const [smsCategory, setSmsCategory] = useState(ALL);
	const [selectedSms, setSelectedSms] = useState<WaTemplate | null>(null);

	// Active section when both channels are present (accordion-style on mobile)
	const [activeSection, setActiveSection] = useState<"wa" | "sms">("wa");

	// Fetch WA templates (APPROVED only — the only ones usable in campaigns)
	const { data: waTemplates, isLoading: waLoading } = useTemplates({
		channel: "whatsapp",
		status: "APPROVED",
		search: waSearch || undefined,
		category: waCategory === ALL ? undefined : (waCategory as WaCategory),
	});

	// Fetch SMS templates (all — always ready, no Meta approval needed)
	const { data: smsTemplates, isLoading: smsLoading } = useTemplates({
		channel: "sms",
		search: smsSearch || undefined,
		category: smsCategory === ALL ? undefined : (smsCategory as WaCategory),
	});

	function toChannelTemplate(
		t: WaTemplate,
		ch: "whatsapp" | "sms"
	): ChannelTemplate {
		return {
			id: t.id,
			displayName: t.displayName,
			body: ch === "whatsapp" ? t.bodyText : t.smsBody,
			vars: ch === "whatsapp" ? t.bodyVars : t.smsVars,
			category: t.category,
		};
	}

	function handleConfirm() {
		onConfirm({
			wa: selectedWa ? toChannelTemplate(selectedWa, "whatsapp") : null,
			sms: selectedSms ? toChannelTemplate(selectedSms, "sms") : null,
		});
		onOpenChange(false);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			setWaSearch("");
			setWaCategory(ALL);
			setSelectedWa(null);
			setSmsSearch("");
			setSmsCategory(ALL);
			setSelectedSms(null);
		}
		onOpenChange(v);
	}

	const hasBothChannels = hasWa && hasSms;
	const hasPick =
		(hasWa && selectedWa) ||
		(hasSms && selectedSms) ||
		(!hasWa && selectedSms) ||
		(!hasSms && selectedWa);

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 rounded-2xl p-0">
				{/* Header */}
				<DialogHeader className="shrink-0 border-b px-6 py-4">
					<DialogTitle>Choose templates</DialogTitle>
					<DialogDescription>
						{hasBothChannels
							? "Pick a WhatsApp template and an SMS template independently — they can be different."
							: hasWa
								? "Pick an approved WhatsApp template for this campaign."
								: "Pick an SMS template for this campaign."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto">
					{/* CASE A: Mixed campaign — two pickers side by side / stacked */}
					{hasBothChannels ? (
						<div className="divide-y">
							{/* WhatsApp section */}
							<div>
								<button
									className={[
										"flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors",
										activeSection === "wa"
											? "bg-[#0d2016]"
											: "hover:bg-muted/30",
									].join(" ")}
									onClick={() =>
										setActiveSection(activeSection === "wa" ? "sms" : "wa")
									}
									type="button"
								>
									<div
										className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
											activeSection === "wa"
												? "border-[#25d36650] bg-[#25d36620]"
												: "border-border bg-muted"
										}`}
									>
										<MessageSquare
											className={`h-4 w-4 ${activeSection === "wa" ? "text-[#25d366]" : "text-muted-foreground"}`}
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="font-semibold text-sm">WhatsApp Template</p>
											{selectedWa && (
												<Badge className="h-4 rounded-full border border-[#25d36640] bg-[#25d36620] py-0 text-[#25d366] text-[9px]">
													{selectedWa.displayName}
												</Badge>
											)}
										</div>
										<p className="text-muted-foreground text-xs">
											{selectedWa
												? "Meta-approved template · tap to change"
												: "Meta-approved template (required for WA contacts)"}
										</p>
									</div>
									<ChevronRight
										className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === "wa" ? "rotate-90" : ""}`}
									/>
								</button>

								{activeSection === "wa" && (
									<div className="bg-muted/10 px-6 pt-3 pb-5">
										<ChannelPickerPanel
											category={waCategory}
											channel="whatsapp"
											isLoading={waLoading}
											onCategoryChange={setWaCategory}
											onSearchChange={setWaSearch}
											onSelect={(t) => setSelectedWa(t)}
											search={waSearch}
											selectedId={selectedWa?.id ?? null}
											templates={waTemplates}
										/>
									</div>
								)}
							</div>

							{/* SMS section */}
							<div>
								<button
									className={[
										"flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors",
										activeSection === "sms"
											? "bg-[#0d1a2e]"
											: "hover:bg-muted/30",
									].join(" ")}
									onClick={() =>
										setActiveSection(activeSection === "sms" ? "wa" : "sms")
									}
									type="button"
								>
									<div
										className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
											activeSection === "sms"
												? "border-[#60a5fa50] bg-[#60a5fa20]"
												: "border-border bg-muted"
										}`}
									>
										<Phone
											className={`h-4 w-4 ${activeSection === "sms" ? "text-[#60a5fa]" : "text-muted-foreground"}`}
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="font-semibold text-sm">SMS Template</p>
											{selectedSms && (
												<Badge className="h-4 rounded-full border border-[#60a5fa40] bg-[#60a5fa20] py-0 text-[#60a5fa] text-[9px]">
													{selectedSms.displayName}
												</Badge>
											)}
										</div>
										<p className="text-muted-foreground text-xs">
											{selectedSms
												? "SMS template · tap to change"
												: "Separate SMS body — different from the WhatsApp message"}
										</p>
									</div>
									<ChevronRight
										className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === "sms" ? "rotate-90" : ""}`}
									/>
								</button>

								{activeSection === "sms" && (
									<div className="bg-muted/10 px-6 pt-3 pb-5">
										<ChannelPickerPanel
											category={smsCategory}
											channel="sms"
											isLoading={smsLoading}
											onCategoryChange={setSmsCategory}
											onSearchChange={setSmsSearch}
											onSelect={(t) => setSelectedSms(t)}
											search={smsSearch}
											selectedId={selectedSms?.id ?? null}
											templates={smsTemplates}
										/>
									</div>
								)}
							</div>
						</div>
					) : (
						/* CASE B: Single-channel campaign */
						<div className="px-6 py-4">
							<ChannelPickerPanel
								category={hasWa ? waCategory : smsCategory}
								channel={hasWa ? "whatsapp" : "sms"}
								isLoading={hasWa ? waLoading : smsLoading}
								onCategoryChange={hasWa ? setWaCategory : setSmsCategory}
								onSearchChange={hasWa ? setWaSearch : setSmsSearch}
								onSelect={
									hasWa
										? (t) => setSelectedWa(t as WaTemplate | null)
										: (t) => setSelectedSms(t as WaTemplate | null)
								}
								search={hasWa ? waSearch : smsSearch}
								selectedId={
									hasWa ? (selectedWa?.id ?? null) : (selectedSms?.id ?? null)
								}
								templates={hasWa ? waTemplates : smsTemplates}
							/>
						</div>
					)}
				</div>

				{/* Footer */}
				<Separator />
				<DialogFooter className="flex shrink-0 items-center justify-between px-6 py-4">
					<p className="text-muted-foreground text-xs">
						{hasBothChannels
							? "Unpicked channels will use the scenario default."
							: "Leave empty to use the scenario default."}
					</p>
					<div className="flex gap-2">
						<Button
							className="rounded-xl"
							onClick={() => handleOpenChange(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button className="rounded-xl" onClick={handleConfirm}>
							{hasPick ? "Use selected" : "Use defaults"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
