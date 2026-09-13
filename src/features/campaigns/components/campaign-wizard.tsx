"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	FileText,
	Info,
	Loader2,
	MessageCircle,
	Plus,
	Send,
	Sparkles,
	Users,
	Variable,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import { DepositDialog } from "#/features/billing/components/deposit-dialog";
import { useWallet } from "#/features/billing/hooks/use-billing";
import { formatNaira, PRICING } from "#/features/billing/utils/format";
import {
	ContactsTable,
	type SelectedContact,
} from "#/features/contacts/components/contact-table";
import { normalizePhoneNumber } from "#/features/contacts/utils/phone";
import { getScenarioMeta } from "#/features/miscellaneous/org";
import {
	getManualVars,
	personalizeMessage,
	SCENARIOS,
	VAR_LABELS,
} from "#/features/miscellaneous/scenario";
import { useProfile } from "#/features/profile/hooks/use-profile";
import {
	type ChannelTemplate,
	TemplatePickerDialog,
	type WizardTemplatePair,
} from "#/features/templates/components/template-dialog-picker";
import {
	useRecordTemplateUsage,
	useScenarioDefaults,
} from "#/features/templates/hooks/use-templates";
import { appendOptOutNotice, calculateSmsSegments } from "#/lib/sms";
import type { ScenarioId } from "#/lib/types";
import {
	useCreateSmsCampaign,
	useCreateWhatsappCampaign,
} from "../hooks/use-campaign";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardValues {
	campaignName: string;
	channelTarget: "smart" | "whatsapp" | "sms";
	contacts: SelectedContact[];
	customSms: string;
	customWhatsapp: string;
	deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback";
	savedSmsTemplate: ChannelTemplate | null;
	savedWaTemplate: ChannelTemplate | null;
	scenario: ScenarioId;
	scheduledAt: string;
	sendTiming: "immediate" | "scheduled";
	templateParams: Record<string, string>;
	templateSource: "scenario" | "saved" | "custom";
	templateVars: Record<string, string>;
}

// ─── Variable Extraction ──────────────────────────────────────────────────────

export function extractPositionalVars(text: string): string[] {
	const matches = text.match(/\{\{(\d+)\}\}/g);
	if (!matches) {
		return [];
	}
	const indices = new Set<string>();
	for (const m of matches) {
		const num = m.replace(/[{}]/g, "");
		indices.add(num);
	}
	return Array.from(indices).sort((a, b) => Number(a) - Number(b));
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
	{ icon: MessageCircle, label: "Scenario" },
	{ icon: Users, label: "Contacts" },
	{ icon: FileText, label: "Message" },
	{ icon: Variable, label: "Variables" },
	{ icon: Send, label: "Review" },
] as const;

function StepIndicator({
	current,
	hasVarsStep,
}: {
	current: number;
	hasVarsStep: boolean;
}) {
	const visibleSteps = hasVarsStep
		? STEPS
		: STEPS.filter((s) => s.label !== "Variables");

	const visibleCurrent = hasVarsStep
		? current
		: Math.min(current, visibleSteps.length - 1);

	return (
		<div className="flex items-center gap-1.5">
			{visibleSteps.map((step, i) => {
				const Icon = step.icon;
				const done = i < visibleCurrent;
				const active = i === visibleCurrent;
				return (
					<div className="flex items-center gap-1.5" key={step.label}>
						<div
							className={[
								"flex h-7 w-7 items-center justify-center rounded-full font-semibold text-xs transition-colors",
								done
									? "bg-primary text-primary-foreground"
									: active
										? "bg-primary/15 text-primary ring-1 ring-primary/40"
										: "bg-muted text-muted-foreground",
							].join(" ")}
						>
							{done ? (
								<CheckCircle2 className="h-3.5 w-3.5" />
							) : (
								<Icon className="h-3.5 w-3.5" />
							)}
						</div>
						<span
							className={`hidden font-medium text-xs sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}
						>
							{step.label}
						</span>
						{i < visibleSteps.length - 1 && (
							<div
								className={`h-px w-6 ${i < visibleCurrent ? "bg-primary" : "bg-border"}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ─── Step 1: Scenario & Channel ───────────────────────────────────────────────

function ScenarioStep({
	value,
	onChange,
	campaignName,
	onChangeName,
	channelTarget,
	onChangeChannel,
}: {
	value: ScenarioId;
	onChange: (v: ScenarioId) => void;
	campaignName: string;
	onChangeName: (name: string) => void;
	channelTarget: "smart" | "whatsapp" | "sms";
	onChangeChannel: (target: "smart" | "whatsapp" | "sms") => void;
}) {
	const { data: profile } = useProfile();
	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Campaign Name (Optional)
				</Label>
				<Input
					className="rounded-xl"
					onChange={(e) => onChangeName(e.target.value)}
					placeholder="e.g. Sunday Service Reminder"
					value={campaignName}
				/>
				<p className="text-[11px] text-muted-foreground">
					Give your broadcast a recognizable label for tracking in history.
				</p>
			</div>

			<Separator />

			<div className="space-y-3">
				<div>
					<p className="font-medium text-sm">Delivery Channel Target</p>
					<p className="text-muted-foreground text-xs">
						Choose how messages should be routed to your audience.
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-3">
					<button
						className={[
							"rounded-xl border p-3.5 text-left transition-all",
							channelTarget === "smart"
								? "border-primary bg-primary/5 ring-2 ring-primary/20"
								: "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
						].join(" ")}
						onClick={() => onChangeChannel("smart")}
						type="button"
					>
						<div className="flex items-center justify-between">
							<span className="font-semibold text-xs">Smart Multi Channel</span>
							{channelTarget === "smart" && (
								<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
							)}
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							WhatsApp to verified contacts, SMS fallback for remaining.
						</p>
						<div className="mt-2 flex flex-wrap gap-1">
							<Badge className="text-[9px]" variant="outline">
								₦90.00 WA
							</Badge>
							<Badge className="text-[9px]" variant="outline">
								₦6.00 SMS
							</Badge>
						</div>
					</button>

					<button
						className={[
							"rounded-xl border p-3.5 text-left transition-all",
							channelTarget === "whatsapp"
								? "border-primary bg-primary/5 ring-2 ring-primary/20"
								: "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
						].join(" ")}
						onClick={() => onChangeChannel("whatsapp")}
						type="button"
					>
						<div className="flex items-center justify-between">
							<span className="font-semibold text-xs">WhatsApp Only</span>
							{channelTarget === "whatsapp" && (
								<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
							)}
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Meta approved template outreach directly to WhatsApp users.
						</p>
						<div className="mt-2">
							<Badge className="text-[9px]" variant="outline">
								₦90.00 / message
							</Badge>
						</div>
					</button>

					<button
						className={[
							"rounded-xl border p-3.5 text-left transition-all",
							channelTarget === "sms"
								? "border-primary bg-primary/5 ring-2 ring-primary/20"
								: "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
						].join(" ")}
						onClick={() => onChangeChannel("sms")}
						type="button"
					>
						<div className="flex items-center justify-between">
							<span className="font-semibold text-xs">SMS Only</span>
							{channelTarget === "sms" && (
								<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
							)}
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Direct carrier SMS broadcast across Nigerian mobile networks.
						</p>
						<div className="mt-2">
							<Badge className="text-[9px]" variant="outline">
								₦6.00 / segment
							</Badge>
						</div>
					</button>
				</div>
			</div>

			<Separator />

			<div className="space-y-3">
				<div>
					<p className="font-medium text-sm">Campaign Purpose</p>
					<p className="text-muted-foreground text-xs">
						Choose the purpose of this outreach. Preconfigured templates will be
						loaded for your scenario.
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					{SCENARIOS.map((s) => {
						const meta = getScenarioMeta(s.id, profile?.orgType);
						return (
							<button
								className={[
									"rounded-xl border p-4 text-left transition-all",
									value === s.id
										? "border-primary bg-primary/5 ring-2 ring-primary/20"
										: "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
								].join(" ")}
								key={s.id}
								onClick={() => onChange(s.id)}
								type="button"
							>
								<div className="flex items-start gap-3">
									<span className="text-2xl leading-none">{meta.icon}</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium text-sm leading-tight">
											{meta.label}
										</p>
										<p className="mt-0.5 text-muted-foreground text-xs">
											{meta.description}
										</p>
									</div>
									{value === s.id && (
										<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
									)}
								</div>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ─── Step 2: Contacts ─────────────────────────────────────────────────────────

function ContactsStep({
	selected,
	onSelectionChange,
	channelTarget,
}: {
	selected: SelectedContact[];
	onSelectionChange: (c: SelectedContact[]) => void;
	channelTarget: "smart" | "whatsapp" | "sms";
}) {
	const [selectionMap, setSelectionMap] = useState<
		Map<string, SelectedContact>
	>(() => new Map(selected.map((c) => [c.id, c])));

	function handleChange(contacts: SelectedContact[]) {
		const next = new Map(contacts.map((c) => [c.id, c]));
		setSelectionMap(next);
		onSelectionChange(contacts);
	}

	// Audience deduplication analysis
	const seenPhones = new Set<string>();
	for (const c of selected) {
		const norm = normalizePhoneNumber(c.phone);
		const canonical =
			norm.success && norm.phone ? norm.phone : c.phone.replace(/\D/g, "");
		seenPhones.add(canonical);
	}
	const uniqueCount = seenPhones.size;
	const duplicatesCount = selected.length - uniqueCount;

	const waCount = selected.filter((c) => c.channel === "whatsapp").length;
	const smsCount = selected.filter((c) => c.channel === "sms").length;

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-muted-foreground text-sm">
					Select recipients. Use search or tag filters to build your audience.
				</p>
				{selected.length > 0 && (
					<Badge className="font-medium" variant="secondary">
						{selected.length} selected
					</Badge>
				)}
			</div>

			{selected.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 px-3.5 py-2.5 text-xs">
					<span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
						Audience Channel Distribution:
					</span>
					<Badge
						className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
						variant="outline"
					>
						{waCount} WhatsApp verified
					</Badge>
					<Badge
						className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
						variant="outline"
					>
						{smsCount} SMS recipients
					</Badge>
					{channelTarget === "smart" && (
						<span className="text-[11px] text-muted-foreground">
							Smart routing dispatches WhatsApp to verified numbers and SMS to
							the rest.
						</span>
					)}
					{channelTarget === "whatsapp" && smsCount > 0 && (
						<span className="text-[11px] text-amber-600 dark:text-amber-400">
							{smsCount} SMS only contact{smsCount === 1 ? "" : "s"} will be
							skipped under WhatsApp Only mode.
						</span>
					)}
				</div>
			)}

			{duplicatesCount > 0 && (
				<div className="flex items-center gap-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 text-blue-700 text-xs dark:border-[#60a5fa40] dark:bg-[#0d1a2e] dark:text-[#60a5fa]">
					<CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
					<span>
						<strong>{selected.length}</strong> contacts selected (
						<strong>{uniqueCount}</strong> unique Nigerian phone numbers).{" "}
						{duplicatesCount} duplicate number
						{duplicatesCount === 1 ? " was" : "s were"} automatically
						deduplicated so each recipient gets only one message.
					</span>
				</div>
			)}

			<ContactsTable
				disableUrlSync
				onSelectionChange={handleChange}
				selectable
				selectedIds={new Set(selectionMap.keys())}
				selectionMap={selectionMap}
			/>
		</div>
	);
}

// ─── Delivery channel information ─────────────────────────────────────────────

function DeliveryChannelInfo({
	channelTarget,
}: {
	channelTarget: "smart" | "whatsapp" | "sms";
}) {
	if (channelTarget === "smart") {
		return (
			<div className="space-y-2">
				<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
					Delivery channels
				</p>
				<div className="grid gap-2 sm:grid-cols-2">
					<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 dark:border-emerald-500/40 dark:bg-[#0d2016]">
						<div className="flex items-center gap-2.5">
							<span className="text-base">💬</span>
							<div>
								<div className="flex items-center gap-1.5">
									<span className="font-semibold text-emerald-700 text-xs dark:text-emerald-400">
										WhatsApp Channel
									</span>
									<span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1 py-0.5 font-bold text-[9px] text-emerald-700 uppercase tracking-wide dark:text-emerald-300">
										Meta API
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Verified templates at ₦90.00 each
								</p>
							</div>
						</div>
					</div>

					<div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-3 dark:border-[#60a5fa50] dark:bg-[#0d1a2e]">
						<div className="flex items-center gap-2.5">
							<span className="text-base">📱</span>
							<div>
								<div className="flex items-center gap-1.5">
									<span className="font-semibold text-blue-700 text-xs dark:text-[#60a5fa]">
										SMS Fallback
									</span>
									<span className="rounded border border-[#60a5fa30] bg-[#60a5fa15] px-1 py-0.5 font-bold text-[#60a5fa] text-[9px] uppercase tracking-wide">
										Termii Gateway
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Direct carrier SMS at ₦6.00 / segment
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (channelTarget === "whatsapp") {
		return (
			<div className="space-y-2">
				<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
					Delivery channel
				</p>
				<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 dark:border-emerald-500/40 dark:bg-[#0d2016]">
					<div className="flex items-start justify-between gap-3">
						<div className="flex min-w-0 items-center gap-2.5">
							<span className="shrink-0 text-base">💬</span>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-semibold text-emerald-700 text-sm dark:text-emerald-400">
										WhatsApp Outreach
									</span>
									<span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 font-bold text-[9px] text-emerald-700 uppercase tracking-wide dark:text-emerald-300">
										Meta Cloud API
									</span>
								</div>
								<p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
									Official Meta verified template messages delivered straight to
									WhatsApp.
								</p>
							</div>
						</div>
						<span className="mt-0.5 shrink-0 font-semibold text-[11px] text-emerald-700 dark:text-emerald-400">
							₦90.00 / recipient
						</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
				Delivery channel
			</p>
			<div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-3 dark:border-[#60a5fa50] dark:bg-[#0d1a2e]">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="shrink-0 text-base">📱</span>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-semibold text-blue-700 text-sm dark:text-[#60a5fa]">
									SMS Broadcast
								</span>
								<span className="rounded border border-[#60a5fa30] bg-[#60a5fa15] px-1.5 py-0.5 font-bold text-[#60a5fa] text-[9px] uppercase tracking-wide">
									Termii Gateway
								</span>
							</div>
							<p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
								Messages will be dispatched directly to mobile networks across
								Nigeria via Termii.
							</p>
						</div>
					</div>
					<span className="mt-0.5 shrink-0 font-semibold text-[#60a5fa] text-[11px]">
						₦6.00 / segment
					</span>
				</div>
			</div>
		</div>
	);
}

// ─── Step 3: Message Editor & Segment Calculator ──────────────────────────────

function MessageStep({
	values,
	setFieldValue,
	scenarioDefaults,
}: {
	values: WizardValues;
	setFieldValue: <K extends keyof WizardValues>(
		k: K,
		v: WizardValues[K]
	) => void;
	scenarioDefaults?: Record<string, { whatsapp: string; sms: string }>;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const { data: profile } = useProfile();

	const previewName = values.contacts[0]?.name || "Friend";

	const dbDefault = scenarioDefaults?.[values.scenario] ?? {
		sms: "",
		whatsapp: "",
	};

	const activeSms =
		values.templateSource === "custom"
			? values.customSms
			: values.savedSmsTemplate?.body || dbDefault.sms;

	const resolvedTemplateVars: Record<string, string> = {
		...values.templateVars,
		org: profile?.orgName ?? "Velocast",
		orgName: profile?.orgName ?? "Velocast",
		phone: values.contacts[0]?.phone ?? "08012345678",
	};

	const previewSms = (t: string) =>
		appendOptOutNotice(
			personalizeMessage(t, previewName, resolvedTemplateVars)
		);

	const smsCalc = calculateSmsSegments(activeSms ?? "", true);

	function handleTemplatePair(pair: WizardTemplatePair) {
		if (pair.wa) {
			setFieldValue("savedWaTemplate", pair.wa);
		}
		if (pair.sms) {
			setFieldValue("savedSmsTemplate", pair.sms);
		}
		const hasAnyPick = pair.wa !== null || pair.sms !== null;
		if (hasAnyPick) {
			setFieldValue("templateSource", "saved");
		}
	}

	function clearSavedWaTemplate() {
		setFieldValue("savedWaTemplate", null);
		setFieldValue("templateParams", {});
	}

	function clearSavedSmsTemplate() {
		setFieldValue("savedSmsTemplate", null);
		setFieldValue("customSms", "");
		setFieldValue("templateSource", "scenario");
	}

	function insertSmsPlaceholder(placeholder: string) {
		if (values.templateSource === "custom") {
			setFieldValue("customSms", `${values.customSms} ${placeholder}`);
		} else {
			setFieldValue("templateSource", "custom");
			setFieldValue("customSms", `${activeSms} ${placeholder}`);
		}
	}

	const isWaRequired = values.channelTarget !== "sms";
	const isSmsRequired = values.channelTarget !== "whatsapp";

	return (
		<div className="space-y-5">
			{/* WhatsApp Template Section (for Smart Multi Channel or WhatsApp Only) */}
			{isWaRequired && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div>
							<Label className="font-semibold text-sm">
								WhatsApp Template (Approved by Meta)
							</Label>
							<p className="text-[11px] text-muted-foreground">
								Meta requires pre approved templates for outbound business
								conversations.
							</p>
						</div>
						{values.savedWaTemplate && (
							<Button
								className="h-7 text-xs"
								onClick={() => setPickerOpen(true)}
								size="sm"
								type="button"
								variant="outline"
							>
								Change template
							</Button>
						)}
					</div>

					{values.savedWaTemplate ? (
						<div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 dark:border-[#25d36630] dark:bg-[#0d2016]/40">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Badge
										className="border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-[#25d366]"
										variant="outline"
									>
										{values.savedWaTemplate.displayName}
									</Badge>
									{values.savedWaTemplate.category && (
										<Badge className="text-[10px]" variant="secondary">
											{values.savedWaTemplate.category}
										</Badge>
									)}
									{values.savedWaTemplate.language && (
										<span className="text-[11px] text-muted-foreground">
											{values.savedWaTemplate.language}
										</span>
									)}
								</div>
								<Button
									className="h-6 w-6"
									onClick={clearSavedWaTemplate}
									size="icon"
									type="button"
									variant="ghost"
								>
									<X className="h-3.5 w-3.5" />
								</Button>
							</div>
							<p className="whitespace-pre-wrap font-mono text-foreground/90 text-xs leading-relaxed">
								{values.savedWaTemplate.body}
							</p>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-emerald-500/40 border-dashed bg-emerald-500/5 p-6 text-center dark:border-[#25d36640] dark:bg-[#0d2016]/20">
							<MessageCircle className="h-8 w-8 text-emerald-600 dark:text-[#25d366]" />
							<div>
								<p className="font-medium text-sm">
									No approved WhatsApp template selected
								</p>
								<p className="text-muted-foreground text-xs">
									Choose an approved template to proceed with WhatsApp outreach.
								</p>
							</div>
							<Button
								className="gap-1.5 rounded-xl bg-emerald-600 text-white text-xs hover:bg-emerald-700"
								onClick={() => setPickerOpen(true)}
								size="sm"
								type="button"
							>
								<Sparkles className="h-3.5 w-3.5" /> Browse approved WhatsApp
								templates
							</Button>
						</div>
					)}
				</div>
			)}

			{/* SMS Fallback / SMS Message Section */}
			{isSmsRequired && (
				<div className="space-y-4">
					<div className="overflow-hidden rounded-xl border">
						<div className="flex items-center gap-3 px-4 py-3">
							<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">
									{values.channelTarget === "smart"
										? "SMS Fallback Message Template"
										: "SMS Template Source"}
								</p>
								<p className="text-muted-foreground text-xs">
									{values.savedSmsTemplate ? (
										<span className="font-medium text-[#60a5fa]">
											SMS: {values.savedSmsTemplate.displayName}
										</span>
									) : (
										"Using scenario default message"
									)}
								</p>
							</div>
							{values.savedSmsTemplate ? (
								<div className="flex items-center gap-1.5">
									<Button
										className="h-7 rounded-lg text-muted-foreground text-xs"
										onClick={() => setPickerOpen(true)}
										size="sm"
										variant="ghost"
									>
										Change
									</Button>
									<Button
										className="h-6 w-6"
										onClick={clearSavedSmsTemplate}
										size="icon"
										variant="ghost"
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							) : (
								<Button
									className="shrink-0 gap-1.5 rounded-xl text-xs"
									onClick={() => setPickerOpen(true)}
									size="sm"
									variant="outline"
								>
									<Sparkles className="h-3 w-3" /> Browse SMS templates
								</Button>
							)}
						</div>

						<Separator />

						<div className="flex items-center gap-3 px-4 py-3">
							<div className="flex-1">
								<p className="font-medium text-sm">Custom message editor</p>
								<p className="text-muted-foreground text-xs">
									Edit or write a custom message for SMS recipients
								</p>
							</div>
							<Switch
								checked={values.templateSource === "custom"}
								onCheckedChange={(v) => {
									if (v) {
										setFieldValue("templateSource", "custom");
										setFieldValue("customSms", activeSms);
									} else {
										setFieldValue("templateSource", "scenario");
									}
								}}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="font-medium text-sm">SMS Message Body</Label>
							<div className="flex items-center gap-1">
								<span className="text-[11px] text-muted-foreground">
									Insert:
								</span>
								<Button
									className="h-6 gap-1 rounded-lg px-2 text-[10px]"
									onClick={() => insertSmsPlaceholder("{{name}}")}
									size="sm"
									type="button"
									variant="outline"
								>
									<Plus className="h-2.5 w-2.5" /> {"{{name}}"}
								</Button>
								<Button
									className="h-6 gap-1 rounded-lg px-2 text-[10px]"
									onClick={() => insertSmsPlaceholder("{{phone}}")}
									size="sm"
									type="button"
									variant="outline"
								>
									<Plus className="h-2.5 w-2.5" /> {"{{phone}}"}
								</Button>
								<Button
									className="h-6 gap-1 rounded-lg px-2 text-[10px]"
									onClick={() => insertSmsPlaceholder("{{org}}")}
									size="sm"
									type="button"
									variant="outline"
								>
									<Plus className="h-2.5 w-2.5" /> {"{{org}}"}
								</Button>
							</div>
						</div>

						{values.templateSource === "custom" ? (
							<Textarea
								className="min-h-24 resize-none rounded-xl font-mono text-xs"
								onChange={(e) => setFieldValue("customSms", e.target.value)}
								placeholder="Type your message with {{name}} placeholders…"
								value={values.customSms}
							/>
						) : (
							<div className="rounded-xl border bg-muted/30 p-3 font-mono text-xs">
								{activeSms || (
									<span className="text-muted-foreground italic">
										No template body
									</span>
								)}
							</div>
						)}
					</div>

					{/* Live GSM Character Analyzer & Segment Calculator */}
					<div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Badge
									className={
										smsCalc.encoding === "GSM_7"
											? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
											: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
									}
									variant="outline"
								>
									{smsCalc.encoding === "GSM_7"
										? "GSM 7 Encoding"
										: "Unicode Encoding"}
								</Badge>
								<Badge className="border-border" variant="outline">
									{smsCalc.segments}{" "}
									{smsCalc.segments === 1 ? "Segment" : "Segments"}
								</Badge>
							</div>
							<span className="font-semibold text-xs">
								₦
								{(smsCalc.segments * (PRICING.PER_MESSAGE.sms / 100)).toFixed(
									2
								)}{" "}
								/ recipient
							</span>
						</div>

						<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
							<div className="rounded-xl border bg-background/60 p-2.5">
								<p className="text-[10px] text-muted-foreground uppercase">
									Total Characters
								</p>
								<p className="mt-0.5 font-bold text-foreground text-sm">
									{smsCalc.totalCharacterCount}{" "}
									<span className="font-normal text-[10px] text-muted-foreground">
										({smsCalc.rawCharacterCount} text + 23 opt out)
									</span>
								</p>
							</div>
							<div className="rounded-xl border bg-background/60 p-2.5">
								<p className="text-[10px] text-muted-foreground uppercase">
									Max Per Segment
								</p>
								<p className="mt-0.5 font-bold text-foreground text-sm">
									{smsCalc.charsPerSegment} chars
								</p>
							</div>
							<div className="col-span-2 rounded-xl border bg-background/60 p-2.5 sm:col-span-1">
								<p className="text-[10px] text-muted-foreground uppercase">
									Remaining in Segment
								</p>
								<p className="mt-0.5 font-bold text-foreground text-sm">
									{smsCalc.charsRemainingInSegment} characters
								</p>
							</div>
						</div>

						{smsCalc.encoding === "UNICODE" && (
							<div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-700 text-xs dark:text-amber-400">
								<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
								<p className="leading-tight">
									Non GSM characters or emojis detected. Unicode restricts
									message capacity to 70 characters for single segment and 67
									characters for multipart segments.
								</p>
							</div>
						)}

						<p className="text-[11px] text-muted-foreground">
							Nigerian telecom regulation mandates opt out notice (automatically
							appended):{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
								Reply STOP to opt out
							</code>
						</p>
					</div>

					{/* Live SMS preview */}
					<div className="space-y-1.5">
						<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
							Live SMS Preview (Recipient: {previewName})
						</p>
						<div className="space-y-1.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 dark:border-border dark:bg-[#0d1a2e]">
							<Badge
								className="border-blue-500/30 bg-blue-500/10 px-1.5 text-blue-700 text-xs dark:border-[#60a5fa40] dark:bg-transparent dark:text-[#60a5fa]"
								variant="outline"
							>
								SMS Preview
							</Badge>
							<p className="whitespace-pre-wrap text-foreground/90 text-xs leading-relaxed">
								{previewSms(activeSms) || (
									<span className="text-muted-foreground italic">
										Message is empty
									</span>
								)}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Delivery Channel summary */}
			<DeliveryChannelInfo channelTarget={values.channelTarget} />

			{/* Template picker dialog */}
			<TemplatePickerDialog
				currentSmsId={values.savedSmsTemplate?.id}
				currentWaId={values.savedWaTemplate?.id}
				hasSms={isSmsRequired}
				hasWa={isWaRequired}
				onConfirm={handleTemplatePair}
				onOpenChange={setPickerOpen}
				open={pickerOpen}
			/>
		</div>
	);
}

// ─── Step 4: Variables ────────────────────────────────────────────────────────

function VariablesStep({
	positionalVars,
	templateParams,
	manualVars,
	templateVars,
	setFieldValue,
	activeWaTemplate,
	activeSmsTemplate,
	previewName,
	previewPhone,
	orgName,
}: {
	positionalVars: string[];
	templateParams: Record<string, string>;
	manualVars: string[];
	templateVars: Record<string, string>;
	setFieldValue: <K extends keyof WizardValues>(
		k: K,
		v: WizardValues[K]
	) => void;
	activeWaTemplate: string;
	activeSmsTemplate: string;
	previewName: string;
	previewPhone: string;
	orgName: string;
}) {
	function setParam(key: string, value: string) {
		setFieldValue("templateParams", {
			...templateParams,
			[key]: value,
		});
	}

	function setVar(key: string, value: string) {
		setFieldValue("templateVars", {
			...templateVars,
			[key]: value,
		});
	}

	// Resolve WhatsApp preview
	let previewWa = activeWaTemplate;
	for (const idx of positionalVars) {
		const mapping = templateParams[idx] ?? "";
		let val = mapping;
		if (mapping === "name" || mapping === "{{name}}") {
			val = previewName;
		} else if (mapping === "phone" || mapping === "{{phone}}") {
			val = previewPhone;
		} else if (
			mapping === "org" ||
			mapping === "{{org}}" ||
			mapping === "orgName"
		) {
			val = orgName;
		} else if (templateVars[mapping]) {
			val = templateVars[mapping];
		}
		previewWa = previewWa.replaceAll(`{{${idx}}}`, val || `{{${idx}}}`);
	}

	const resolvedTemplateVars: Record<string, string> = {
		...templateVars,
		org: orgName,
		orgName,
		phone: previewPhone,
	};
	const previewSms = personalizeMessage(
		activeSmsTemplate,
		previewName,
		resolvedTemplateVars
	);

	return (
		<div className="space-y-5">
			<p className="text-muted-foreground text-sm">
				Fill in values for campaign placeholders. They will be dynamically
				inserted into each message.
			</p>

			{/* Positional WhatsApp variables */}
			{positionalVars.length > 0 && (
				<div className="space-y-4 rounded-2xl border bg-muted/15 p-4">
					<div>
						<p className="font-semibold text-sm">
							WhatsApp Template Variable Mapping
						</p>
						<p className="text-muted-foreground text-xs">
							Map each placeholder in your approved WhatsApp template to a
							contact field or enter custom text. All variables must be mapped
							before launch.
						</p>
					</div>

					<div className="space-y-3">
						{positionalVars.map((varIdx) => {
							const currentVal = templateParams[varIdx] ?? "";
							const isPreset =
								currentVal === "name" ||
								currentVal === "phone" ||
								currentVal === "org";
							const isCustom = !isPreset && currentVal.length > 0;
							const selectValue = isPreset
								? currentVal
								: isCustom
									? "custom"
									: "";
							const isFilled = currentVal.trim().length > 0;

							return (
								<div
									className="space-y-2 rounded-xl border bg-background/60 p-3.5"
									key={varIdx}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="font-semibold text-xs">Placeholder</span>
											<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-primary text-xs">
												{`{{${varIdx}}}`}
											</code>
										</div>
										{isFilled ? (
											<div className="flex items-center gap-1 text-emerald-600 text-xs">
												<CheckCircle2 className="h-3.5 w-3.5" />
												<span>Mapped</span>
											</div>
										) : (
											<span className="text-[11px] text-amber-600 dark:text-amber-400">
												Mapping required
											</span>
										)}
									</div>

									<div className="grid gap-2 sm:grid-cols-2">
										<div>
											<Label className="text-[11px] text-muted-foreground">
												Map to Field
											</Label>
											<Select
												onValueChange={(val) => {
													if (!val || val === "custom") {
														setParam(varIdx, "");
													} else {
														setParam(varIdx, val);
													}
												}}
												value={selectValue}
											>
												<SelectTrigger className="mt-1 rounded-xl text-xs">
													<SelectValue placeholder="Choose mapping…" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="name">
														Recipient Full Name
													</SelectItem>
													<SelectItem value="phone">
														Recipient Phone Number
													</SelectItem>
													<SelectItem value="org">Organization Name</SelectItem>
													<SelectItem value="custom">Custom Text…</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{(selectValue === "custom" || isCustom) && (
											<div>
												<Label className="text-[11px] text-muted-foreground">
													Custom Text
												</Label>
												<Input
													className="mt-1 rounded-xl text-xs"
													onChange={(e) => setParam(varIdx, e.target.value)}
													placeholder="Type value for this placeholder…"
													value={currentVal}
												/>
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Manual SMS Named variables */}
			{manualVars.length > 0 && (
				<div className="space-y-3 rounded-2xl border bg-muted/15 p-4">
					<div>
						<p className="font-semibold text-sm">SMS Template Placeholders</p>
						<p className="text-muted-foreground text-xs">
							Enter values for placeholders used in your SMS message.
						</p>
					</div>
					{manualVars.map((varName) => {
						const label = VAR_LABELS[varName] ?? varName;
						const value = templateVars[varName] ?? "";
						const isFilled = value.trim().length > 0;

						return (
							<div className="space-y-1.5" key={varName}>
								<div className="flex items-center gap-2">
									<Label className="font-medium text-sm">{label}</Label>
									<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
										{`{{${varName}}}`}
									</code>
									{isFilled && (
										<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
									)}
								</div>
								<Input
									className="rounded-xl"
									onChange={(e) => setVar(varName, e.target.value)}
									placeholder={`Enter ${label.toLowerCase()}…`}
									value={value}
								/>
							</div>
						);
					})}
				</div>
			)}

			{/* Live WhatsApp preview if template active */}
			{activeWaTemplate && (
				<div className="space-y-2">
					<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
						Live WhatsApp Preview ({previewName})
					</p>
					<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 dark:border-[#25d36630] dark:bg-[#0d2016]">
						<Badge
							className="border-emerald-500/30 bg-emerald-500/10 px-1.5 text-emerald-700 text-xs dark:border-[#25d36640] dark:bg-transparent dark:text-[#25d366]"
							variant="outline"
						>
							WhatsApp Message
						</Badge>
						<p className="mt-1.5 whitespace-pre-wrap text-foreground/90 text-xs leading-relaxed">
							{previewWa}
						</p>
					</div>
				</div>
			)}

			{/* Live SMS preview if active */}
			{activeSmsTemplate && (
				<div className="space-y-2">
					<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
						Live SMS Preview ({previewName})
					</p>
					<div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 dark:border-border dark:bg-[#0d1a2e]">
						<Badge
							className="border-blue-500/30 bg-blue-500/10 px-1.5 text-blue-700 text-xs dark:border-[#60a5fa40] dark:bg-transparent dark:text-[#60a5fa]"
							variant="outline"
						>
							SMS
						</Badge>
						<p className="mt-1 whitespace-pre-wrap text-foreground/80 text-xs leading-relaxed">
							{previewSms}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Step 5: Review & Schedule ────────────────────────────────────────────────

function FinalReviewStep({
	values,
	setFieldValue,
	uniqueContactsCount,
	calc,
	availableBalanceKobo,
	onTopUp,
}: {
	values: WizardValues;
	setFieldValue: <K extends keyof WizardValues>(
		k: K,
		v: WizardValues[K]
	) => void;
	uniqueContactsCount: number;
	calc: ReturnType<typeof calculateSmsSegments>;
	availableBalanceKobo: number;
	onTopUp: () => void;
}) {
	const waContactsCount =
		values.channelTarget === "sms"
			? 0
			: values.channelTarget === "whatsapp"
				? uniqueContactsCount
				: values.contacts.filter((c) => c.channel === "whatsapp").length;

	const smsContactsCount =
		values.channelTarget === "whatsapp"
			? 0
			: values.channelTarget === "sms"
				? uniqueContactsCount
				: values.contacts.filter((c) => c.channel === "sms").length;

	const waUnitCostKobo = PRICING.PER_MESSAGE.whatsapp_marketing;
	const smsUnitCostKobo = PRICING.PER_MESSAGE.sms;

	const totalWaCostKobo = waContactsCount * waUnitCostKobo;
	const totalSmsCostKobo = smsContactsCount * calc.segments * smsUnitCostKobo;
	const totalEstimatedCostKobo = totalWaCostKobo + totalSmsCostKobo;

	const isSufficient = availableBalanceKobo >= totalEstimatedCostKobo;
	const shortfallKobo = Math.max(
		0,
		totalEstimatedCostKobo - availableBalanceKobo
	);

	const minScheduleTime = new Date(Date.now() + 60_000)
		.toISOString()
		.slice(0, 16);

	return (
		<div className="space-y-5">
			{/* Budget & Cost Summary */}
			<div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Campaign Estimate & Budget
				</p>
				<div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
					<div className="rounded-xl border bg-background/70 p-3">
						<p className="text-[10px] text-muted-foreground uppercase">
							Total Recipients
						</p>
						<p className="mt-1 font-bold text-base">{uniqueContactsCount}</p>
					</div>

					<div className="rounded-xl border bg-background/70 p-3">
						<p className="text-[10px] text-muted-foreground uppercase">
							Channel Breakdown
						</p>
						<p className="mt-1 font-bold text-xs leading-tight sm:text-sm">
							{values.channelTarget === "smart"
								? `${waContactsCount} WA · ${smsContactsCount} SMS`
								: values.channelTarget === "whatsapp"
									? `${waContactsCount} WhatsApp`
									: `${smsContactsCount} SMS`}
						</p>
					</div>

					<div className="rounded-xl border bg-background/70 p-3">
						<p className="text-[10px] text-muted-foreground uppercase">Rates</p>
						<p className="mt-1 font-bold text-xs sm:text-sm">
							{values.channelTarget === "smart"
								? "₦90 WA · ₦6 SMS"
								: values.channelTarget === "whatsapp"
									? "₦90.00 / msg"
									: `₦6.00 (${calc.segments} seg)`}
						</p>
					</div>

					<div className="rounded-xl border bg-background/70 p-3">
						<p className="text-[10px] text-muted-foreground uppercase">
							Estimated Cost Hold
						</p>
						<p className="mt-1 font-bold text-base text-primary">
							{formatNaira(totalEstimatedCostKobo)}
						</p>
					</div>
				</div>
			</div>

			{/* Spendable Balance Check */}
			<div
				className={[
					"rounded-2xl border p-4 transition-all",
					isSufficient
						? "border-emerald-500/30 bg-emerald-500/5 dark:bg-[#0d2016]/40"
						: "border-amber-500/40 bg-amber-500/10 dark:bg-[#1a1200]",
				].join(" ")}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							{isSufficient ? (
								<CheckCircle2 className="h-4 w-4 text-emerald-500" />
							) : (
								<AlertCircle className="h-4 w-4 text-amber-500" />
							)}
							<p className="font-medium text-sm">
								{isSufficient
									? "Spendable Balance Verified"
									: "Insufficient Wallet Funds"}
							</p>
						</div>
						<p className="text-muted-foreground text-xs">
							Spendable balance:{" "}
							<strong>{formatNaira(availableBalanceKobo)}</strong> (Estimated
							hold: {formatNaira(totalEstimatedCostKobo)})
						</p>
						{!isSufficient && (
							<p className="font-medium text-amber-600 text-xs dark:text-amber-400">
								Shortfall of {formatNaira(shortfallKobo)}. Please top up your
								wallet before launching.
							</p>
						)}
					</div>
					{!isSufficient && (
						<Button
							className="rounded-xl text-xs"
							onClick={onTopUp}
							size="sm"
							type="button"
						>
							Top up wallet
						</Button>
					)}
				</div>
			</div>

			{/* Scheduling Controls */}
			<div className="space-y-3 rounded-2xl border p-4">
				<div>
					<p className="font-medium text-sm">Dispatch Schedule</p>
					<p className="text-muted-foreground text-xs">
						Send immediately or queue for delivery at a future time.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<button
						className={[
							"rounded-xl border p-3.5 text-left transition-all",
							values.sendTiming === "immediate"
								? "border-primary bg-primary/10 ring-1 ring-primary"
								: "border-border hover:bg-muted/30",
						].join(" ")}
						onClick={() => setFieldValue("sendTiming", "immediate")}
						type="button"
					>
						<div className="flex items-center gap-2">
							<Send className="h-4 w-4 text-primary" />
							<p className="font-semibold text-xs">Send Immediately</p>
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
							Starts delivery right away upon submission.
						</p>
					</button>

					<button
						className={[
							"rounded-xl border p-3.5 text-left transition-all",
							values.sendTiming === "scheduled"
								? "border-primary bg-primary/10 ring-1 ring-primary"
								: "border-border hover:bg-muted/30",
						].join(" ")}
						onClick={() => setFieldValue("sendTiming", "scheduled")}
						type="button"
					>
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4 text-primary" />
							<p className="font-semibold text-xs">Schedule for Later</p>
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
							Specify a future date and time for dispatch.
						</p>
					</button>
				</div>

				{values.sendTiming === "scheduled" && (
					<div className="space-y-2 pt-2">
						<Label className="text-xs">Dispatch Date and Time</Label>
						<Input
							className="rounded-xl text-xs"
							min={minScheduleTime}
							onChange={(e) => setFieldValue("scheduledAt", e.target.value)}
							type="datetime-local"
							value={values.scheduledAt}
						/>
						<p className="text-[11px] text-muted-foreground">
							Funds will be reserved via a campaign hold. You can cancel this
							scheduled campaign at any time before dispatch starts to release
							the hold.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── CampaignWizard ───────────────────────────────────────────────────────────

export function CampaignWizard({ onCancel }: { onCancel?: () => void } = {}) {
	const [step, setStep] = useState(0);
	const [depositOpen, setDepositOpen] = useState(false);
	const router = useRouter();

	const { mutateAsync: createSms, isPending: isPendingSms } =
		useCreateSmsCampaign();
	const { mutateAsync: createWhatsapp, isPending: isPendingWhatsapp } =
		useCreateWhatsappCampaign();
	const isPending = isPendingSms || isPendingWhatsapp;

	const { mutateAsync: recordUsage } = useRecordTemplateUsage();
	const { data: scenarioDefaults } = useScenarioDefaults();
	const { data: wallet } = useWallet();
	const { data: profile } = useProfile();

	const form = useForm({
		defaultValues: {
			campaignName: "",
			channelTarget: "smart",
			contacts: [],
			customSms: "",
			customWhatsapp: "",
			deliveryMode: "sms_fallback",
			savedSmsTemplate: null,
			savedWaTemplate: null,
			scenario: "first_timer",
			scheduledAt: "",
			sendTiming: "immediate",
			templateParams: {},
			templateSource: "scenario",
			templateVars: {},
		} as WizardValues,
		onSubmit: async ({ value }) => {
			const dbDefaults = scenarioDefaults?.[value.scenario] ?? {
				sms: "",
				whatsapp: "",
			};

			const activeSms =
				value.templateSource === "custom"
					? value.customSms
					: value.savedSmsTemplate?.body || dbDefaults.sms;

			try {
				let campaignId: string;

				if (value.channelTarget === "sms") {
					const result = await createSms({
						contactIds: value.contacts.map((c) => c.id),
						messageText: activeSms,
						name: value.campaignName.trim() || undefined,
						scenario: value.scenario,
						scheduledAt:
							value.sendTiming === "scheduled" && value.scheduledAt
								? new Date(value.scheduledAt).toISOString()
								: null,
						templateVars: value.templateVars,
					});
					campaignId = result.campaignId;
				} else {
					if (!value.savedWaTemplate) {
						toast.error(
							"Please select an approved WhatsApp template before launching."
						);
						return;
					}
					const result = await createWhatsapp({
						channelTarget: value.channelTarget,
						contactIds: value.contacts.map((c) => c.id),
						name: value.campaignName.trim() || undefined,
						scenario: value.scenario,
						scheduledAt:
							value.sendTiming === "scheduled" && value.scheduledAt
								? new Date(value.scheduledAt).toISOString()
								: null,
						smsText: activeSms || undefined,
						templateId: value.savedWaTemplate.id,
						templateParams: value.templateParams,
						templateVars: value.templateVars,
					});
					campaignId = result.campaignId;
				}

				if (value.savedWaTemplate) {
					recordUsage({ id: value.savedWaTemplate.id }).catch(() => {});
				}
				if (value.savedSmsTemplate) {
					recordUsage({ id: value.savedSmsTemplate.id }).catch(() => {});
				}

				toast.success(
					value.sendTiming === "scheduled"
						? "Campaign scheduled successfully!"
						: "Campaign created and queued for dispatch!"
				);

				router.navigate({
					to: `/campaigns/${campaignId}`,
				});
			} catch (err: unknown) {
				const message =
					err instanceof Error ? err.message : "Failed to launch campaign";
				toast.error(message);
			}
		},
	});

	const values = useStore(form.store, (s) => s.values);

	const dbDefault0 = scenarioDefaults?.[values.scenario] ?? {
		sms: "",
		whatsapp: "",
	};
	const activeTemplateForCost =
		values.templateSource === "custom"
			? { sms: values.customSms, whatsapp: values.customWhatsapp }
			: values.templateSource === "saved"
				? {
						sms: values.savedSmsTemplate?.body ?? dbDefault0.sms,
						whatsapp: values.savedWaTemplate?.body ?? dbDefault0.whatsapp,
					}
				: dbDefault0;

	const manualVars = getManualVars(
		activeTemplateForCost.whatsapp,
		activeTemplateForCost.sms
	);
	const positionalVars =
		values.channelTarget !== "sms" && values.savedWaTemplate
			? extractPositionalVars(values.savedWaTemplate.body)
			: [];

	const hasVarsStep =
		positionalVars.length > 0 ||
		(values.channelTarget !== "whatsapp" && manualVars.length > 0);
	const LAST_STEP = hasVarsStep ? 4 : 3;

	// Deduplicated contacts count
	const seenPhones = new Set<string>();
	for (const c of values.contacts) {
		const norm = normalizePhoneNumber(c.phone);
		const canonical =
			norm.success && norm.phone ? norm.phone : c.phone.replace(/\D/g, "");
		seenPhones.add(canonical);
	}
	const uniqueContactsCount = seenPhones.size;

	const smsCalc = calculateSmsSegments(activeTemplateForCost.sms, true);

	const waContactsCount =
		values.channelTarget === "sms"
			? 0
			: values.channelTarget === "whatsapp"
				? uniqueContactsCount
				: values.contacts.filter((c) => c.channel === "whatsapp").length;

	const smsContactsCount =
		values.channelTarget === "whatsapp"
			? 0
			: values.channelTarget === "sms"
				? uniqueContactsCount
				: values.contacts.filter((c) => c.channel === "sms").length;

	const waUnitCostKobo = PRICING.PER_MESSAGE.whatsapp_marketing;
	const smsUnitCostKobo = PRICING.PER_MESSAGE.sms;

	const totalWaCostKobo = waContactsCount * waUnitCostKobo;
	const totalSmsCostKobo =
		smsContactsCount * smsCalc.segments * smsUnitCostKobo;
	const totalEstimatedCostKobo = totalWaCostKobo + totalSmsCostKobo;

	const availableBalanceKobo =
		(wallet?.balanceKobo ?? 0) - (wallet?.heldKobo ?? 0);
	const canAfford = availableBalanceKobo >= totalEstimatedCostKobo;

	const allPositionalMapped = positionalVars.every(
		(idx) => (values.templateParams[idx] ?? "").trim().length > 0
	);
	const allManualFilled = manualVars.every(
		(v) => (values.templateVars[v] ?? "").trim().length > 0
	);

	const canProceed =
		step === 0
			? Boolean(values.scenario) && Boolean(values.channelTarget)
			: step === 1
				? values.contacts.length > 0
				: step === 2
					? values.channelTarget === "sms"
						? values.templateSource === "custom"
							? values.customSms.trim().length > 0
							: Boolean(activeTemplateForCost.sms)
						: Boolean(values.savedWaTemplate)
					: step === 3 && hasVarsStep
						? allPositionalMapped && allManualFilled
						: canAfford &&
							(values.sendTiming === "immediate" ||
								Boolean(values.scheduledAt));

	function handleNext() {
		if (step === 2 && !hasVarsStep) {
			// Skip variables step directly to final review
			setStep(3);
		} else if (step < LAST_STEP) {
			setStep((s) => s + 1);
		} else {
			form.handleSubmit();
		}
	}

	function handleBack() {
		if (step === 0) {
			onCancel?.();
			return;
		}
		if (step === 3 && !hasVarsStep) {
			setStep(2);
			return;
		}
		setStep((s) => s - 1);
	}

	return (
		<Card className="w-full rounded-2xl">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">New Campaign</CardTitle>
					<StepIndicator current={step} hasVarsStep={hasVarsStep} />
				</div>
			</CardHeader>

			<Separator />

			<CardContent className="pt-5">
				{step === 0 && (
					<ScenarioStep
						campaignName={values.campaignName}
						channelTarget={values.channelTarget}
						onChange={(v) => form.setFieldValue("scenario", v)}
						onChangeChannel={(target) =>
							form.setFieldValue("channelTarget", target)
						}
						onChangeName={(name) => form.setFieldValue("campaignName", name)}
						value={values.scenario}
					/>
				)}

				{step === 1 && (
					<ContactsStep
						channelTarget={values.channelTarget}
						onSelectionChange={(c) => form.setFieldValue("contacts", c)}
						selected={values.contacts}
					/>
				)}

				{step === 2 && (
					<MessageStep
						scenarioDefaults={scenarioDefaults}
						setFieldValue={(k, v) => form.setFieldValue(k, v as never)}
						values={values}
					/>
				)}

				{step === 3 && hasVarsStep && (
					<VariablesStep
						activeSmsTemplate={activeTemplateForCost.sms}
						activeWaTemplate={values.savedWaTemplate?.body ?? ""}
						manualVars={values.channelTarget === "whatsapp" ? [] : manualVars}
						orgName={profile?.orgName ?? "Velocast"}
						positionalVars={positionalVars}
						previewName={values.contacts[0]?.name || "Friend"}
						previewPhone={values.contacts[0]?.phone || "08012345678"}
						setFieldValue={(k, v) => form.setFieldValue(k, v as never)}
						templateParams={values.templateParams}
						templateVars={values.templateVars}
					/>
				)}

				{(step === LAST_STEP || (step === 3 && !hasVarsStep)) && (
					<FinalReviewStep
						availableBalanceKobo={availableBalanceKobo}
						calc={smsCalc}
						onTopUp={() => setDepositOpen(true)}
						setFieldValue={(k, v) => form.setFieldValue(k, v as never)}
						uniqueContactsCount={uniqueContactsCount}
						values={values}
					/>
				)}
			</CardContent>

			<Separator />

			<CardFooter className="flex justify-between gap-3 pt-4">
				<Button
					className="gap-1 rounded-xl"
					disabled={isPending}
					onClick={handleBack}
					variant="outline"
				>
					<ChevronLeft className="h-4 w-4" /> Back
				</Button>

				{step === LAST_STEP || (step === 3 && !hasVarsStep) ? (
					<Button
						className="gap-2 rounded-xl"
						disabled={!canProceed || isPending}
						onClick={handleNext}
					>
						{isPending ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" /> Launching…
							</>
						) : values.sendTiming === "scheduled" ? (
							<>
								<Calendar className="h-4 w-4" /> Schedule Broadcast
							</>
						) : (
							<>
								<Send className="h-4 w-4" /> Launch Campaign (
								{uniqueContactsCount} recipients)
							</>
						)}
					</Button>
				) : (
					<Button
						className="gap-1 rounded-xl"
						disabled={!canProceed}
						onClick={handleNext}
					>
						{step === 2 && hasVarsStep ? "Map variables" : "Next"}
						<ChevronRight className="h-4 w-4" />
					</Button>
				)}
			</CardFooter>

			<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
		</Card>
	);
}
