"use client";

/**
 * SmsOnlyTemplateEditor
 *
 * Focused editor for SMS-only templates — no WhatsApp fields, no approval flow.
 * Templates are auto-approved on save and immediately available in campaigns.
 *
 * Sections:
 *   Identity  — display name, category tag (free-form with presets)
 *   Body      — full SmsTemplateSection (variables, segment counter, GSM-7 detection,
 *               opt-out tag, live SMS bubble preview)
 *
 * Variables supported: {{name}}, {{org}}, {{date}}, {{time}}, {{amount}},
 *                      {{event}}, {{code}}, {{link}}, {{phone}}, {{orderId}}, custom
 */

import { useForm } from "@tanstack/react-form";
import { AlertCircle, CheckCircle2, Loader2, Phone, Tag } from "lucide-react";
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
import { extractVars } from "../category/whatsapp/templates";
import type {
	WaCategory,
	WaTemplate,
	WaTemplateFormValues,
} from "../hooks/use-templates";
import { SmsTemplateSection } from "./sms-template-section";

// ─── Category presets ──────────────────────────────────────────────────────────

export const Purpose = [
	"general",
	"welcome",
	"follow-up",
	"reminder",
	"event",
	"announcement",
	"support",
	"promotion",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmsOnlyTemplateEditorProps {
	isSaving: boolean;
	onCancel: () => void;
	onSave: (values: WaTemplateFormValues) => Promise<void>;
	template?: WaTemplate; // undefined = create mode
}

// ─── Form values (SMS subset) ─────────────────────────────────────────────────

interface SmsFormValues {
	category: string;
	displayName: string;
	smsBody: string;
}

// ─── SmsOnlyTemplateEditor ────────────────────────────────────────────────────

export function SmsOnlyTemplateEditor({
	template,
	onSave,
	onCancel,
	isSaving,
}: SmsOnlyTemplateEditorProps) {
	const isEdit = !!template;

	const form = useForm({
		defaultValues: {
			displayName: template?.displayName ?? "",
			category: template?.category ?? "MARKETING",
			smsBody: template?.smsBody ?? "",
		} as SmsFormValues,
		onSubmit: async ({ value }) => {
			const smsVars = extractVars(value.smsBody);

			// Build a full WaTemplateFormValues shape with SMS-only defaults
			const slug = value.displayName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "_")
				.replace(/^_|_$/g, "")
				.slice(0, 60);

			const full: WaTemplateFormValues = {
				name: template?.name ?? slug,
				displayName: value.displayName,
				language: "en",
				category: "MARKETING",
				headerFormat: null,
				headerText: "",
				headerVars: [],
				bodyText: value.smsBody, // bodyText mirrors smsBody for SMS-only
				bodyVars: smsVars,
				footerText: "",
				buttons: [],
				smsBody: value.smsBody,
				smsVars,
				channel: "sms",
			};
			await onSave(full);
		},
	});

	const CATEGORY_LABELS: Record<WaCategory, string> = {
		MARKETING: "Marketing",
		UTILITY: "Utility",
		AUTHENTICATION: "Auth",
	};

	return (
		<Card className="w-full rounded-2xl">
			<CardHeader className="pb-4">
				<div className="flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#60a5fa25] bg-[#60a5fa15]">
						<Phone className="h-4 w-4 text-[#60a5fa]" />
					</div>
					<div>
						<CardTitle className="text-base">
							{isEdit ? "Edit SMS template" : "New SMS template"}
						</CardTitle>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Ready to use immediately — no approval required
						</p>
					</div>
					<div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2.5 py-1">
						<CheckCircle2 className="h-3 w-3 text-emerald-400" />
						<span className="font-medium text-[10px] text-emerald-400">
							Auto-approved
						</span>
					</div>
				</div>
			</CardHeader>

			<Separator />

			<CardContent className="space-y-6 pt-5">
				{/* ── Identity ── */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{/* Display name */}
					<form.Field
						name="displayName"
						validators={{
							onChange: ({ value }) =>
								value.trim() ? undefined : "Name is required",
						}}
					>
						{(field) => (
							<div className="space-y-1.5">
								<Label className="font-medium text-xs">Template name</Label>
								<Input
									className="rounded-xl"
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="e.g. Event Reminder"
									value={field.state.value}
								/>
								{field.state.meta.errors[0] && (
									<p className="flex items-center gap-1 text-destructive text-xs">
										<AlertCircle className="h-3 w-3" />
										{field.state.meta.errors[0] as string}
									</p>
								)}
							</div>
						)}
					</form.Field>

					{/* Category */}
					<form.Field name="category">
						{(field) => (
							<div className="space-y-1.5">
								<Label className="flex items-center gap-1.5 font-medium text-xs">
									<Tag className="h-3 w-3" /> Category
								</Label>
								<Input
									className="rounded-xl"
									list="sms-cat-list"
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="e.g. reminder, event…"
									value={field.state.value}
								/>
								<datalist id="sms-cat-list">
									{(Object.keys(CATEGORY_LABELS) as WaCategory[]).map((c) => (
										<option key={c} value={c}>
											{CATEGORY_LABELS[c]}
										</option>
									))}
								</datalist>
								{/* Quick-pick chips */}
								<div className="flex flex-wrap gap-1">
									{(Object.keys(CATEGORY_LABELS) as WaCategory[]).map((c) => (
										<button
											className={[
												"rounded-full border px-2 py-0.5 font-medium text-[10px] transition-colors",
												field.state.value === c
													? "border-[#60a5fa40] bg-[#60a5fa15] text-[#60a5fa]"
													: "border-border text-muted-foreground hover:border-muted-foreground/60",
											].join(" ")}
											key={c}
											onClick={() => field.handleChange(c)}
											type="button"
										>
											{c}
										</button>
									))}
								</div>
							</div>
						)}
					</form.Field>
				</div>

				<Separator />

				{/* ── SMS body (full SmsTemplateSection) ── */}
				<form.Field
					name="smsBody"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Message body is required",
					}}
				>
					{(field) => (
						<SmsTemplateSection
							error={field.state.meta.errors[0] as string | undefined}
							onChange={(v) => field.handleChange(v)}
							value={field.state.value}
						/>
					)}
				</form.Field>
			</CardContent>

			<Separator />

			<form.Subscribe selector={(s) => s.canSubmit}>
				{(canSubmit) => (
					<CardFooter className="flex justify-between gap-3 pt-4">
						<Button
							className="rounded-xl"
							disabled={isSaving}
							onClick={onCancel}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							className="gap-2 rounded-xl bg-[#60a5fa] text-white hover:bg-[#60a5fa]/90"
							disabled={!canSubmit || isSaving}
							onClick={() => form.handleSubmit()}
							type="button"
						>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" /> Saving…
								</>
							) : (
								<>
									<CheckCircle2 className="h-4 w-4" />{" "}
									{isEdit ? "Save changes" : "Create SMS template"}
								</>
							)}
						</Button>
					</CardFooter>
				)}
			</form.Subscribe>
		</Card>
	);
}
