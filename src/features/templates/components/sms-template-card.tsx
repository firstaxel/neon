/**
 * SmsTemplateCard
 *
 * Display card for an SMS-only template.
 * Simpler than WaTemplateCard — no status badge complexity,
 * no submission actions. Just name, category, SMS bubble preview,
 * usage stats, and edit/delete.
 */

import { Link } from "@tanstack/react-router";
import {
	CheckCircle2,
	Loader2,
	MoreHorizontal,
	Pencil,
	Phone,
	Trash2,
	Zap,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Separator } from "#/components/ui/separator";
import { previewText } from "../category/whatsapp/templates";
import type { WaTemplate } from "../hooks/use-templates";
import { useDeleteTemplate } from "../hooks/use-templates";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PREVIEW_VALUES: Record<string, string> = {
	name: "Sarah",
	firstName: "Sarah",
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

function getPreviewValue(v: string): string {
	if (PREVIEW_VALUES[v]) {
		return PREVIEW_VALUES[v];
	}
	const lower = v.toLowerCase();
	for (const [k, val] of Object.entries(PREVIEW_VALUES)) {
		if (lower.includes(k)) {
			return val;
		}
	}
	return `[${v}]`;
}

function relativeDate(iso: string | null): string | null {
	if (!iso) {
		return null;
	}
	const diff = Date.now() - new Date(iso).getTime();
	const days = Math.floor(diff / 86_400_000);
	if (days === 0) {
		return "today";
	}
	if (days === 1) {
		return "yesterday";
	}
	if (days < 30) {
		return `${days}d ago`;
	}
	return `${Math.floor(days / 30)}mo ago`;
}

function truncate(str: string, n: number) {
	return str.length > n ? `${str.slice(0, n).trimEnd()}…` : str;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmsTemplateCardProps {
	editHref?: string;
	onEdit?: (t: WaTemplate) => void;
	onSelect?: (t: WaTemplate) => void;
	selected?: boolean;
	template: WaTemplate;
}

// ─── SmsTemplateCard ──────────────────────────────────────────────────────────

export function SmsTemplateCard({
	template,
	onEdit,
	onSelect,
	selected,
	editHref,
}: SmsTemplateCardProps) {
	const [confirmDelete, setConfirmDelete] = useState(false);
	const { mutate: del, isPending: deleting } = useDeleteTemplate();

	const pvMap = Object.fromEntries(
		template.smsVars.map((v) => [v, getPreviewValue(v)])
	);
	const preview = previewText(template.smsBody, template.smsVars, pvMap);

	// Rough segment count
	const charCount = template.smsBody.replace(
		/\{\{[a-zA-Z0-9_]+\}\}/g,
		"Sample"
	).length;
	const segments = charCount <= 160 ? 1 : Math.ceil(charCount / 153);

	return (
		<>
			<div
				className={[
					"group flex flex-col rounded-2xl border transition-all duration-200",
					selected
						? "border-[#60a5fa60] ring-2 ring-[#60a5fa20]"
						: "hover:border-[#60a5fa30]",
				].join(" ")}
			>
				{/* Header */}
				<div className="flex items-start gap-3 p-4 pb-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#60a5fa20] bg-[#60a5fa10]">
						<Phone className="h-3.5 w-3.5 text-[#60a5fa]" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate font-semibold text-sm leading-tight">
								{template.displayName}
							</p>
							{selected && (
								<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#60a5fa]" />
							)}
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-1.5">
							<Badge
								className="rounded-full border-[#60a5fa20] bg-[#60a5fa08] text-[#60a5fa] text-[10px] uppercase"
								variant="secondary"
							>
								{template.category}
							</Badge>
							{segments > 1 && (
								<span className="text-[10px] text-amber-400">
									{segments} segments
								</span>
							)}
							{template.usageCount > 0 && (
								<span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
									<Zap className="h-2.5 w-2.5" />
									{template.usageCount}×
									{template.lastUsedAt &&
										` · ${relativeDate(template.lastUsedAt)}`}
								</span>
							)}
						</div>
					</div>

					{/* Actions */}
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
									size="icon"
									variant="ghost"
								>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="end" className="w-36 rounded-xl">
							{editHref ? (
								<DropdownMenuItem
									render={
										<Link className="flex items-center" to={editHref}>
											<Pencil className="mr-2 h-3.5 w-3.5" /> Edit
										</Link>
									}
								/>
							) : onEdit ? (
								<DropdownMenuItem onClick={() => onEdit(template)}>
									<Pencil className="mr-2 h-3.5 w-3.5" /> Edit
								</DropdownMenuItem>
							) : null}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => setConfirmDelete(true)}
							>
								<Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<Separator />

				{/* SMS Bubble preview */}
				<div className="flex-1 p-4 pt-3">
					<div className="rounded-xl border border-[#60a5fa20] bg-[#0d1a2e] px-3 py-2.5">
						<div className="mb-1.5 flex items-center gap-1">
							<Phone className="h-2.5 w-2.5 text-[#60a5fa]" />
							<span className="font-bold text-[#60a5fa] text-[9px] uppercase tracking-wider">
								SMS
							</span>
						</div>
						<p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-foreground/75 leading-relaxed">
							{truncate(preview, 160)}
						</p>
					</div>

					{/* Variable pills */}
					{template.smsVars.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{template.smsVars.map((v) => (
								<span
									className="rounded-md border border-[#60a5fa25] bg-[#60a5fa08] px-1.5 py-0.5 font-mono text-[#60a5fa] text-[9px]"
									key={v}
								>
									{`{{${v}}}`}
								</span>
							))}
						</div>
					)}
				</div>

				{/* Footer — select button */}
				{onSelect && (
					<>
						<Separator />
						<div className="p-3">
							<Button
								className={[
									"w-full gap-1.5 rounded-xl text-xs",
									selected
										? "border-transparent bg-[#60a5fa] text-white hover:bg-[#60a5fa]/90"
										: "",
								].join(" ")}
								onClick={() => onSelect(template)}
								size="sm"
								variant={selected ? "default" : "outline"}
							>
								{selected ? (
									<>
										<CheckCircle2 className="h-3.5 w-3.5" /> Selected
									</>
								) : (
									"Use this template"
								)}
							</Button>
						</div>
					</>
				)}
			</div>

			{/* Delete confirmation */}
			<AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
				<AlertDialogContent className="rounded-2xl">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete SMS template?</AlertDialogTitle>
						<AlertDialogDescription>
							<strong className="text-foreground">
								"{template.displayName}"
							</strong>{" "}
							will be permanently deleted. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleting}
							onClick={() => del({ id: template.id })}
						>
							{deleting ? (
								<>
									<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
									Deleting…
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
