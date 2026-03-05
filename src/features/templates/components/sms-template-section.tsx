"use client";

/**
 * SmsTemplateSection
 *
 * A self-contained SMS template editor used inside WaTemplateEditor.
 *
 * Features:
 * - GSM-7 vs Unicode character set detection (affects segment length: 160 vs 70)
 * - Segment counter (1 SMS = 160 GSM7 or 70 Unicode; concatenated: 153/67 per part)
 * - Named variable insertion: {{name}}, {{org}}, {{date}}, custom vars
 * - Opt-out tag quickfill: "Reply STOP to unsubscribe"
 * - Detected variables displayed as pills
 * - Live SMS bubble preview with variable replacement
 * - Encoding badge: GSM-7 (green) or Unicode (amber warning)
 */

import { AlertCircle, ChevronDown, Info, Phone, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { Textarea } from "#/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { extractVars, previewText } from "../category/whatsapp/templates";

// ─── GSM-7 detection ──────────────────────────────────────────────────────────

// Complete GSM-7 Basic Character Set + Extension Table
const GSM7_BASIC = new Set([
	"@",
	"£",
	"$",
	"¥",
	"è",
	"é",
	"ù",
	"ì",
	"ò",
	"Ç",
	"\n",
	"Ø",
	"ø",
	"\r",
	"Å",
	"å",
	"Δ",
	"_",
	"Φ",
	"Γ",
	"Λ",
	"Ω",
	"Π",
	"Ψ",
	"Σ",
	"Θ",
	"Ξ",
	" ",
	"Æ",
	"æ",
	"ß",
	"É",
	"!",
	'"',
	"#",
	"¤",
	"%",
	"&",
	"'",
	"(",
	")",
	"*",
	"+",
	",",
	"-",
	".",
	"/",
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	":",
	";",
	"<",
	"=",
	">",
	"?",
	"¡",
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q",
	"R",
	"S",
	"T",
	"U",
	"V",
	"W",
	"X",
	"Y",
	"Z",
	"Ä",
	"Ö",
	"Ñ",
	"Ü",
	"§",
	"¿",
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
	"s",
	"t",
	"u",
	"v",
	"w",
	"x",
	"y",
	"z",
	"ä",
	"ö",
	"ñ",
	"ü",
	"à",
]);
// Extension chars count as 2 in GSM-7
const GSM7_EXT = new Set(["\f", "^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

function classifyEncoding(text: string): {
	encoding: "GSM7" | "Unicode";
	charCount: number;
} {
	let charCount = 0;
	for (const ch of text) {
		if (GSM7_BASIC.has(ch)) {
			charCount += 1;
			continue;
		}
		if (GSM7_EXT.has(ch)) {
			charCount += 2;
			continue;
		}
		return { encoding: "Unicode", charCount: [...text].length };
	}
	return { encoding: "GSM7", charCount };
}

function getSmsSegments(text: string): {
	encoding: "GSM7" | "Unicode";
	charCount: number;
	segments: number;
	maxPerSeg: number;
	charsLeft: number;
} {
	const { encoding, charCount } = classifyEncoding(text);
	const singleMax = encoding === "GSM7" ? 160 : 70;
	const multiMax = encoding === "GSM7" ? 153 : 67;

	if (charCount === 0) {
		return {
			encoding,
			charCount: 0,
			segments: 1,
			maxPerSeg: singleMax,
			charsLeft: singleMax,
		};
	}

	const segments = charCount <= singleMax ? 1 : Math.ceil(charCount / multiMax);
	const maxPerSeg = segments === 1 ? singleMax : multiMax;
	const charsLeft = segments * maxPerSeg - charCount;

	return { encoding, charCount, segments, maxPerSeg, charsLeft };
}

// ─── Insert var helper ────────────────────────────────────────────────────────

function insertAtCursor(
	ref: React.RefObject<HTMLTextAreaElement>,
	value: string,
	snippet: string,
	onChange: (v: string) => void
) {
	const el = ref.current;
	if (!el) {
		onChange(value + snippet);
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
}

// ─── Preview values ───────────────────────────────────────────────────────────

const PREVIEW_VALUES: Record<string, string> = {
	name: "Sarah",
	firstName: "Sarah",
	lastName: "Johnson",
	org: "Grace Assembly",
	date: "Sunday, 15 Dec",
	time: "10:00 AM",
	amount: "₦5,000",
	event: "Easter Sunday",
	code: "ABC123",
	phone: "+2348012345678",
	link: "https://example.com",
	orderId: "ORD-12345",
};

function getPreviewValue(varName: string): string {
	if (PREVIEW_VALUES[varName]) {
		return PREVIEW_VALUES[varName];
	}
	const lower = varName.toLowerCase();
	for (const [k, v] of Object.entries(PREVIEW_VALUES)) {
		if (lower.includes(k)) {
			return v;
		}
	}
	return `[${varName}]`;
}

// ─── Variable insert dropdown ─────────────────────────────────────────────────

const COMMON_VARS = [
	"name",
	"org",
	"date",
	"time",
	"amount",
	"event",
	"code",
	"link",
	"phone",
	"orderId",
];

function VarDropdown({
	textareaRef,
	value,
	onChange,
}: {
	textareaRef: React.RefObject<HTMLTextAreaElement>;
	value: string;
	onChange: (v: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [custom, setCustom] = useState("");

	function insert(varName: string) {
		insertAtCursor(textareaRef, value, `{{${varName}}}`, onChange);
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
				<Plus className="h-3 w-3" /> Variable{" "}
				<ChevronDown className="h-3 w-3" />
			</Button>
			{open && (
				<>
					<div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
					<div className="absolute top-full right-0 z-20 mt-1 w-52 rounded-xl border bg-popover shadow-lg">
						<p className="px-3 pt-2 pb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
							Insert variable
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
						<div className="flex gap-1.5 p-2">
							<Input
								className="h-7 rounded-lg font-mono text-xs"
								onChange={(e) =>
									setCustom(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
								}
								onKeyDown={(e) => {
									if (e.key === "Enter" && custom) {
										insert(custom);
										setCustom("");
									}
								}}
								placeholder="customVar"
								value={custom}
							/>
							<Button
								className="h-7 rounded-lg px-3"
								disabled={!custom}
								onClick={() => {
									insert(custom);
									setCustom("");
								}}
								size="sm"
								type="button"
							>
								Add
							</Button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

// ─── SMS Bubble Preview ───────────────────────────────────────────────────────

function SmsBubble({ text, vars }: { text: string; vars: string[] }) {
	const pvMap = Object.fromEntries(vars.map((v) => [v, getPreviewValue(v)]));
	const preview = previewText(text, vars, pvMap);

	return (
		<div className="space-y-2 rounded-xl border border-[#60a5fa25] bg-[#0d1a2e] p-3">
			<div className="flex items-center gap-1.5">
				<Phone className="h-3 w-3 text-[#60a5fa]" />
				<span className="font-bold text-[#60a5fa] text-[10px] uppercase tracking-wider">
					SMS Preview
				</span>
				<span className="ml-auto text-[9px] text-muted-foreground">
					Sarah Johnson · now
				</span>
			</div>
			<div className="max-w-[85%] rounded-xl rounded-tl-sm border border-[#60a5fa20] bg-[#1a2a3e] px-3 py-2.5">
				<p className="whitespace-pre-wrap text-[11px] text-foreground/80 leading-relaxed">
					{preview || (
						<span className="text-muted-foreground italic">
							Your SMS will appear here…
						</span>
					)}
				</p>
			</div>
		</div>
	);
}

// ─── Segment counter display ──────────────────────────────────────────────────

function SegmentInfo({ text }: { text: string }) {
	// Use a rough estimate (replace vars with example values) for segment counting
	const resolved = text.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "Sample");
	const info = getSmsSegments(resolved);

	const getSegmentColor = (): string => {
		if (info.segments === 1) {
			return "text-muted-foreground";
		}
		if (info.segments === 2) {
			return "text-amber-400";
		}
		return "text-destructive";
	};

	const segColor = getSegmentColor();

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className={`font-mono text-[11px] tabular-nums ${segColor}`}>
				{info.charCount} chars · {info.segments}{" "}
				{info.segments === 1 ? "segment" : "segments"}
			</span>
			<Badge
				className={`h-4 rounded-full py-0 text-[9px] ${
					info.encoding === "GSM7"
						? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
						: "border-amber-500/30 bg-amber-500/5 text-amber-400"
				}`}
				variant="outline"
			>
				{info.encoding}
				{info.encoding === "Unicode" && " (2×)"}
			</Badge>
			{info.segments > 1 && (
				<span className="text-[10px] text-muted-foreground">
					{info.charsLeft} left in part {info.segments}
				</span>
			)}
		</div>
	);
}

// ─── SmsTemplateSection ───────────────────────────────────────────────────────

interface SmsTemplateSectionProps {
	disabled?: boolean;
	error?: string;
	onChange: (v: string) => void;
	value: string;
}

export function SmsTemplateSection({
	value,
	onChange,
	error,
	disabled,
}: SmsTemplateSectionProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const detectedVars = extractVars(value);

	const pvMap = Object.fromEntries(
		detectedVars.map((v) => [v, getPreviewValue(v)])
	);
	const resolvedPreview = previewText(value, detectedVars, pvMap);

	function addOptOut() {
		const tag = "\n\nReply STOP to unsubscribe.";
		if (!value.includes("STOP")) {
			onChange(value + tag);
		}
	}

	return (
		<TooltipProvider>
			<div className="space-y-3">
				{/* Header row */}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Phone className="h-4 w-4 text-[#60a5fa]" />
						<Label className="font-semibold text-sm">SMS Fallback</Label>
						<Tooltip>
							<TooltipTrigger>
								<Info className="h-3.5 w-3.5 text-muted-foreground" />
							</TooltipTrigger>
							<TooltipContent className="max-w-55 text-xs">
								Sent to contacts on the SMS channel. No WhatsApp formatting —
								plain text with named variables. Multiple segments increase
								cost.
							</TooltipContent>
						</Tooltip>
					</div>
					<div className="flex items-center gap-1.5">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									className="h-7 gap-1 rounded-lg text-muted-foreground text-xs hover:text-foreground"
									disabled={disabled || value.includes("STOP")}
									onClick={addOptOut}
									size="sm"
									type="button"
									variant="ghost"
								>
									+ Opt-out
								</Button>
							</TooltipTrigger>
							<TooltipContent className="text-xs">
								Append "Reply STOP to unsubscribe" — required in many regions
							</TooltipContent>
						</Tooltip>
						<VarDropdown
							onChange={onChange}
							textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
							value={value}
						/>
					</div>
				</div>

				{/* Textarea */}
				<div className="space-y-1.5">
					<Textarea
						className="min-h-25 resize-none rounded-xl font-mono text-sm"
						disabled={disabled}
						maxLength={918}
						onChange={(e) => onChange(e.target.value)}
						placeholder={
							"Hi {{name}}! Quick update from {{org}}.\n\nWe'd love to stay connected — feel free to reach out anytime.\n\nReply STOP to unsubscribe."
						} // 6 segments max
						ref={textareaRef}
						value={value}
					/>
					{error && (
						<p className="flex items-center gap-1 text-destructive text-xs">
							<AlertCircle className="h-3 w-3" />
							{error}
						</p>
					)}
				</div>

				{/* Segment info */}
				{value.length > 0 && <SegmentInfo text={value} />}

				{/* Detected vars */}
				{detectedVars.length > 0 && (
					<div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#60a5fa20] bg-[#0d1a2e] px-3 py-2">
						<span className="font-medium text-[#60a5fa] text-[10px]">
							Variables:
						</span>
						{detectedVars.map((v) => (
							<div className="flex items-center gap-1" key={v}>
								<span className="rounded-md border border-[#60a5fa30] bg-[#60a5fa10] px-1.5 py-0.5 font-mono text-[#60a5fa] text-[10px]">
									{`{{${v}}}`}
								</span>
								<span className="text-[9px] text-muted-foreground">
									→ {getPreviewValue(v)}
								</span>
							</div>
						))}
					</div>
				)}

				{/* Live SMS preview */}
				<SmsBubble text={resolvedPreview} vars={detectedVars} />

				{/* Unicode warning */}
				{value.length > 0 &&
					(() => {
						const resolved = value.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "Sample");
						const { encoding } = classifyEncoding(resolved);
						if (encoding === "Unicode") {
							return (
								<div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2">
									<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
									<p className="text-amber-400 text-xs">
										Message contains Unicode characters (emoji or special
										chars). Segment limit drops from 160 to 70 characters,
										increasing cost. Remove or replace to stay in GSM-7.
									</p>
								</div>
							);
						}
						return null;
					})()}
			</div>
		</TooltipProvider>
	);
}
