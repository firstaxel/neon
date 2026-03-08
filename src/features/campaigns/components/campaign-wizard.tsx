"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	FileText,
	Loader2,
	MessageCircle,
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
import { Separator } from "#/components/ui/separator";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import { useCampaignCost } from "#/features/billing/hooks/use-billing";
import {
	ContactsTable,
	type SelectedContact,
} from "#/features/contacts/components/contact-table";
import { getScenarioMeta } from "#/features/miscellaneous/org";
import {
	getManualVars,
	personalizeMessage,
	SCENARIOS,
	VAR_LABELS,
} from "#/features/miscellaneous/scenario";
import { useProfile } from "#/features/profile/hooks/use-profile";
import { DepositDialog } from "#/features/subscriptions/components/DepositDialog";
import {
	type ChannelTemplate,
	TemplatePickerDialog,
	type WizardTemplatePair,
} from "#/features/templates/components/template-dialog-picker";
import {
	useRecordTemplateUsage,
	useScenarioDefaults,
} from "#/features/templates/hooks/use-templates";
import type { ScenarioId } from "#/lib/types";
import { useSendCampaign } from "../hooks/use-campaign";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardValues {
	contacts: SelectedContact[];
	customSms: string;
	customWhatsapp: string;
	// How WhatsApp contacts receive the message:
	//   marketing         → send approved template directly (standard, ~₦100)
	//   utility_prescreen → send cheap consent message first, real msg on YES (~₦5 + ₦100 for replies only)
	//   sms_fallback      → send as SMS to their WhatsApp number via Termii (~₦5–8)
	deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback";
	savedSmsTemplate: ChannelTemplate | null;
	// Independent per-channel picks. null = fall back to scenario default for that channel.
	savedWaTemplate: ChannelTemplate | null;
	scenario: ScenarioId;
	// Template source — exactly one of these modes is active at a time:
	//   "scenario"   → use the built-in scenario defaults
	//   "saved"      → user picked templates from saved library (one per channel, independently)
	//   "custom"     → user typed a one-off override
	templateSource: "scenario" | "saved" | "custom";
	/** User-supplied values for manual template vars (non-name vars like org, date, event) */
	templateVars: Record<string, string>;
}

const CHANNEL_BADGE = {
	whatsapp: "border-[#25d36640] bg-[#0d2016] text-[#25d366]",
	sms: "border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa]",
} as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
	{ label: "Scenario", icon: MessageCircle },
	{ label: "Contacts", icon: Users },
	{ label: "Review", icon: FileText },
	{ label: "Variables", icon: Variable },
	{ label: "Send", icon: Send },
] as const;

function StepIndicator({
	current,
	hasVarsStep,
}: {
	current: number;
	hasVarsStep: boolean;
}) {
	// Only show Variables step in the indicator when there are manual vars to fill
	const visibleSteps = hasVarsStep
		? STEPS
		: STEPS.filter((s) => s.label !== "Variables");

	// Map the logical step index to the visible step index
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

// ─── Step 1: Scenario ─────────────────────────────────────────────────────────

function ScenarioStep({
	value,
	onChange,
}: {
	value: ScenarioId;
	onChange: (v: ScenarioId) => void;
}) {
	const { data: profile } = useProfile();
	return (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm">
				Choose the purpose of this campaign. The message template will be
				personalised for each recipient.
			</p>
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
	);
}

// ─── Step 2: Contacts ─────────────────────────────────────────────────────────

function ContactsStep({
	selected,
	onSelectionChange,
}: {
	selected: SelectedContact[];
	onSelectionChange: (c: SelectedContact[]) => void;
}) {
	const [selectionMap, setSelectionMap] = useState<
		Map<string, SelectedContact>
	>(() => new Map(selected.map((c) => [c.id, c])));

	function handleChange(contacts: SelectedContact[]) {
		const next = new Map(contacts.map((c) => [c.id, c]));
		setSelectionMap(next);
		onSelectionChange(contacts);
	}

	return (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm">
				Select recipients. Selections persist as you navigate between pages.
			</p>
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

// ─── Delivery mode selector ───────────────────────────────────────────────────

const DELIVERY_MODES = [
	{
		id: "marketing" as const,
		label: "Direct WhatsApp",
		sublabel: "Marketing template",
		cost: "~₦90 / contact",
		detail:
			"Send your approved WhatsApp marketing template straight to contacts. Fastest delivery.",
		color: "border-[#25d36650] bg-[#0d2016] text-[#25d366]",
		badge: "bg-[#25d36615] text-[#25d366] border-[#25d36630]",
		icon: "💬",
	},
	{
		id: "utility_prescreen" as const,
		label: "Consent first",
		sublabel: "Utility → Marketing",
		cost: "~₦8 + ₦0 for replies",
		detail:
			"Send a cheap consent message first. Only contacts who reply YES receive the full message. Best for large lists.",
		color: "border-[#f59e0b50] bg-[#1a1200] text-[#f59e0b]",
		badge: "bg-[#f59e0b15] text-[#f59e0b] border-[#f59e0b30]",
		icon: "🔔",
	},
	{
		id: "sms_fallback" as const,
		label: "SMS to WA number",
		sublabel: "Termii SMS",
		cost: "~₦6 / contact",
		detail:
			"Send as a regular SMS to their WhatsApp phone number. No Meta approval needed. Works even if WhatsApp isn't open.",
		color: "border-[#60a5fa50] bg-[#0d1a2e] text-[#60a5fa]",
		badge: "bg-[#60a5fa15] text-[#60a5fa] border-[#60a5fa30]",
		icon: "📱",
	},
] as const;

function DeliveryModeSelector({
	value,
	onChange,
	hasWhatsappContacts,
	hasSmsOnlyContacts,
	hasMixedContacts,
}: {
	value: "marketing" | "utility_prescreen" | "sms_fallback";
	onChange: (v: "marketing" | "utility_prescreen" | "sms_fallback") => void;
	hasWhatsappContacts: boolean;
	hasSmsOnlyContacts: boolean; // true = ALL selected contacts are SMS
	hasMixedContacts: boolean; // true = mix of WA + SMS contacts
}) {
	if (!(hasWhatsappContacts || hasSmsOnlyContacts)) {
		return null;
	}

	// SMS-only list: only sms_fallback makes sense, hide the WA options entirely
	if (hasSmsOnlyContacts && !hasWhatsappContacts) {
		return (
			<div className="space-y-2">
				<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
					Delivery method
				</p>
				<div className="rounded-xl border border-[#60a5fa50] bg-[#0d1a2e] px-3.5 py-3">
					<div className="flex items-start justify-between gap-3">
						<div className="flex min-w-0 items-center gap-2.5">
							<span className="shrink-0 text-base">📱</span>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-semibold text-[#60a5fa] text-sm">
										SMS
									</span>
									<span className="rounded border border-[#60a5fa30] bg-[#60a5fa15] px-1.5 py-0.5 font-bold text-[#60a5fa] text-[9px] uppercase tracking-wide">
										Termii
									</span>
								</div>
								<p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
									All selected contacts are SMS. Messages are sent via Termii.
								</p>
								<p className="mt-1 text-[10px] text-amber-400/80">
									⚠️ One-way only — SMS contacts cannot reply to these messages.
								</p>
							</div>
						</div>
						<span className="mt-0.5 shrink-0 font-semibold text-[#60a5fa] text-[11px]">
							~₦6 / contact
						</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
				WhatsApp delivery method
			</p>
			{hasMixedContacts && (
				<div className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
					<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
					<p className="text-[11px] text-amber-400/80">
						SMS contacts in this list are sent directly — they can't participate
						in the consent flow.
					</p>
				</div>
			)}
			<div className="grid gap-2">
				{DELIVERY_MODES.map((mode) => {
					const active = value === mode.id;
					const disabled =
						mode.id === "utility_prescreen" && hasSmsOnlyContacts;
					return (
						<button
							className={[
								"w-full rounded-xl border px-3.5 py-3 text-left transition-all",
								disabled
									? "cursor-not-allowed border-border opacity-40"
									: active
										? mode.color
										: "border-border hover:border-muted-foreground/40",
							].join(" ")}
							disabled={disabled}
							key={mode.id}
							onClick={() => !disabled && onChange(mode.id)}
							title={
								disabled
									? "Consent flow requires WhatsApp contacts — SMS contacts cannot reply"
									: undefined
							}
							type="button"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex min-w-0 items-center gap-2.5">
									<span className="shrink-0 text-base">{mode.icon}</span>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-semibold text-sm">
												{mode.label}
											</span>
											<span
												className={`rounded border px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-wide ${active && !disabled ? mode.badge : "border-transparent bg-muted text-muted-foreground"}`}
											>
												{mode.sublabel}
											</span>
											{mode.id === "sms_fallback" && (
												<span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-bold text-[9px] text-amber-400 uppercase tracking-wide">
													one-way
												</span>
											)}
										</div>
										{active && !disabled && (
											<p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
												{mode.detail}
											</p>
										)}
										{mode.id === "sms_fallback" && active && (
											<p className="mt-1 text-[10px] text-amber-400/80">
												Recipients cannot reply — Termii uses alphanumeric
												sender IDs.
											</p>
										)}
									</div>
								</div>
								<span
									className={`mt-0.5 shrink-0 font-semibold text-[11px] ${active && !disabled ? "" : "text-muted-foreground"}`}
								>
									{mode.cost}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

// ─── Step 3: Review & Send ────────────────────────────────────────────────────

function ReviewStep({
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

	const scenarioMeta = SCENARIOS.find((s) => s.id === values.scenario);
	const waContacts = values.contacts.filter((c) => c.channel === "whatsapp");
	const smsContacts = values.contacts.filter((c) => c.channel === "sms");
	const previewName = values.contacts[0]?.name ?? "John";

	const dbDefault = scenarioDefaults?.[values.scenario] ?? {
		whatsapp: "",
		sms: "",
	};

	const activeTemplate = (() => {
		if (values.templateSource === "custom") {
			return { whatsapp: values.customWhatsapp, sms: values.customSms };
		}
		return {
			whatsapp: values.savedWaTemplate
				? values.savedWaTemplate.body
				: dbDefault.whatsapp,
			sms: values.savedSmsTemplate
				? values.savedSmsTemplate.body
				: dbDefault.sms,
		};
	})();

	const preview = (t: string) =>
		personalizeMessage(t, previewName, values.templateVars);

	function handleTemplatePair(pair: WizardTemplatePair) {
		const hasAnyPick = pair.wa !== null || pair.sms !== null;
		setFieldValue("savedWaTemplate", pair.wa);
		setFieldValue("savedSmsTemplate", pair.sms);
		setFieldValue("templateSource", hasAnyPick ? "saved" : "scenario");
	}

	function clearSavedTemplates() {
		setFieldValue("savedWaTemplate", null);
		setFieldValue("savedSmsTemplate", null);
		setFieldValue("templateSource", "scenario");
	}

	return (
		<div className="space-y-5">
			{/* Summary chips */}
			<div className="grid grid-cols-3 gap-3">
				{[
					{
						label: "Scenario",
						value: scenarioMeta
							? `${scenarioMeta.icon} ${scenarioMeta.label}`
							: values.scenario,
					},
					{
						label: "Recipients",
						value: `${values.contacts.length} contact${values.contacts.length !== 1 ? "s" : ""}`,
					},
					{
						label: "Channels",
						value:
							[
								waContacts.length ? `${waContacts.length} WA` : "",
								smsContacts.length ? `${smsContacts.length} SMS` : "",
							]
								.filter(Boolean)
								.join(" · ") || "—",
					},
				].map(({ label, value }) => (
					<div
						className="rounded-xl border bg-muted/30 px-3 py-2.5 text-center"
						key={label}
					>
						<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
							{label}
						</p>
						<p className="mt-0.5 truncate font-semibold text-sm">{value}</p>
					</div>
				))}
			</div>

			{/* ── Template source selector ── */}
			<div className="overflow-hidden rounded-xl border">
				{/* Saved template row */}
				<div className="flex items-center gap-3 px-4 py-3">
					<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<p className="font-medium text-sm">Saved templates</p>
						<p className="text-muted-foreground text-xs">
							{values.savedWaTemplate || values.savedSmsTemplate ? (
								<>
									{values.savedWaTemplate && (
										<span className="font-medium text-[#25d366]">
											WA: {values.savedWaTemplate.displayName}
										</span>
									)}
									{values.savedWaTemplate && values.savedSmsTemplate && (
										<span className="mx-1 text-muted-foreground/50">·</span>
									)}
									{values.savedSmsTemplate && (
										<span className="font-medium text-[#60a5fa]">
											SMS: {values.savedSmsTemplate.displayName}
										</span>
									)}
								</>
							) : (
								"Pick independently for WhatsApp and SMS"
							)}
						</p>
					</div>
					{values.savedWaTemplate || values.savedSmsTemplate ? (
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
								onClick={clearSavedTemplates}
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
							<Sparkles className="h-3 w-3" /> Browse
						</Button>
					)}
				</div>

				<Separator />

				{/* Custom override row */}
				<div className="flex items-center gap-3 px-4 py-3">
					<div className="flex-1">
						<p className="font-medium text-sm">Custom one-off message</p>
						<p className="text-muted-foreground text-xs">
							Write a message just for this campaign
						</p>
					</div>
					<Switch
						checked={values.templateSource === "custom"}
						onCheckedChange={(v) => {
							if (v) {
								setFieldValue("templateSource", "custom");
								setFieldValue("savedWaTemplate", null);
								setFieldValue("savedSmsTemplate", null);
							} else {
								setFieldValue("templateSource", "scenario");
							}
						}}
					/>
				</div>
			</div>

			{/* Custom fields */}
			{values.templateSource === "custom" && (
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label className="text-sm">WhatsApp message</Label>
						<Textarea
							className="min-h-25 resize-none rounded-xl font-mono text-xs"
							onChange={(e) => setFieldValue("customWhatsapp", e.target.value)}
							placeholder="Hi {name}! …"
							value={values.customWhatsapp}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-sm">SMS message</Label>
						<Textarea
							className="min-h-20 resize-none rounded-xl font-mono text-xs"
							onChange={(e) => setFieldValue("customSms", e.target.value)}
							placeholder="Hi {name}! …"
							value={values.customSms}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						Use{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono">
							{"{name}"}
						</code>{" "}
						to insert the contact's first name.
					</p>
				</div>
			)}

			{/* Message preview */}
			<div className="space-y-2">
				<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
					Message preview — {previewName.split(" ")[0]}
					{(values.savedWaTemplate || values.savedSmsTemplate) && (
						<span className="ml-2 font-normal text-muted-foreground normal-case">
							· saved templates
						</span>
					)}
				</p>
				{waContacts.length > 0 && (
					<div className="space-y-1.5 rounded-xl border bg-[#0d2016] px-4 py-3">
						<Badge
							className="border-[#25d36640] px-1.5 text-[#25d366] text-[10px]"
							variant="outline"
						>
							WhatsApp
						</Badge>
						<p className="whitespace-pre-wrap text-foreground/80 text-xs leading-relaxed">
							{preview(activeTemplate?.whatsapp ?? "") || (
								<span className="text-muted-foreground italic">
									No message yet
								</span>
							)}
						</p>
					</div>
				)}
				{smsContacts.length > 0 && (
					<div className="space-y-1.5 rounded-xl border bg-[#0d1a2e] px-4 py-3">
						<Badge
							className="border-[#60a5fa40] px-1.5 text-[#60a5fa] text-[10px]"
							variant="outline"
						>
							SMS
						</Badge>
						<p className="text-foreground/80 text-xs">
							{preview(activeTemplate?.sms ?? "") || (
								<span className="text-muted-foreground italic">
									No message yet
								</span>
							)}
						</p>
					</div>
				)}
				{waContacts.length === 0 && smsContacts.length === 0 && (
					<p className="text-muted-foreground text-xs">
						No recipients selected yet.
					</p>
				)}
			</div>

			{/* Delivery method selector */}
			{(waContacts.length > 0 || smsContacts.length > 0) && (
				<>
					<Separator />
					<DeliveryModeSelector
						hasMixedContacts={waContacts.length > 0 && smsContacts.length > 0}
						hasSmsOnlyContacts={
							smsContacts.length > 0 && waContacts.length === 0
						}
						hasWhatsappContacts={waContacts.length > 0}
						onChange={(v) => {
							// If user somehow picks prescreen on a SMS-only list, silently ignore
							if (v === "utility_prescreen" && waContacts.length === 0) {
								return;
							}
							setFieldValue("deliveryMode", v);
						}}
						value={
							// Auto-switch: if all contacts are SMS, force sms_fallback
							smsContacts.length > 0 && waContacts.length === 0
								? "sms_fallback"
								: values.deliveryMode
						}
					/>
				</>
			)}

			{/* Recipient scroll list */}
			{values.contacts.length > 0 && (
				<>
					<Separator />
					<div>
						<p className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
							Recipients ({values.contacts.length})
						</p>
						<div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
							{values.contacts.map((c) => (
								<div
									className="flex items-center gap-2.5 rounded-lg px-3 py-2 odd:bg-muted/30"
									key={c.id}
								>
									<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-[10px]">
										{c.name.charAt(0).toUpperCase()}
									</div>
									<span className="flex-1 truncate text-sm">{c.name}</span>
									<span
										className={`shrink-0 rounded border px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-wide ${CHANNEL_BADGE[c.channel]}`}
									>
										{c.channel === "whatsapp" ? "WA" : "SMS"}
									</span>
								</div>
							))}
						</div>
					</div>
				</>
			)}

			{/* Template picker dialog */}
			<TemplatePickerDialog
				currentSmsId={values.savedSmsTemplate?.id}
				currentWaId={values.savedWaTemplate?.id}
				hasSms={smsContacts.length > 0}
				hasWa={waContacts.length > 0}
				onConfirm={handleTemplatePair}
				onOpenChange={setPickerOpen}
				open={pickerOpen}
			/>
		</div>
	);
}

// ─── Step 4: Fill template variables ─────────────────────────────────────────

const highlightedRegex = /^\{+[a-zA-Z_]/;
function VariablesStep({
	manualVars,
	templateVars,
	setFieldValue,
	activeTemplate,
	previewName,
}: {
	manualVars: string[];
	templateVars: Record<string, string>;
	setFieldValue: <K extends keyof WizardValues>(
		k: K,
		v: WizardValues[K]
	) => void;
	activeTemplate: { whatsapp: string; sms: string };
	previewName: string;
}) {
	function setVar(key: string, value: string) {
		setFieldValue("templateVars", { ...templateVars, [key]: value });
	}

	const previewWa = personalizeMessage(
		activeTemplate.whatsapp,
		previewName,
		templateVars
	);
	const previewSms = personalizeMessage(
		activeTemplate.sms,
		previewName,
		templateVars
	);

	// Highlight unfilled vars in the preview
	function highlightUnfilled(text: string) {
		// Split on remaining {{var}} or {var} patterns, colour them red
		const parts = text.split(/(\{+[a-zA-Z_][a-zA-Z0-9_]*\}+)/g);
		return parts.map((p, i) =>
			highlightedRegex.test(p) ? (
				<span
					className="rounded bg-destructive/20 px-0.5 font-mono text-destructive"
					key={i.toString()}
				>
					{p}
				</span>
			) : (
				p
			)
		);
	}

	return (
		<div className="space-y-5">
			<p className="text-muted-foreground text-sm">
				This template contains variables that need values before sending. Fill
				them in below — they'll be the same for every recipient.
			</p>

			{/* Variable fields */}
			<div className="space-y-3">
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

			{/* Live preview */}
			<div className="space-y-2">
				<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
					Live preview — {previewName.split(" ")[0]}
				</p>
				<div className="space-y-1.5 rounded-xl border bg-[#0d2016] px-4 py-3">
					<Badge
						className="border-[#25d36640] px-1.5 text-[#25d366] text-[10px]"
						variant="outline"
					>
						WhatsApp
					</Badge>
					<p className="whitespace-pre-wrap text-foreground/80 text-xs leading-relaxed">
						{highlightUnfilled(previewWa)}
					</p>
				</div>
				<div className="space-y-1.5 rounded-xl border bg-[#0d1a2e] px-4 py-3">
					<Badge
						className="border-[#60a5fa40] px-1.5 text-[#60a5fa] text-[10px]"
						variant="outline"
					>
						SMS
					</Badge>
					<p className="whitespace-pre-wrap text-foreground/80 text-xs leading-relaxed">
						{highlightUnfilled(previewSms)}
					</p>
				</div>
				{manualVars.some((v) => !templateVars[v]?.trim()) && (
					<p className="flex items-center gap-1.5 text-destructive/80 text-xs">
						<AlertCircle className="h-3.5 w-3.5 shrink-0" />
						Highlighted placeholders above will appear literally in messages if
						left blank.
					</p>
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

	const { mutateAsync: sendCampaign, isPending, error } = useSendCampaign();
	const { mutateAsync: recordUsage } = useRecordTemplateUsage();
	// User's own DB-stored default template bodies per scenario.
	// Falls back to seed content if the user hasn't completed onboarding yet.
	const { data: scenarioDefaults } = useScenarioDefaults();

	const form = useForm({
		defaultValues: {
			scenario: "first_timer",
			contacts: [],
			templateSource: "scenario",
			savedWaTemplate: null,
			savedSmsTemplate: null,
			customWhatsapp: "",
			customSms: "",
			deliveryMode: "marketing",
			templateVars: {},
		} as WizardValues,
		onSubmit: async ({ value }) => {
			const useCustom = value.templateSource !== "scenario";

			// Resolve the template body: DB defaults > saved pick > custom override.
			// scenarioDefaults comes from the DB — the user's own editable templates.
			const dbDefaults = scenarioDefaults?.[value.scenario] ?? {
				whatsapp: "",
				sms: "",
			};

			const customTemplate = useCustom
				? value.templateSource === "saved"
					? {
							whatsapp: value.savedWaTemplate?.body ?? dbDefaults.whatsapp,
							sms: value.savedSmsTemplate?.body ?? dbDefaults.sms,
						}
					: { whatsapp: value.customWhatsapp, sms: value.customSms }
				: undefined;

			const result = await sendCampaign({
				scenario: value.scenario,
				contacts: value.contacts,
				useCustom,
				customTemplate: customTemplate ?? {
					whatsapp: "",
					sms: "",
				},
				deliveryMode: value.deliveryMode,
				templateVars: value.templateVars,
			});

			// Record usage on saved templates (fire-and-forget — one per picked channel)
			if (value.templateSource === "saved") {
				if (value.savedWaTemplate) {
					recordUsage({
						id: value.savedWaTemplate.id,
					}).catch(() => {
						toast.error("Failed to record template usage");
					});
				}
				if (
					value.savedSmsTemplate &&
					value.savedSmsTemplate.id !== value.savedWaTemplate?.id
				) {
					recordUsage({
						id: value.savedSmsTemplate.id,
					}).catch(() => {
						toast.error("Failed to record template usage");
					});
				}
			}

			// Navigate	 to the campaign detail page — shareable URL with live progress
			router.navigate({
				to: `/campaigns/${result.campaignId}`,
			});
		},
	});

	// Reactive form state needed for cost calculation — lifted here to satisfy Rules of Hooks
	const contacts = form.store.state.values.contacts;

	const deliveryMode = form.store.state.values.deliveryMode;
	const templateSource = form.store.state.values.templateSource;
	const savedWaTemplate = form.store.state.values.savedWaTemplate;
	const savedSmsTemplate = form.store.state.values.savedSmsTemplate;
	const customWhatsapp = form.store.state.values.customWhatsapp;
	const customSms = form.store.state.values.customSms;
	const scenarioId = form.store.state.values.scenario;

	const dbDefault0 = scenarioDefaults?.[scenarioId] ?? {
		whatsapp: "",
		sms: "",
	};
	const activeTemplateForCost =
		templateSource === "custom"
			? { whatsapp: customWhatsapp, sms: customSms }
			: templateSource === "saved"
				? {
						whatsapp: savedWaTemplate?.body ?? dbDefault0.whatsapp,
						sms: savedSmsTemplate?.body ?? dbDefault0.sms,
					}
				: dbDefault0;
	const manualVarsForCost = getManualVars(
		activeTemplateForCost.whatsapp,
		activeTemplateForCost.sms
	);
	const hasManualVarsForCost = manualVarsForCost.length > 0;
	const isLastStepForCost = step === 3 || (step === 2 && !hasManualVarsForCost);

	const { data: costData } = useCampaignCost(
		isLastStepForCost ? contacts.map((c) => ({ channel: c.channel })) : [],
		deliveryMode,
		isLastStepForCost ? contacts.map((c) => c.id) : undefined
	);

	return (
		<Card className="w-full rounded-2xl">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">New Campaign</CardTitle>
					<form.Subscribe
						selector={(s) => {
							const dbDef = scenarioDefaults?.[s.values.scenario] ?? {
								whatsapp: "",
								sms: "",
							};
							const t =
								s.values.templateSource === "custom"
									? { wa: s.values.customWhatsapp, sms: s.values.customSms }
									: s.values.templateSource === "saved"
										? {
												wa: s.values.savedWaTemplate?.body ?? dbDef.whatsapp,
												sms: s.values.savedSmsTemplate?.body ?? dbDef.sms,
											}
										: { wa: dbDef.whatsapp, sms: dbDef.sms };
							return getManualVars(t.wa ?? "", t.sms ?? "").length > 0;
						}}
					>
						{(hasVarsStep) => (
							<StepIndicator current={step} hasVarsStep={hasVarsStep} />
						)}
					</form.Subscribe>
				</div>
			</CardHeader>

			<Separator />

			<CardContent className="pt-5">
				{step === 0 && (
					<form.Field name="scenario">
						{(field) => (
							<ScenarioStep
								onChange={(v) => field.handleChange(v)}
								value={field.state.value}
							/>
						)}
					</form.Field>
				)}

				{step === 1 && (
					<form.Field name="contacts">
						{(field) => (
							<ContactsStep
								onSelectionChange={(c) => field.handleChange(c)}
								selected={field.state.value}
							/>
						)}
					</form.Field>
				)}

				{step === 2 && (
					<form.Subscribe selector={(s) => s.values}>
						{(values) => (
							<ReviewStep
								scenarioDefaults={scenarioDefaults}
								setFieldValue={(k, v) => form.setFieldValue(k, v as never)}
								values={values}
							/>
						)}
					</form.Subscribe>
				)}

				{step === 3 && (
					<form.Subscribe selector={(s) => s.values}>
						{(values) => {
							const dbDefault = scenarioDefaults?.[values.scenario] ?? {
								whatsapp: "",
								sms: "",
							};
							const activeTemplate = (() => {
								if (values.templateSource === "custom") {
									return {
										whatsapp: values.customWhatsapp,
										sms: values.customSms,
									};
								}
								if (values.templateSource === "saved") {
									return {
										whatsapp:
											values.savedWaTemplate?.body ?? dbDefault.whatsapp,
										sms: values.savedSmsTemplate?.body ?? dbDefault.sms,
									};
								}
								return {
									whatsapp: dbDefault.whatsapp,
									sms: dbDefault.sms,
								};
							})();
							const manualVars = getManualVars(
								activeTemplate.whatsapp,
								activeTemplate.sms
							);
							const previewName = values.contacts[0]?.name ?? "John";
							return (
								<VariablesStep
									activeTemplate={activeTemplate}
									manualVars={manualVars}
									previewName={previewName}
									setFieldValue={(k, v) => form.setFieldValue(k, v as never)}
									templateVars={values.templateVars}
								/>
							);
						}}
					</form.Subscribe>
				)}

				{error && (
					<div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
						<p className="text-destructive text-xs">
							{error instanceof Error
								? error.message
								: "Failed to send campaign. Please try again."}
						</p>
					</div>
				)}
			</CardContent>

			<Separator />

			<form.Subscribe selector={(s) => s.values}>
				{(values) => {
					// Resolve the active template so we know how many manual vars there are
					const dbDefault_ = scenarioDefaults?.[values.scenario] ?? {
						whatsapp: "",
						sms: "",
					};
					const activeTemplate_ = (() => {
						if (values.templateSource === "custom") {
							return { whatsapp: values.customWhatsapp, sms: values.customSms };
						}
						if (values.templateSource === "saved") {
							return {
								whatsapp: values.savedWaTemplate?.body ?? dbDefault_.whatsapp,
								sms: values.savedSmsTemplate?.body ?? dbDefault_.sms,
							};
						}
						return dbDefault_;
					})();
					const manualVars_ = getManualVars(
						activeTemplate_?.whatsapp ?? "",
						activeTemplate_?.sms ?? ""
					);
					const hasManualVars = manualVars_.length > 0;

					// Navigation: skip step 3 (Variables) if there are no manual vars
					const LAST_STEP = 3; // 0-Scenario 1-Contacts 2-Review 3-Variables(or send)
					const isLastStep =
						step === LAST_STEP || (step === 2 && !hasManualVars);
					const isVariablesStep = step === 3;

					const canProceed =
						step === 0
							? !!values.scenario
							: step === 1
								? values.contacts.length > 0
								: step === 2
									? values.templateSource === "scenario"
										? true
										: values.templateSource === "saved"
											? true // at least one channel has a saved pick or falls back to scenario default
											: values.customWhatsapp.trim().length > 0 &&
												values.customSms.trim().length > 0
									: isVariablesStep; // variables step — user can proceed even with blanks (warned but not blocked)

					const canAfford = costData?.canAfford ?? true;
					const shortfall = costData?.shortfallFormatted;
					const totalCost = costData?.totalCostFormatted;
					const isPrescreen = values.deliveryMode === "utility_prescreen";
					const consentCost = costData?.prescreenConsentCostFormatted;
					const fullCost = costData?.prescreenFullCostFormatted;
					const serviceWindowCount = costData?.serviceWindowCount ?? 0;

					function handleNext() {
						if (step === 2 && !hasManualVars) {
							// Skip Variables step — no vars to fill
							form.handleSubmit();
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
						if (step === 3 && !hasManualVars) {
							setStep(2);
							return;
						}
						setStep((s) => s - 1);
					}

					return (
						<>
							<CardFooter className="flex flex-col gap-3 pt-4">
								{/* Service window notice — contacts who can be sent free */}
								{isLastStep &&
									serviceWindowCount > 0 &&
									!isPrescreen &&
									values.deliveryMode === "marketing" && (
										<div className="flex w-full items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
											<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
											<p className="text-emerald-400 text-xs">
												<strong>{serviceWindowCount}</strong> contact
												{serviceWindowCount !== 1 ? "s" : ""} replied recently —
												sent free within their 24h window.
											</p>
										</div>
									)}

								{/* Cost info for prescreen mode */}
								{isLastStep && isPrescreen && consentCost && fullCost && (
									<div className="flex w-full items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
										<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										<p className="text-primary/80 text-xs">
											Consent messages cost{" "}
											<strong className="text-primary">{consentCost}</strong>{" "}
											upfront. If all contacts reply YES, total rises to{" "}
											<strong className="text-primary">{fullCost}</strong>.
											WhatsApp only — SMS contacts sent directly.
										</p>
									</div>
								)}

								{/* Insufficient balance warning */}
								{isLastStep && costData && !canAfford && (
									<div className="flex w-full items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
										<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
										<div className="min-w-0 flex-1">
											<p className="font-medium text-amber-400 text-xs">
												Insufficient balance — need {totalCost}, short by{" "}
												{shortfall}
											</p>
											<button
												className="mt-0.5 cursor-pointer border-none bg-transparent p-0 text-amber-400 text-xs underline"
												onClick={() => setDepositOpen(true)}
												type="button"
											>
												Top up wallet →
											</button>
										</div>
									</div>
								)}

								<div className="flex w-full justify-between gap-3">
									<Button
										className="gap-1 rounded-xl"
										disabled={isPending}
										onClick={handleBack}
										variant="outline"
									>
										<ChevronLeft className="h-4 w-4" /> Back
									</Button>

									{isLastStep ? (
										<div className="flex flex-col items-end gap-1">
											<Button
												className="gap-2 rounded-xl"
												disabled={!(canProceed && canAfford) || isPending}
												onClick={handleNext}
											>
												{isPending ? (
													<>
														<Loader2 className="h-4 w-4 animate-spin" />{" "}
														Sending…
													</>
												) : (
													<>
														<Send className="h-4 w-4" /> Send to{" "}
														{values.contacts.length} contact
														{values.contacts.length !== 1 ? "s" : ""}
													</>
												)}
											</Button>
											{costData && canAfford && (
												<p className="text-[10px] text-muted-foreground">
													{isPrescreen
														? `from ${consentCost} · up to ${fullCost}`
														: `est. ${totalCost}`}
												</p>
											)}
										</div>
									) : (
										<Button
											className="gap-1 rounded-xl"
											disabled={!canProceed}
											onClick={handleNext}
										>
											{step === 2 && hasManualVars ? "Fill variables" : "Next"}
											<ChevronRight className="h-4 w-4" />
										</Button>
									)}
								</div>
							</CardFooter>

							<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
						</>
					);
				}}
			</form.Subscribe>
		</Card>
	);
}
