import React, { useCallback, useRef } from "react";

("use client");

/**
 * WaTemplateEditor
 *
 * Full WhatsApp Business API template editor.
 *
 * Sections (match Meta's component structure exactly):
 *   Identity   — display name, template name (snake_case), language, category
 *   Header     — optional: TEXT (with vars), IMAGE, VIDEO, DOCUMENT, LOCATION
 *   Body       — required text with named {{vars}}, char counter, formatting hints
 *   Footer     — optional short static text
 *   Buttons    — QUICK_REPLY, URL (static/dynamic), PHONE_NUMBER, COPY_CODE (max 10)
 *   SMS        — fallback body for SMS channel contacts
 *
 * Live phone preview updates as you type.
 * Variables are detected automatically from {{varName}} syntax.
 * Auto-populates bodyVars/headerVars/smsVars from text content.
 */

import { useForm } from "@tanstack/react-form";
import {
	AlertCircle,
	ChevronDown,
	ExternalLink,
	Image,
	Info,
	Loader2,
	MessageSquare,
	Phone,
	Plus,
	Sparkles,
	Type,
	Upload,
	Video,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
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
import { Textarea } from "#/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import {
	extractVars,
	previewText,
	WA_LANGUAGES,
} from "../category/whatsapp/templates";
import type {
	WaCategory,
	WaHeaderFormat,
	WaTemplate,
	WaTemplateButton,
	WaTemplateFormValues,
} from "../hooks/use-templates";

// ─── Constants ────────────────────────────────────────────────────────────────

const BODY_MAX = 1024;
const HEADER_MAX = 60;
const FOOTER_MAX = 60;
const BUTTON_TEXT_MAX = 25;

const CATEGORIES: { value: WaCategory; label: string; desc: string }[] = [
	{
		value: "MARKETING",
		label: "Marketing",
		desc: "Promotions, offers, announcements",
	},
	{
		value: "UTILITY",
		label: "Utility",
		desc: "Transactional, account updates",
	},
	{
		value: "AUTHENTICATION",
		label: "Authentication",
		desc: "OTPs, verification codes",
	},
];

const HEADER_FORMATS: {
	value: WaHeaderFormat;
	label: string;
	icon: React.ReactNode;
}[] = [
	{ value: "TEXT", label: "Text", icon: <Type className="h-3.5 w-3.5" /> },
	{ value: "IMAGE", label: "Image", icon: <Image className="h-3.5 w-3.5" /> },
	{ value: "VIDEO", label: "Video", icon: <Video className="h-3.5 w-3.5" /> },
	{
		value: "DOCUMENT",
		label: "Document",
		icon: <ExternalLink className="h-3.5 w-3.5" />,
	},
];

const STATUS_COLORS: Record<string, string> = {
	DRAFT: "border-border text-muted-foreground",
	PENDING: "border-amber-500/40 text-amber-400 bg-amber-500/5",
	APPROVED: "border-emerald-500/40 text-emerald-400 bg-emerald-500/5",
	REJECTED: "border-destructive/40 text-destructive bg-destructive/5",
	PAUSED: "border-orange-500/40 text-orange-400 bg-orange-500/5",
	DISABLED: "border-muted-foreground/40 text-muted-foreground",
};

// ─── Preview values for named vars ───────────────────────────────────────────

const PREVIEW_VALUES: Record<string, string> = {
	name: "Sarah",
	firstName: "Sarah",
	lastName: "Johnson",
	date: "Sunday, 15 Dec",
	time: "10:00 AM",
	amount: "₦5,000",
	price: "₦5,000",
	orderId: "ORD-12345",
	code: "482910",
	otp: "482910",
	link: "https://example.com",
	phone: "+2348012345678",
	org: "Grace Assembly",
	event: "Easter Sunday",
	venue: "Lagos, Nigeria",
};

function getPreviewValue(varName: string): string {
	const exact = PREVIEW_VALUES[varName];
	if (exact) {
		return exact;
	}
	const lower = varName.toLowerCase();
	for (const [key, val] of Object.entries(PREVIEW_VALUES)) {
		if (lower.includes(key.toLowerCase())) {
			return val;
		}
	}
	return `[${varName}]`;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
	title,
	subtitle,
	required,
	children,
	badge,
}: {
	title: string;
	subtitle?: string;
	required?: boolean;
	children: React.ReactNode;
	badge?: React.ReactNode;
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h3 className="font-semibold text-foreground text-sm">{title}</h3>
						{required && (
							<span className="font-medium text-[10px] text-destructive">
								required
							</span>
						)}
						{badge}
					</div>
					{subtitle && (
						<p className="mt-0.5 text-muted-foreground text-xs">{subtitle}</p>
					)}
				</div>
			</div>
			{children}
		</div>
	);
}

// ─── Variable pill ────────────────────────────────────────────────────────────

function VarPill({ name }: { name: string }) {
	return (
		<span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] text-primary">
			{`{{${name}}}`}
		</span>
	);
}

// ─── Insert var button ────────────────────────────────────────────────────────

function InsertVarButton({
	textareaRef,
	value,
	onChange,
}: {
	textareaRef: React.RefObject<HTMLTextAreaElement>;
	value: string;
	onChange: (v: string) => void;
}) {
	const [open, setOpen] = useState(false);

	const COMMON_VARS = [
		"name",
		"firstName",
		"date",
		"time",
		"amount",
		"orderId",
		"code",
		"otp",
		"link",
		"phone",
		"org",
		"event",
	];

	function insert(varName: string) {
		const el = textareaRef.current;
		const snippet = `{{${varName}}}`;
		if (!el) {
			onChange(value + snippet);
			setOpen(false);
			return;
		}
		const start = el.selectionStart ?? value.length;
		const end = el.selectionEnd ?? value.length;
		const next = value.slice(0, start) + snippet + value.slice(end);
		onChange(next);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + snippet.length, start + snippet.length);
		});
		setOpen(false);
	}

	return (
		<div className="relative">
			<Button
				className="h-7 gap-1 rounded-lg text-xs"
				onClick={() => setOpen((p) => !p)}
				size="sm"
				type="button"
				variant="outline"
			>
				<Plus className="h-3 w-3" /> Variable
				<ChevronDown className="ml-0.5 h-3 w-3" />
			</Button>
			{open && (
				<div className="absolute top-full left-0 z-20 mt-1 w-48 rounded-xl border bg-popover shadow-lg">
					<p className="px-3 pt-2 pb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
						Common variables
					</p>
					<div className="flex flex-wrap gap-1 p-2">
						{COMMON_VARS.map((v) => (
							<button
								className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] transition-colors hover:border-primary/50 hover:text-primary"
								key={v}
								onClick={() => insert(v)}
								type="button"
							>
								{`{{${v}}}`}
							</button>
						))}
					</div>
					<Separator />
					<div className="p-2">
						<CustomVarInput onInsert={insert} />
					</div>
				</div>
			)}
		</div>
	);
}

function CustomVarInput({ onInsert }: { onInsert: (v: string) => void }) {
	const [val, setVal] = useState("");
	return (
		<div className="flex gap-1">
			<Input
				className="h-7 rounded-lg font-mono text-xs"
				onChange={(e) => setVal(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
				onKeyDown={(e) => {
					if (e.key === "Enter" && val) {
						onInsert(val);
						setVal("");
					}
				}}
				placeholder="customVar"
				value={val}
			/>
			<Button
				className="h-7 rounded-lg"
				disabled={!val}
				onClick={() => {
					onInsert(val);
					setVal("");
				}}
				size="sm"
				type="button"
			>
				Add
			</Button>
		</div>
	);
}

// ─── Media header upload ─────────────────────────────────────────────────────

const ACCEPT: Record<"IMAGE" | "VIDEO" | "DOCUMENT", string> = {
	IMAGE: "image/jpeg,image/png,image/webp",
	VIDEO: "video/mp4",
	DOCUMENT: "application/pdf",
};
const MAX_MB: Record<"IMAGE" | "VIDEO" | "DOCUMENT", number> = {
	IMAGE: 5,
	VIDEO: 16,
	DOCUMENT: 100,
};

function MediaHeaderUpload({
	format,
	disabled,
	onHandle,
	existingHandle,
}: {
	format: "IMAGE" | "VIDEO" | "DOCUMENT";
	disabled?: boolean;
	onHandle: (handle: string) => void;
	existingHandle?: string;
}) {
	const [uploading, setUploading] = useState(false);
	const [uploaded, setUploaded] = useState<string | null>(
		existingHandle?.startsWith("4:") ? existingHandle : null
	);
	const [error, setError] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		if (
			file.size >
			MAX_MB[file.type as "IMAGE" | "VIDEO" | "DOCUMENT"] * 1024 * 1024
		) {
			toast.error("File upload size too much");
		}
		setError(null);
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append("file", file);
			const res = await fetch("/api/whatsapp/upload-media", {
				method: "POST",
				body: fd,
			});
			const data = (await res.json()) as { handle?: string; error?: string };
			if (!(res.ok && data.handle)) {
				throw new Error(data.error ?? "Upload failed");
			}
			setUploaded(data.handle);
			setFileName(file.name);
			onHandle(data.handle);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	}

	const label =
		format === "IMAGE" ? "image" : format === "VIDEO" ? "video" : "document";
	const Icon =
		format === "IMAGE" ? Image : format === "VIDEO" ? Video : ExternalLink;

	return (
		<div className="space-y-2">
			<input
				accept={ACCEPT[format]}
				className="hidden"
				disabled={disabled || uploading}
				onChange={handleFile}
				ref={inputRef}
				type="file"
			/>

			{uploaded ? (
				<div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
					<Icon className="h-4 w-4 shrink-0 text-emerald-400" />
					<div className="min-w-0 flex-1">
						<p className="font-medium text-emerald-400 text-xs">
							{format.charAt(0) + format.slice(1).toLowerCase()} uploaded
						</p>
						<p className="truncate text-[10px] text-muted-foreground">
							{fileName ?? "File ready"}
						</p>
					</div>
					{!disabled && (
						<Button
							className="h-7 rounded-lg text-muted-foreground text-xs"
							onClick={() => {
								setUploaded(null);
								setFileName(null);
								onHandle("");
							}}
							size="sm"
							type="button"
							variant="ghost"
						>
							Change
						</Button>
					)}
				</div>
			) : (
				<button
					className="flex w-full flex-col items-center gap-2 rounded-xl border border-border border-dashed bg-muted/20 px-4 py-6 text-center transition-colors hover:border-muted-foreground/40 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={disabled || uploading}
					onClick={() => inputRef.current?.click()}
					type="button"
				>
					{uploading ? (
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					) : (
						<Upload className="h-6 w-6 text-muted-foreground" />
					)}
					<div>
						<p className="font-medium text-foreground text-sm">
							{uploading ? "Uploading…" : `Upload ${label}`}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{format === "IMAGE" && "JPEG, PNG, WebP · max 5 MB"}
							{format === "VIDEO" && "MP4 · max 16 MB"}
							{format === "DOCUMENT" && "PDF · max 100 MB"}
						</p>
					</div>
				</button>
			)}

			{error && (
				<p className="flex items-center gap-1 text-destructive text-xs">
					<AlertCircle className="h-3 w-3 shrink-0" /> {error}
				</p>
			)}

			<p className="flex items-center gap-1 text-[10px] text-muted-foreground">
				<Info className="h-3 w-3" />
				This {label} will be stored by Meta as a media handle used during
				template approval and sending.
			</p>
		</div>
	);
}

// ─── Phone preview ────────────────────────────────────────────────────────────

function PhonePreview({ values }: { values: WaTemplateFormValues }) {
	const allVars = [...new Set([...values.headerVars, ...values.bodyVars])];
	const pvMap = Object.fromEntries(allVars.map((v) => [v, getPreviewValue(v)]));

	const headerText =
		values.headerFormat === "TEXT" && values.headerText
			? previewText(values.headerText, values.headerVars, pvMap)
			: null;

	const bodyPreview = previewText(values.bodyText, values.bodyVars, pvMap);

	return (
		<div className="sticky top-6">
			<p className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				Live preview
			</p>
			{/* Phone shell */}
			<div className="mx-auto w-[220px]">
				<div className="relative rounded-[28px] border-2 border-border bg-[#111827] p-1.5 shadow-xl">
					{/* Notch */}
					<div className="mx-auto mb-1 h-1.5 w-16 rounded-full bg-border" />
					{/* Screen */}
					<div
						className="overflow-hidden rounded-[22px] bg-[#0d1420]"
						style={{ minHeight: 320 }}
					>
						{/* WA header bar */}
						<div className="flex items-center gap-2 bg-[#0d2016] px-3 py-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
								<MessageSquare className="h-3.5 w-3.5 text-primary" />
							</div>
							<div>
								<p className="font-semibold text-[10px] text-foreground leading-tight">
									{values.displayName || "Your Business"}
								</p>
								<p className="text-[8px] text-muted-foreground">
									Business Account
								</p>
							</div>
						</div>

						{/* Chat area */}
						<div className="space-y-0.5 p-3">
							{/* Media header placeholder */}
							{values.headerFormat && values.headerFormat !== "TEXT" && (
								<div className="flex h-20 items-center justify-center rounded-t-xl rounded-br-xl border border-border bg-muted/40 text-muted-foreground">
									{values.headerFormat === "IMAGE" && (
										<Image className="h-6 w-6 opacity-40" />
									)}
									{values.headerFormat === "VIDEO" && (
										<Video className="h-6 w-6 opacity-40" />
									)}
									{values.headerFormat === "DOCUMENT" && (
										<ExternalLink className="h-6 w-6 opacity-40" />
									)}
								</div>
							)}

							<div
								className={[
									"max-w-[180px] rounded-xl border border-border bg-card px-3 py-2 shadow-sm",
									values.headerFormat && values.headerFormat !== "TEXT"
										? "rounded-t-none"
										: "",
								].join(" ")}
							>
								{/* Text header */}
								{headerText && (
									<p className="mb-1.5 font-bold text-[11px] text-foreground leading-tight">
										{headerText}
									</p>
								)}

								{/* Body */}
								<p className="whitespace-pre-wrap text-[10px] text-foreground/85 leading-relaxed">
									{bodyPreview || (
										<span className="text-muted-foreground italic">
											Body text…
										</span>
									)}
								</p>

								{/* Footer */}
								{values.footerText && (
									<p className="mt-1.5 text-[9px] text-muted-foreground leading-tight">
										{values.footerText}
									</p>
								)}

								{/* Timestamp */}
								<p className="mt-1 text-right text-[8px] text-muted-foreground">
									{new Date().toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</p>
							</div>

							{/* Buttons */}
							{values.buttons.length > 0 && (
								<div className="mt-1 space-y-1">
									{values.buttons.map((btn, i) => (
										<div
											className="max-w-[180px] rounded-xl border border-[#25d36640] bg-[#0d2016] px-3 py-1.5 text-center"
											key={i.toString()}
										>
											<p className="truncate font-medium text-[10px] text-primary">
												{btn.type === "URL" && (
													<ExternalLink className="mr-1 inline h-2.5 w-2.5" />
												)}
												{btn.type === "PHONE_NUMBER" && (
													<Phone className="mr-1 inline h-2.5 w-2.5" />
												)}
												{btn.text || "Button"}
											</p>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Variables used */}
			{allVars.length > 0 && (
				<div className="mt-4 space-y-1.5">
					<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
						Variables detected
					</p>
					<div className="flex flex-wrap gap-1">
						{allVars.map((v) => (
							<div className="flex items-center gap-1" key={v}>
								<VarPill name={v} />
								<span className="text-[9px] text-muted-foreground">
									→ {getPreviewValue(v)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Button editor row ────────────────────────────────────────────────────────

function ButtonRow({
	btn,
	index,
	onChange,
	onRemove,
}: {
	btn: WaTemplateButton;
	index: number;
	onChange: (b: WaTemplateButton) => void;
	onRemove: () => void;
}) {
	const TYPE_LABELS: Record<WaTemplateButton["type"], string> = {
		QUICK_REPLY: "Quick reply",
		URL: "URL",
		PHONE_NUMBER: "Phone",
		COPY_CODE: "Copy code",
	};

	return (
		<div className="space-y-2 rounded-xl border bg-muted/20 p-3">
			<div className="flex items-center gap-2">
				<Badge className="shrink-0 rounded-full text-[10px]" variant="outline">
					{index + 1}
				</Badge>
				<Select
					onValueChange={(v) =>
						onChange({ ...btn, type: v as WaTemplateButton["type"] })
					}
					value={btn.type}
				>
					<SelectTrigger className="h-8 w-36 rounded-lg text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="rounded-xl">
						{(Object.keys(TYPE_LABELS) as WaTemplateButton["type"][]).map(
							(t) => (
								<SelectItem className="text-xs" key={t} value={t}>
									{TYPE_LABELS[t]}
								</SelectItem>
							)
						)}
					</SelectContent>
				</Select>
				<button
					className="ml-auto text-muted-foreground hover:text-destructive"
					onClick={onRemove}
					type="button"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Button text */}
			<div className="grid grid-cols-2 gap-2">
				<div className="space-y-1">
					<Label className="text-[11px]">Button text</Label>
					<Input
						className="h-8 rounded-lg text-xs"
						maxLength={BUTTON_TEXT_MAX}
						onChange={(e) => onChange({ ...btn, text: e.target.value })}
						placeholder="e.g. Learn More"
						value={btn.text}
					/>
					<p className="text-right text-[10px] text-muted-foreground">
						{btn.text.length}/{BUTTON_TEXT_MAX}
					</p>
				</div>

				{/* Type-specific fields */}
				{btn.type === "URL" && (
					<div className="space-y-1">
						<Label className="text-[11px]">URL</Label>
						<Input
							className="h-8 rounded-lg text-xs"
							onChange={(e) => onChange({ ...btn, url: e.target.value })}
							placeholder="https://example.com/{{code}}"
							value={btn.url ?? ""}
						/>
						<p className="text-[9px] text-muted-foreground">
							Supports {"{{1}}"} for dynamic suffix
						</p>
					</div>
				)}
				{btn.type === "PHONE_NUMBER" && (
					<div className="space-y-1">
						<Label className="text-[11px]">Phone number</Label>
						<Input
							className="h-8 rounded-lg text-xs"
							onChange={(e) =>
								onChange({ ...btn, phoneNumber: e.target.value })
							}
							placeholder="+2348012345678"
							value={btn.phoneNumber ?? ""}
						/>
					</div>
				)}
				{btn.type === "COPY_CODE" && (
					<div className="space-y-1">
						<Label className="text-[11px]">Example code</Label>
						<Input
							className="h-8 rounded-lg text-xs"
							onChange={(e) => onChange({ ...btn, example: [e.target.value] })}
							placeholder="ABC123"
							value={btn.example?.[0] ?? ""}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Main editor component ────────────────────────────────────────────────────

const nameRegex = /^[a-z0-9_]+$/;

interface WaTemplateEditorProps {
	isSaving: boolean;
	onCancel: () => void;
	onSave: (values: WaTemplateFormValues) => Promise<void>;
	template?: WaTemplate;
}

export function WaTemplateEditor({
	template,
	onSave,
	onCancel,
	isSaving,
}: WaTemplateEditorProps) {
	const bodyRef = useRef<HTMLTextAreaElement>(null);
	const headerRef = useRef<HTMLTextAreaElement>(null);

	const isEdit = !!template;
	const isLocked =
		isEdit && !["DRAFT", "REJECTED"].includes(template.status ?? "DRAFT");

	const form = useForm({
		defaultValues: {
			name: template?.name ?? "",
			displayName: template?.displayName ?? "",
			language: template?.language ?? "en",
			category: (template?.category as WaCategory) ?? "MARKETING",
			headerFormat: (template?.headerFormat as WaHeaderFormat | null) ?? null,
			headerText: template?.headerText ?? "",
			headerVars: template?.headerVars ?? [],
			bodyText: template?.bodyText ?? "",
			bodyVars: template?.bodyVars ?? [],
			footerText: template?.footerText ?? "",
			buttons: (template?.buttons ?? []) as WaTemplateButton[],
		} as WaTemplateFormValues,
		onSubmit: async ({ value }) => {
			// Auto-extract vars from text before save
			const bodyVars = extractVars(value.bodyText);
			const headerVars =
				value.headerFormat === "TEXT" ? extractVars(value.headerText) : [];
			await onSave({ ...value, bodyVars, headerVars });
		},
	});

	// Auto-generate template name from displayName
	const autoSlug = useCallback(
		(display: string) =>
			display
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "_")
				.replace(/^_|_$/g, "")
				.slice(0, 60),
		[]
	);

	return (
		<TooltipProvider>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
				{/* ── Left: form ── */}
				<div className="space-y-6">
					{/* Status banner for locked templates */}
					{isLocked && (
						<div
							className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${STATUS_COLORS[template.status]}`}
						>
							<AlertCircle className="h-4 w-4 shrink-0" />
							<p className="font-medium text-sm">
								This template is <strong>{template.status}</strong> — editing is
								disabled.
								{template.status === "REJECTED" && template.rejectionReason && (
									<span className="mt-0.5 block font-normal text-xs opacity-80">
										Rejection reason: {template.rejectionReason}
									</span>
								)}
							</p>
						</div>
					)}

					{/* ── Identity ── */}
					<Section
						subtitle="Basic template metadata sent to WhatsApp"
						title="Identity"
					>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{/* Display name */}
							<form.Field
								name="displayName"
								validators={{
									onChange: ({ value }) =>
										value.trim() ? undefined : "Display name required",
								}}
							>
								{(field) => (
									<div className="space-y-1.5">
										<Label className="text-xs">Display name</Label>
										<Input
											className="rounded-xl"
											disabled={isLocked}
											onChange={(e) => {
												field.handleChange(e.target.value);
												// Auto-fill template name if not yet edited
												const slug = autoSlug(e.target.value);
												const nameField = form.getFieldValue("name");
												if (
													!nameField ||
													nameField === autoSlug(field.state.value)
												) {
													form.setFieldValue("name", slug);
												}
											}}
											placeholder="e.g. First Timer Welcome"
											value={field.state.value}
										/>
										{field.state.meta.errors[0] && (
											<p className="flex items-center gap-1 text-destructive text-xs">
												<AlertCircle className="h-3 w-3" />
												{field.state.meta.errors[0]}
											</p>
										)}
									</div>
								)}
							</form.Field>

							{/* Template name */}
							<form.Field
								name="name"
								validators={{
									onChange: ({ value }) =>
										value.trim()
											? nameRegex.test(value)
												? undefined
												: "Only lowercase letters, numbers, underscores"
											: "Template name required",
								}}
							>
								{(field) => (
									<div className="space-y-1.5">
										<Label className="flex items-center gap-1.5 text-xs">
											Template name (ID)
											<Tooltip>
												<TooltipTrigger>
													<Info className="h-3 w-3 text-muted-foreground" />
												</TooltipTrigger>
												<TooltipContent className="max-w-[200px] text-xs">
													Snake_case identifier sent to Meta. Must be unique per
													WhatsApp Business Account.
												</TooltipContent>
											</Tooltip>
										</Label>
										<Input
											className="rounded-xl font-mono text-sm"
											disabled={
												isEdit && !["DRAFT"].includes(template?.status ?? "")
											}
											onChange={(e) =>
												field.handleChange(
													e.target.value
														.toLowerCase()
														.replace(/[^a-z0-9_]/g, "")
												)
											}
											placeholder="first_timer_welcome"
											value={field.state.value}
										/>
										{field.state.meta.errors[0] && (
											<p className="flex items-center gap-1 text-destructive text-xs">
												<AlertCircle className="h-3 w-3" />
												{field.state.meta.errors[0]}
											</p>
										)}
									</div>
								)}
							</form.Field>

							{/* Language */}
							<form.Field name="language">
								{(field) => (
									<div className="space-y-1.5">
										<Label className="text-xs">Language</Label>
										<Select
											disabled={isLocked}
											onValueChange={(v) => field.handleChange(v ?? "")}
											value={field.state.value}
										>
											<SelectTrigger className="rounded-xl">
												<SelectValue />
											</SelectTrigger>
											<SelectContent className="max-h-60 rounded-xl">
												{WA_LANGUAGES.map((l) => (
													<SelectItem key={l.code} value={l.code}>
														{l.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>

							{/* Category */}
							<form.Field name="category">
								{(field) => (
									<div className="space-y-1.5">
										<Label className="text-xs">Category</Label>
										<Select
											disabled={isLocked}
											onValueChange={(v) => field.handleChange(v as WaCategory)}
											value={field.state.value}
										>
											<SelectTrigger className="rounded-xl">
												<SelectValue />
											</SelectTrigger>
											<SelectContent className="rounded-xl">
												{CATEGORIES.map((c) => (
													<SelectItem key={c.value} value={c.value}>
														<div>
															<p className="font-medium">{c.label}</p>
															<p className="text-muted-foreground text-xs">
																{c.desc}
															</p>
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</div>
					</Section>

					<Separator />

					{/* ── Header ── */}
					<Section
						subtitle="Optional. Appears above the body. Text supports one variable."
						title="Header"
					>
						<form.Field name="headerFormat">
							{(headerFormatField) => (
								<div className="space-y-3">
									{/* Format picker */}
									<div className="flex flex-wrap gap-2">
										<button
											className={[
												"rounded-lg border px-3 py-1.5 font-medium text-xs transition-colors",
												headerFormatField.state.value === null
													? "border-primary bg-primary/10 text-primary"
													: "border-border text-muted-foreground hover:border-muted-foreground/50",
											].join(" ")}
											disabled={isLocked}
											onClick={() => {
												headerFormatField.handleChange(null);
											}}
											type="button"
										>
											None
										</button>
										{HEADER_FORMATS.map((fmt) => (
											<button
												className={[
													"flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-xs transition-colors",
													headerFormatField.state.value === fmt.value
														? "border-primary bg-primary/10 text-primary"
														: "border-border text-muted-foreground hover:border-muted-foreground/50",
												].join(" ")}
												disabled={isLocked}
												key={fmt.value}
												onClick={() =>
													headerFormatField.handleChange(fmt.value)
												}
												type="button"
											>
												{fmt.icon} {fmt.label}
											</button>
										))}
									</div>

									{/* TEXT header input */}
									{headerFormatField.state.value === "TEXT" && (
										<form.Field name="headerText">
											{(field) => (
												<div className="space-y-1.5">
													<div className="flex items-center justify-between">
														<Label className="text-xs">Header text</Label>
														<div className="flex items-center gap-2">
															<span className="text-[11px] text-muted-foreground">
																{field.state.value.length}/{HEADER_MAX}
															</span>
															<InsertVarButton
																onChange={(v) => field.handleChange(v)}
																textareaRef={
																	headerRef as React.RefObject<HTMLTextAreaElement>
																}
																value={field.state.value}
															/>
														</div>
													</div>
													<Input
														className="rounded-xl font-mono text-sm"
														disabled={isLocked}
														maxLength={HEADER_MAX}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="e.g. Welcome, {{name}}!"
														ref={
															headerRef as unknown as React.Ref<HTMLInputElement>
														}
														value={field.state.value}
													/>
													<p className="text-[10px] text-muted-foreground">
														Max 1 variable allowed in header text.
													</p>
												</div>
											)}
										</form.Field>
									)}

									{/* Media header upload */}
									{headerFormatField.state.value &&
										headerFormatField.state.value !== "TEXT" && (
											<MediaHeaderUpload
												disabled={isLocked}
												existingHandle={
													form.getFieldValue("headerFormat") !== "TEXT"
														? (form.getFieldValue("headerText") ?? undefined)
														: undefined
												}
												format={
													headerFormatField.state.value as
														| "IMAGE"
														| "VIDEO"
														| "DOCUMENT"
												}
												onHandle={(handle) => {
													// Store handle in a hidden field — passed through on submit
													form.setFieldValue("headerText", handle);
												}}
											/>
										)}
								</div>
							)}
						</form.Field>
					</Section>

					<Separator />

					{/* ── Body ── */}
					<Section
						required
						subtitle="Main message text. Supports WhatsApp formatting: *bold* _italic_ ~strike~ and named variables {{varName}}."
						title="Body"
					>
						<form.Field
							name="bodyText"
							validators={{
								onChange: ({ value }) =>
									value.trim() ? undefined : "Body text is required",
							}}
						>
							{(field) => (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span
												className={[
													"font-medium text-[11px] tabular-nums",
													field.state.value.length > BODY_MAX * 0.9
														? field.state.value.length > BODY_MAX
															? "text-destructive"
															: "text-amber-400"
														: "text-muted-foreground",
												].join(" ")}
											>
												{field.state.value.length}/{BODY_MAX}
											</span>
										</div>
										<InsertVarButton
											onChange={(v) => field.handleChange(v)}
											textareaRef={
												bodyRef as React.RefObject<HTMLTextAreaElement>
											}
											value={field.state.value}
										/>
									</div>
									<Textarea
										className="min-h-35 resize-none rounded-xl font-mono text-sm"
										disabled={isLocked}
										maxLength={BODY_MAX}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder={
											"Hi {{name}}! 👋 It was wonderful connecting with you. We'd love to stay in touch — feel free to reply anytime.\n\nIs there anything we can help you with? 😊"
										}
										ref={bodyRef}
										value={field.state.value}
									/>
									{field.state.meta.errors[0] && (
										<p className="flex items-center gap-1 text-destructive text-xs">
											<AlertCircle className="h-3 w-3" />
											{field.state.meta.errors[0]}
										</p>
									)}

									{/* Detected variables */}
									<form.Subscribe selector={(s) => s.values.bodyText}>
										{(bodyText) => {
											const vars = extractVars(bodyText);
											if (!vars.length) {
												return null;
											}
											return (
												<div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/20 px-3 py-2">
													<span className="font-medium text-[10px] text-muted-foreground">
														Variables:
													</span>
													{vars.map((v) => (
														<VarPill key={v} name={v} />
													))}
												</div>
											);
										}}
									</form.Subscribe>
								</div>
							)}
						</form.Field>
					</Section>

					<Separator />

					{/* ── Footer ── */}
					<Section
						subtitle="Optional. Short static text below the body. No variables allowed."
						title="Footer"
					>
						<form.Field name="footerText">
							{(field) => (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<Label className="text-xs">Footer text</Label>
										<span className="text-[11px] text-muted-foreground">
											{field.state.value.length}/{FOOTER_MAX}
										</span>
									</div>
									<Input
										className="rounded-xl"
										disabled={isLocked}
										maxLength={FOOTER_MAX}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="e.g. Reply STOP to unsubscribe"
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
					</Section>

					<Separator />

					{/* ── Buttons ── */}
					<form.Field name="buttons">
						{(field) => (
							<Section
								badge={
									field.state.value.length > 0 && (
										<Badge
											className="rounded-full text-[10px]"
											variant="secondary"
										>
											{field.state.value.length}
										</Badge>
									)
								}
								subtitle="Optional. Up to 10 buttons. Mix of quick replies, URLs, and phone numbers."
								title="Buttons"
							>
								<div className="space-y-2">
									{field.state.value.map((btn, i) => (
										<ButtonRow
											btn={btn}
											index={i}
											key={i.toString()}
											onChange={(updated) => {
												const next = [...field.state.value];
												next[i] = updated;
												field.handleChange(next);
											}}
											onRemove={() => {
												field.handleChange(
													field.state.value.filter((_, j) => j !== i)
												);
											}}
										/>
									))}

									{field.state.value.length < 10 && !isLocked && (
										<div className="flex flex-wrap gap-2">
											{(
												[
													"QUICK_REPLY",
													"URL",
													"PHONE_NUMBER",
													"COPY_CODE",
												] as const
											).map((type) => (
												<Button
													className="h-8 gap-1.5 rounded-xl text-xs"
													key={type}
													onClick={() =>
														field.handleChange([
															...field.state.value,
															{
																type,
																text: "",
																url: type === "URL" ? "" : undefined,
																phoneNumber:
																	type === "PHONE_NUMBER" ? "" : undefined,
															},
														])
													}
													size="sm"
													type="button"
													variant="outline"
												>
													<Plus className="h-3 w-3" />
													{type === "QUICK_REPLY"
														? "Quick Reply"
														: type === "URL"
															? "URL"
															: type === "PHONE_NUMBER"
																? "Phone"
																: "Copy Code"}
												</Button>
											))}
										</div>
									)}
								</div>
							</Section>
						)}
					</form.Field>

					<Separator />

					{/* ── Actions ── */}
					<div className="flex items-center justify-between gap-3 pt-2">
						<Button
							className="rounded-xl"
							disabled={isSaving}
							onClick={onCancel}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<form.Subscribe selector={(s) => s.canSubmit}>
							{(canSubmit) => (
								<Button
									className="gap-2 rounded-xl"
									disabled={!canSubmit || isSaving || isLocked}
									onClick={() => form.handleSubmit()}
									type="button"
								>
									{isSaving ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" /> Saving…
										</>
									) : (
										<>
											<Sparkles className="h-4 w-4" />{" "}
											{isEdit ? "Save changes" : "Create template"}
										</>
									)}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</div>

				{/* ── Right: live phone preview ── */}
				<form.Subscribe selector={(s) => s.values}>
					{(values) => <PhonePreview values={values} />}
				</form.Subscribe>
			</div>
		</TooltipProvider>
	);
}
