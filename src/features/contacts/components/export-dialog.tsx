"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Filter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import type { MessageChannel } from "#/lib/types";
import { orpc } from "#/orpc/client";
import { getContactTypeLabels } from "#/features/miscellaneous/org";
import { useProfile } from "#/features/profile/hooks/use-profile";

type Format = "csv" | "xlsx";
type Channel = "whatsapp" | "sms";
type ContactType = "new_contact" | "returning" | "contact" | "prospect";

interface ExportFilters {
	activeOnly: boolean;
	channel: Channel | "all";
	format: Format;
	lastContactedFrom: string;
	lastContactedTo: string;
	search: string;
	type: ContactType | "all";
}

export function ExportContactsDialog({
	trigger,
}: {
	trigger?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [filters, setFilters] = useState<ExportFilters>({
		format: "csv",
		channel: "all",
		type: "all",
		activeOnly: false,
		lastContactedFrom: "",
		lastContactedTo: "",
		search: "",
	});

	const { data: profile } = useProfile();
	const typeLabels = getContactTypeLabels(profile?.orgType);

	const exportMutation = useMutation(orpc.contacts.export.mutationOptions());

	function set<K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) {
		setFilters((f) => ({ ...f, [key]: value }));
	}

	async function handleExport() {
		setLoading(true);
		try {
			const result = await exportMutation.mutateAsync({
				format: filters.format,
				...(filters.channel !== "all" && { channel: filters.channel }),
				...(filters.type !== "all" && { type: filters.type }),
				activeOnly: filters.activeOnly,
				...(filters.lastContactedFrom && {
					lastContactedFrom: filters.lastContactedFrom,
				}),
				...(filters.lastContactedTo && {
					lastContactedTo: filters.lastContactedTo,
				}),
				...(filters.search && { search: filters.search }),
			});

			if (result.count === 0) {
				toast.error("No contacts match these filters.");
				return;
			}

			// Trigger download
			if (result.format === "csv") {
				const blob = new Blob([result.content], {
					type: "text/csv;charset=utf-8;",
				});
				downloadBlob(blob, `contacts-${today()}.csv`);
			} else {
				// base64 xlsx
				const binary = atob(result.content);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) {
					bytes[i] = binary.charCodeAt(i);
				}
				const blob = new Blob([bytes], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				});
				downloadBlob(blob, `contacts-${today()}.xlsx`);
			}

			setOpen(false);
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger
				render={
					<div>
						{trigger ?? (
							<Button className="gap-2" size="sm" variant="outline">
								<Download size={14} />
								Export
							</Button>
						)}
					</div>
				}
			/>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Download size={16} /> Export contacts
					</DialogTitle>
					<DialogDescription>
						Choose your filters and download format. Only contacts matching the
						filters will be included.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 py-2">
					{/* Format */}
					<div className="space-y-2">
						<Label className="flex items-center gap-1.5 font-medium text-sm">
							<FileText size={13} /> Format
						</Label>
						<div className="grid grid-cols-2 gap-2">
							{(["csv", "xlsx"] as const).map((f) => (
								<button
									className={`flex items-center gap-2 rounded-lg border p-3 font-medium text-sm transition-colors ${
										filters.format === f
											? "border-primary bg-primary/5 text-primary"
											: "border-border bg-background text-muted-foreground hover:bg-muted/50"
									}`}
									key={f}
									onClick={() => set("format", f)}
									type="button"
								>
									{f === "csv" ? (
										<FileText size={15} />
									) : (
										<FileSpreadsheet size={15} />
									)}
									{f === "csv" ? "CSV" : "Excel (.xlsx)"}
								</button>
							))}
						</div>
					</div>

					<div className="border-t" />

					{/* Filters */}
					<div className="space-y-3">
						<Label className="flex items-center gap-1.5 font-medium text-sm">
							<Filter size={13} /> Filters
						</Label>

						{/* Search */}
						<div className="space-y-1">
							<Label className="text-muted-foreground text-xs">
								Search name / phone
							</Label>
							<Input
								onChange={(e) => set("search", e.target.value)}
								placeholder="Emeka, +234…"
								value={filters.search}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							{/* Channel */}
							<div className="space-y-1">
								<Label className="text-muted-foreground text-xs">Channel</Label>
								<Select
									onValueChange={(v) => set("channel", v as MessageChannel)}
									value={filters.channel}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All channels</SelectItem>
										<SelectItem value="whatsapp">WhatsApp</SelectItem>
										<SelectItem value="sms">SMS</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Type */}
							<div className="space-y-1">
								<Label className="text-muted-foreground text-xs">
									Contact type
								</Label>
								<Select
									onValueChange={(v) => set("type", v as ContactType)}
									value={filters.type}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All types</SelectItem>
										<SelectItem value="new_contact">{typeLabels.new_contact}</SelectItem>
										<SelectItem value="returning">{typeLabels.returning}</SelectItem>
										<SelectItem value="contact">{typeLabels.contact}</SelectItem>
										<SelectItem value="prospect">{typeLabels.prospect}</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Last contacted date range */}
						<div className="space-y-1">
							<Label className="text-muted-foreground text-xs">
								Last replied — date range
							</Label>
							<div className="grid grid-cols-2 gap-2">
								<Input
									onChange={(e) => set("lastContactedFrom", e.target.value)}
									placeholder="From"
									type="date"
									value={filters.lastContactedFrom}
								/>
								<Input
									onChange={(e) => set("lastContactedTo", e.target.value)}
									placeholder="To"
									type="date"
									value={filters.lastContactedTo}
								/>
							</div>
						</div>

						{/* Active only */}
						<div className="flex items-center gap-2">
							<Checkbox
								checked={filters.activeOnly}
								id="active-only"
								onCheckedChange={(v) => set("activeOnly", !!v)}
							/>
							<Label className="cursor-pointer text-sm" htmlFor="active-only">
								Active contacts only (exclude opted-out)
							</Label>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={() => setOpen(false)} variant="outline">
						Cancel
					</Button>
					<Button className="gap-2" disabled={loading} onClick={handleExport}>
						<Download size={14} />
						{loading ? "Exporting…" : "Download"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
	return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
