"use client";

import { useForm } from "@tanstack/react-form";
import {
	AlertCircle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Loader2,
	MessageCircle,
	Send,
	Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { Progress } from "#/components/ui/progress";
import { Separator } from "#/components/ui/separator";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import {
	ContactsTable,
	type SelectedContact,
} from "#/features/contacts/components/contact-table";
import { SCENARIOS } from "#/lib/scenarios";
import type { Scenario, ScenarioId } from "#/lib/types";
import { useCampaignStatus, useSendCampaign } from "../hooks/use-campaign";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardValues {
	contacts: SelectedContact[];
	customSms: string;
	customWhatsapp: string;
	scenario: ScenarioId;
	useCustom: boolean;
}

const CHANNEL_BADGE = {
	whatsapp: "border-[#25d36640] bg-[#0d2016] text-[#25d366]",
	sms: "border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa]",
} as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
	{ label: "Scenario", icon: MessageCircle },
	{ label: "Contacts", icon: Users },
	{ label: "Review", icon: Send },
] as const;

function StepIndicator({ current }: { current: number }) {
	return (
		<div className="flex items-center gap-1.5">
			{STEPS.map((step, i) => {
				const Icon = step.icon;
				const done = i < current;
				const active = i === current;
				return (
					<div className="flex items-center gap-1.5" key={step.label}>
						<div
							className={[
								"flex h-7 w-7 items-center justify-center rounded-full font-semibold text-xs transition-colors",
								(() => {
									if (done) {
										return "bg-primary text-primary-foreground";
									}
									if (active) {
										return "bg-primary/15 text-primary ring-1 ring-primary/40";
									}
									return "bg-muted text-muted-foreground";
								})(),
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
						{i < STEPS.length - 1 && (
							<div
								className={`h-px w-6 ${i < current ? "bg-primary" : "bg-border"}`}
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
	return (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm">
				Choose the purpose of this campaign. The message template will be
				personalised for each recipient.
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				{SCENARIOS.map((s) => (
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
							<span className="text-2xl leading-none">{s.icon}</span>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm leading-tight">{s.label}</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{s.description}
								</p>
							</div>
							{value === s.id && (
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
							)}
						</div>
					</button>
				))}
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
	// Keep a stable Map so cross-page selections persist
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
				onSelectionChange={handleChange} // ← don't pollute the page URL
				selectable
				selectedIds={new Set(selectionMap.keys())}
				selectionMap={selectionMap}
			/>
		</div>
	);
}

// ─── Step 3: Review & Send ────────────────────────────────────────────────────

function ReviewStep({
	values,
	setFieldValue,
}: {
	values: WizardValues;
	setFieldValue: <K extends keyof WizardValues>(
		k: K,
		v: WizardValues[K]
	) => void;
}) {
	const scenario = SCENARIOS.find((s) => s.id === values.scenario) as Scenario;
	const waContacts = values.contacts.filter((c) => c.channel === "whatsapp");
	const smsContacts = values.contacts.filter((c) => c.channel === "sms");
	const previewName = values.contacts[0]?.name ?? "John";

	const template = values.useCustom
		? { whatsapp: values.customWhatsapp, sms: values.customSms }
		: scenario.template;

	const preview = (t: string) =>
		t.replace(/\{name\}/g, previewName.split(" ")[0]);

	return (
		<div className="space-y-5">
			{/* Summary chips */}
			<div className="grid grid-cols-3 gap-3">
				{[
					{ label: "Scenario", value: `${scenario.icon} ${scenario.label}` },
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

			{/* Custom template toggle */}
			<div className="flex items-center gap-3 rounded-xl border px-4 py-3">
				<div className="flex-1">
					<p className="font-medium text-sm">Custom message</p>
					<p className="text-muted-foreground text-xs">
						Override the scenario default template
					</p>
				</div>
				<Switch
					checked={values.useCustom}
					onCheckedChange={(v) => setFieldValue("useCustom", v)}
				/>
			</div>

			{/* Template editor or preview */}
			{values.useCustom ? (
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
			) : (
				<div className="space-y-2">
					<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
						Message preview — {previewName.split(" ")[0]}
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
								{preview(template.whatsapp)}
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
								{preview(template.sms)}
							</p>
						</div>
					)}
				</div>
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
		</div>
	);
}

// ─── Post-send: live progress ─────────────────────────────────────────────────

function SentState({
	campaignId,
	onReset,
}: {
	campaignId: string;
	onReset: () => void;
}) {
	const { data } = useCampaignStatus(campaignId);
	const done = data?.status === "completed" || data?.status === "failed";
	const total = data?.total ?? 0;
	const sent = data?.sent ?? 0;
	const failed = data?.failed ?? 0;

	return (
		<div className="flex flex-col items-center gap-6 py-6 text-center">
			{done ? (
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
					<CheckCircle2 className="h-8 w-8 text-emerald-500" />
				</div>
			) : (
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			)}

			<div className="space-y-1">
				<h3 className="font-semibold text-lg">
					{done ? "Campaign complete" : "Sending messages…"}
				</h3>
				<p className="text-muted-foreground text-sm">
					{done
						? `${sent} sent · ${failed} failed out of ${total}`
						: `${sent} of ${total} sent so far`}
				</p>
			</div>

			{!done && total > 0 && (
				<Progress
					className="h-1.5 w-full max-w-xs"
					value={total ? (sent / total) * 100 : 0}
				/>
			)}

			{done && (
				<Button className="rounded-xl" onClick={onReset}>
					Start another campaign
				</Button>
			)}
		</div>
	);
}

// ─── CampaignWizard ───────────────────────────────────────────────────────────

export function CampaignWizard() {
	const [step, setStep] = useState(0);
	const [campaignId, setCampaignId] = useState<string | null>(null);

	const { mutateAsync: sendCampaign, isPending, error } = useSendCampaign();

	const form = useForm({
		defaultValues: {
			scenario: "first_timer",
			contacts: [],
			useCustom: false,
			customWhatsapp: "",
			customSms: "",
		} as WizardValues,
		onSubmit: async ({ value }) => {
			const result = await sendCampaign({
				scenario: value.scenario,
				contacts: value.contacts,
				useCustom: value.useCustom,
				...(value.useCustom && {
					customTemplate: {
						whatsapp: value.customWhatsapp,
						sms: value.customSms,
					},
				}),
			});
			setCampaignId(result.campaignId);
		},
	});

	function handleReset() {
		form.reset();
		setStep(0);
		setCampaignId(null);
	}

	// ── Sent state ─────────────────────────────────────────────────────────────
	if (campaignId) {
		return (
			<Card className="w-full rounded-2xl">
				<CardContent className="pt-6">
					<SentState campaignId={campaignId} onReset={handleReset} />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full rounded-2xl">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">New Campaign</CardTitle>
					<StepIndicator current={step} />
				</div>
			</CardHeader>

			<Separator />

			<CardContent className="pt-5">
				{/* Step 1 */}
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

				{/* Step 2 */}
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

				{/* Step 3 — use Subscribe to get reactive values */}
				{step === 2 && (
					<form.Subscribe selector={(s) => s.values}>
						{(values) => (
							<ReviewStep
								setFieldValue={(k, v) => form.setFieldValue(k, v as never)}
								values={values}
							/>
						)}
					</form.Subscribe>
				)}

				{/* Error */}
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

			{/* Footer — Subscribe gives us reactive canProceed */}
			<form.Subscribe selector={(s) => s.values}>
				{(values) => {
					const hasValidCustomTemplates =
						values.customWhatsapp.trim().length > 0 &&
						values.customSms.trim().length > 0;

					let canProceed: boolean;
					if (step === 0) {
						canProceed = !!values.scenario;
					} else if (step === 1) {
						canProceed = values.contacts.length > 0;
					} else {
						canProceed = !values.useCustom || hasValidCustomTemplates;
					}

					return (
						<CardFooter className="flex justify-between gap-3 pt-4">
							<Button
								className="gap-1 rounded-xl"
								disabled={step === 0 || isPending}
								onClick={() => setStep((s) => s - 1)}
								variant="outline"
							>
								<ChevronLeft className="h-4 w-4" /> Back
							</Button>

							{step < 2 ? (
								<Button
									className="gap-1 rounded-xl"
									disabled={!canProceed}
									onClick={() => setStep((s) => s + 1)}
								>
									Next <ChevronRight className="h-4 w-4" />
								</Button>
							) : (
								<Button
									className="gap-2 rounded-xl"
									disabled={!canProceed || isPending}
									onClick={() => form.handleSubmit()}
								>
									{isPending ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" /> Sending…
										</>
									) : (
										<>
											<Send className="h-4 w-4" /> Send to{" "}
											{values.contacts.length} contact
											{values.contacts.length !== 1 ? "s" : ""}
										</>
									)}
								</Button>
							)}
						</CardFooter>
					);
				}}
			</form.Subscribe>
		</Card>
	);
}
