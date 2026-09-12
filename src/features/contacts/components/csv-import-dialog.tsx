"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle,
	Download,
	FileSpreadsheet,
	Loader2,
	RotateCw,
	UploadCloud,
} from "lucide-react";
import Papa from "papaparse";
import { type ChangeEvent, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "#/components/ui/label";
import { Progress } from "#/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { client } from "#/orpc/client";
import { normalizePhoneNumber } from "../utils/phone";

interface CsvImportDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

type ImportStage = "upload" | "mapping" | "importing" | "completed";
type DuplicateStrategy = "skip_duplicates" | "overwrite" | "tags_only";

interface ColumnMapping {
	channel: string;
	email: string;
	name: string;
	notes: string;
	phone: string;
	tags: string;
	type: string;
}

interface RowError {
	phone: string;
	reason: string;
	rowNumber: number;
}

const CHUNK_SIZE = 250;

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
	const qc = useQueryClient();

	const [stage, setStage] = useState<ImportStage>("upload");
	const [file, setFile] = useState<File | null>(null);
	const [headers, setHeaders] = useState<string[]>([]);
	const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
	const [mapping, setMapping] = useState<ColumnMapping>({
		channel: "",
		email: "",
		name: "",
		notes: "",
		phone: "",
		tags: "",
		type: "",
	});

	// Strategy and fallbacks
	const [strategy, setStrategy] =
		useState<DuplicateStrategy>("skip_duplicates");
	const [defaultChannel, setDefaultChannel] = useState<"whatsapp" | "sms">(
		"whatsapp"
	);
	const [defaultType, setDefaultType] = useState<
		"prospect" | "contact" | "returning" | "new_contact"
	>("prospect");
	const [defaultTagsInput, setDefaultTagsInput] = useState("");

	// Progress state
	const [progressPercent, setProgressPercent] = useState(0);
	const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
	const [totalChunksCount, setTotalChunksCount] = useState(0);
	const [createdTotal, setCreatedTotal] = useState(0);
	const [updatedTotal, setUpdatedTotal] = useState(0);
	const [skippedTotal, setSkippedTotal] = useState(0);
	const [importErrors, setImportErrors] = useState<RowError[]>([]);
	const [activeBatchId, setActiveBatchId] = useState<string | undefined>(
		undefined
	);
	const [isRetrying, setIsRetrying] = useState(false);

	function resetState() {
		setStage("upload");
		setFile(null);
		setHeaders([]);
		setParsedRows([]);
		setMapping({
			channel: "",
			email: "",
			name: "",
			notes: "",
			phone: "",
			tags: "",
			type: "",
		});
		setStrategy("skip_duplicates");
		setDefaultChannel("whatsapp");
		setDefaultType("prospect");
		setDefaultTagsInput("");
		setProgressPercent(0);
		setCurrentChunkIndex(0);
		setTotalChunksCount(0);
		setCreatedTotal(0);
		setUpdatedTotal(0);
		setSkippedTotal(0);
		setImportErrors([]);
		setActiveBatchId(undefined);
		setIsRetrying(false);
	}

	function handleClose(nextOpen: boolean) {
		if (stage === "importing") {
			const confirmClose = window.confirm(
				"An import is in progress. Closing now may interrupt remaining batches. Are you sure?"
			);
			if (!confirmClose) {
				return;
			}
		}
		if (!nextOpen) {
			resetState();
		}
		onOpenChange(nextOpen);
	}

	function downloadSampleCsv() {
		const sampleContent =
			"Name,Phone,Email,Tags,Channel,Type,Notes\n" +
			'Chukwudi Okafor,08031234567,chukwudi@example.ng,"first_timer,youth",whatsapp,prospect,Met at Sunday service\n' +
			"Amina Bello,08129876543,amina@example.ng,choir,sms,contact,Prefers afternoon SMS\n" +
			"Babajide Sanwo,09055551234,,business,whatsapp,returning,\n";

		const blob = new Blob([sampleContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute("download", "velocast_sample_contacts.csv");
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
		const selected = e.target.files?.[0];
		if (!selected) {
			return;
		}

		if (!selected.name.toLowerCase().endsWith(".csv")) {
			toast.error("Please upload a CSV file (.csv format)");
			return;
		}

		if (selected.size > 5 * 1024 * 1024) {
			toast.error("File exceeds 5MB limit. Please upload a smaller file.");
			return;
		}

		setFile(selected);

		Papa.parse<Record<string, string>>(selected, {
			complete: (results) => {
				const detectedHeaders = results.meta.fields ?? [];
				if (detectedHeaders.length === 0) {
					toast.error("Could not find column headers in the CSV file");
					return;
				}

				const cleanRows = results.data.filter((row) =>
					Object.values(row).some(
						(val) => typeof val === "string" && val.trim().length > 0
					)
				);

				if (cleanRows.length === 0) {
					toast.error("The selected file has no data rows");
					return;
				}

				setHeaders(detectedHeaders);
				setParsedRows(cleanRows);

				// Auto guess column mappings based on header names
				const lowerHeaders = detectedHeaders.map((h) => ({
					lower: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
					raw: h,
				}));

				const findMatch = (candidates: string[]) => {
					const hit = lowerHeaders.find((h) =>
						candidates.some((c) => h.lower.includes(c))
					);
					return hit ? hit.raw : "";
				};

				setMapping({
					channel: findMatch(["channel", "platform"]),
					email: findMatch(["email", "mail"]),
					name: findMatch([
						"name",
						"fullname",
						"member",
						"customer",
						"contact",
					]),
					notes: findMatch(["notes", "note", "comment", "description"]),
					phone: findMatch(["phone", "mobile", "tel", "whatsapp", "number"]),
					tags: findMatch(["tag", "tags", "group", "category", "label"]),
					type: findMatch(["type", "status", "role"]),
				});

				setStage("mapping");
			},
			error: (err) => {
				toast.error(`Failed to parse CSV file: ${err.message}`);
			},
			header: true,
			preview: 10_000,
			skipEmptyLines: "greedy",
			transformHeader: (header) => header.trim(),
		});
	}

	async function runBatchImport() {
		if (!(mapping.name && mapping.phone)) {
			toast.error("Please map both Name and Phone columns");
			return;
		}

		const cleanDefaultTags = defaultTagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);

		const formattedRows = parsedRows.map((row, index) => {
			const rawPhone = (row[mapping.phone] ?? "").trim();
			const rawName = (row[mapping.name] ?? "").trim();
			const rawEmail = mapping.email ? (row[mapping.email] ?? "").trim() : "";
			const rawNotes = mapping.notes ? (row[mapping.notes] ?? "").trim() : "";
			const rawChannel = mapping.channel
				? (row[mapping.channel] ?? "").trim().toLowerCase()
				: "";
			const rawType = mapping.type
				? (row[mapping.type] ?? "").trim().toLowerCase()
				: "";
			const rawTags = mapping.tags ? (row[mapping.tags] ?? "").trim() : "";

			const rowTagsList = rawTags
				? rawTags
						.split(/[;,]/)
						.map((t) => t.trim())
						.filter(Boolean)
				: [];

			// Collect any unmapped columns into metadata
			const metadata: Record<string, unknown> = {};
			for (const [key, val] of Object.entries(row)) {
				if (
					key !== mapping.name &&
					key !== mapping.phone &&
					key !== mapping.email &&
					key !== mapping.channel &&
					key !== mapping.type &&
					key !== mapping.tags &&
					key !== mapping.notes &&
					val
				) {
					metadata[key] = val;
				}
			}

			return {
				channel: (rawChannel === "sms" || rawChannel === "whatsapp"
					? rawChannel
					: undefined) as "whatsapp" | "sms" | undefined,
				email: rawEmail || undefined,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
				name: rawName || "Unnamed Contact",
				notes: rawNotes || undefined,
				phone: rawPhone,
				rowNumber: index + 2, // 1-indexed accounting for CSV header row
				tags: rowTagsList,
				type: (["new_contact", "returning", "contact", "prospect"].includes(
					rawType
				)
					? rawType
					: undefined) as
					| "new_contact"
					| "returning"
					| "contact"
					| "prospect"
					| undefined,
			};
		});

		const chunks: Array<typeof formattedRows> = [];
		for (let i = 0; i < formattedRows.length; i += CHUNK_SIZE) {
			chunks.push(formattedRows.slice(i, i + CHUNK_SIZE));
		}

		setTotalChunksCount(chunks.length);
		setStage("importing");
		setProgressPercent(0);

		let batchId = activeBatchId;
		let createdAcc = createdTotal;
		let updatedAcc = updatedTotal;
		let skippedAcc = skippedTotal;
		const accumulatedErrors = [...importErrors];

		for (let index = currentChunkIndex; index < chunks.length; index++) {
			setCurrentChunkIndex(index);
			const chunk = chunks[index];
			const isLast = index === chunks.length - 1;

			try {
				const result = await client.contacts.importBatch({
					contacts: chunk,
					defaultChannel,
					defaultTags: cleanDefaultTags,
					defaultType,
					filename: file?.name ?? "contacts.csv",
					importBatchId: batchId,
					isLastChunk: isLast,
					strategy,
					totalRows: formattedRows.length,
				});

				batchId = result.importBatchId;
				setActiveBatchId(batchId);

				createdAcc += result.created;
				updatedAcc += result.updated;
				skippedAcc += result.skipped;

				if (result.errors?.length) {
					accumulatedErrors.push(...result.errors);
				}

				setCreatedTotal(createdAcc);
				setUpdatedTotal(updatedAcc);
				setSkippedTotal(skippedAcc);
				setImportErrors([...accumulatedErrors]);

				const percent = Math.round(((index + 1) / chunks.length) * 100);
				setProgressPercent(percent);
			} catch (err: unknown) {
				setIsRetrying(true);
				const errorMsg =
					err instanceof Error ? err.message : "Chunk upload interrupted";
				toast.error(`Chunk ${index + 1} upload failed: ${errorMsg}`);
				return;
			}
		}

		qc.invalidateQueries({ queryKey: ["contacts"] });
		qc.invalidateQueries({ queryKey: ["tags"] });
		qc.invalidateQueries({ queryKey: ["contact-imports"] });
		setStage("completed");
	}

	return (
		<Dialog onOpenChange={handleClose} open={open}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileSpreadsheet className="h-5 w-5 text-primary" />
						Import Contacts from CSV
					</DialogTitle>
					<DialogDescription>
						Upload a spreadsheet of contacts with phone numbers, names, and
						tags.
					</DialogDescription>
				</DialogHeader>

				{/* ── STAGE 1: UPLOAD ── */}
				{stage === "upload" && (
					<div className="space-y-6 py-2">
						<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-muted-foreground/25 border-dashed p-8 text-center transition-colors hover:border-primary/50">
							<UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" />
							<p className="font-medium text-sm">
								Click to select or drag and drop a CSV file
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Supports standard comma, semicolon, or tab separated values up
								to 5MB
							</p>
							<label className="mt-4 cursor-pointer">
								<span className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm shadow hover:bg-primary/90">
									Browse File
								</span>
								<input
									accept=".csv,text/csv"
									className="hidden"
									onChange={handleFileSelect}
									type="file"
								/>
							</label>
						</div>

						<div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
							<div className="text-xs">
								<p className="font-medium">Need a template?</p>
								<p className="text-muted-foreground">
									Download our preformatted spreadsheet example with Nigerian
									phone numbers.
								</p>
							</div>
							<Button
								className="gap-1.5 text-xs"
								onClick={downloadSampleCsv}
								size="sm"
								variant="outline"
							>
								<Download className="h-3.5 w-3.5" />
								Sample CSV
							</Button>
						</div>
					</div>
				)}

				{/* ── STAGE 2: MAPPING & PREVIEW ── */}
				{stage === "mapping" && (
					<div className="space-y-6 py-2">
						<div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2.5">
							<div className="flex items-center gap-2">
								<FileSpreadsheet className="h-4 w-4 text-primary" />
								<span className="font-medium text-sm">{file?.name}</span>
								<Badge variant="secondary">
									{parsedRows.length.toLocaleString()} rows
								</Badge>
							</div>
							<Button
								className="h-7 text-xs"
								onClick={() => setStage("upload")}
								variant="ghost"
							>
								Change file
							</Button>
						</div>

						{/* Strategy & Defaults */}
						<div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs">Duplicate Strategy</Label>
								<Select
									onValueChange={(val) => setStrategy(val as DuplicateStrategy)}
									value={strategy}
								>
									<SelectTrigger className="h-9 rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="skip_duplicates">
											Skip duplicates (Keep existing)
										</SelectItem>
										<SelectItem value="overwrite">
											Overwrite existing fields
										</SelectItem>
										<SelectItem value="tags_only">Merge tags only</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1.5">
								<Label className="text-xs">Default Channel</Label>
								<Select
									onValueChange={(val) =>
										setDefaultChannel(val as "whatsapp" | "sms")
									}
									value={defaultChannel}
								>
									<SelectTrigger className="h-9 rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="whatsapp">WhatsApp</SelectItem>
										<SelectItem value="sms">SMS</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1.5">
								<Label className="text-xs">Default Contact Type</Label>
								<Select
									onValueChange={(val) =>
										setDefaultType(
											val as
												| "prospect"
												| "contact"
												| "returning"
												| "new_contact"
										)
									}
									value={defaultType}
								>
									<SelectTrigger className="h-9 rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="prospect">Prospect</SelectItem>
										<SelectItem value="contact">Contact</SelectItem>
										<SelectItem value="returning">Returning</SelectItem>
										<SelectItem value="new_contact">New Contact</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1.5">
								<Label className="text-xs">
									Tags to Apply (comma separated)
								</Label>
								<Input
									className="h-9 rounded-xl"
									onChange={(e) => setDefaultTagsInput(e.target.value)}
									placeholder="e.g. event_import, march_2026"
									value={defaultTagsInput}
								/>
							</div>
						</div>

						{/* Column Mapping Grid */}
						<div className="space-y-3">
							<Label className="font-semibold text-xs">
								Column Mapping (select which CSV header corresponds to each
								field)
							</Label>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1">
									<span className="font-medium text-xs">
										Name <span className="text-red-500">*</span>
									</span>
									<Select
										onValueChange={(val) =>
											setMapping((m) => ({ ...m, name: val ?? "" }))
										}
										value={mapping.name}
									>
										<SelectTrigger className="h-8 rounded-xl text-xs">
											<SelectValue placeholder="Select column" />
										</SelectTrigger>
										<SelectContent>
											{headers.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="font-medium text-xs">
										Phone Number <span className="text-red-500">*</span>
									</span>
									<Select
										onValueChange={(val) =>
											setMapping((m) => ({ ...m, phone: val ?? "" }))
										}
										value={mapping.phone}
									>
										<SelectTrigger className="h-8 rounded-xl text-xs">
											<SelectValue placeholder="Select column" />
										</SelectTrigger>
										<SelectContent>
											{headers.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="text-muted-foreground text-xs">Email</span>
									<Select
										onValueChange={(val) =>
											setMapping((m) => ({
												...m,
												email: !val || val === "none" ? "" : val,
											}))
										}
										value={mapping.email || "none"}
									>
										<SelectTrigger className="h-8 rounded-xl text-xs">
											<SelectValue placeholder="Optional" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">None</SelectItem>
											{headers.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="text-muted-foreground text-xs">Tags</span>
									<Select
										onValueChange={(val) =>
											setMapping((m) => ({
												...m,
												tags: !val || val === "none" ? "" : val,
											}))
										}
										value={mapping.tags || "none"}
									>
										<SelectTrigger className="h-8 rounded-xl text-xs">
											<SelectValue placeholder="Optional" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">None</SelectItem>
											{headers.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="text-muted-foreground text-xs">Notes</span>
									<Select
										onValueChange={(val) =>
											setMapping((m) => ({
												...m,
												notes: !val || val === "none" ? "" : val,
											}))
										}
										value={mapping.notes || "none"}
									>
										<SelectTrigger className="h-8 rounded-xl text-xs">
											<SelectValue placeholder="Optional" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">None</SelectItem>
											{headers.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						{/* Preview Table */}
						{mapping.phone && (
							<div className="space-y-2">
								<Label className="text-xs">
									Sample Preview (First 3 rows with phone normalization)
								</Label>
								<div className="overflow-hidden rounded-xl border text-xs">
									<Table>
										<TableHeader>
											<TableRow className="bg-muted/40">
												<TableHead>Row</TableHead>
												<TableHead>Name</TableHead>
												<TableHead>Phone Input</TableHead>
												<TableHead>Normalized E.164</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{parsedRows.slice(0, 3).map((row, i) => {
												const rawPhone = row[mapping.phone] ?? "";
												const norm = normalizePhoneNumber(rawPhone, "NG");
												return (
													// biome-ignore lint/suspicious/noArrayIndexKey: sample rows
													<TableRow key={i}>
														<TableCell className="font-mono text-muted-foreground">
															{i + 1}
														</TableCell>
														<TableCell className="font-medium">
															{row[mapping.name] || "Unnamed"}
														</TableCell>
														<TableCell className="font-mono">
															{rawPhone}
														</TableCell>
														<TableCell>
															{norm.success ? (
																<span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
																	<CheckCircle className="h-3 w-3" />
																	{norm.phone}
																</span>
															) : (
																<span className="flex items-center gap-1 text-red-500">
																	<AlertTriangle className="h-3 w-3" />
																	Invalid
																</span>
															)}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							</div>
						)}

						<DialogFooter>
							<Button onClick={() => setStage("upload")} variant="outline">
								Back
							</Button>
							<Button
								disabled={!(mapping.name && mapping.phone)}
								onClick={runBatchImport}
							>
								Start Import ({parsedRows.length.toLocaleString()} Contacts)
							</Button>
						</DialogFooter>
					</div>
				)}

				{/* ── STAGE 3: IMPORTING ── */}
				{stage === "importing" && (
					<div className="space-y-6 py-8 text-center">
						<div className="flex flex-col items-center justify-center">
							<Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
							<h3 className="font-semibold text-lg">Importing Contacts…</h3>
							<p className="text-muted-foreground text-sm">
								Processing chunk {currentChunkIndex + 1} of {totalChunksCount} (
								{CHUNK_SIZE} rows per batch)
							</p>
						</div>

						<div className="mx-auto w-full max-w-md space-y-2">
							<Progress value={progressPercent} />
							<div className="flex justify-between text-muted-foreground text-xs">
								<span>{progressPercent}% completed</span>
								<span>
									{createdTotal + updatedTotal + skippedTotal} of{" "}
									{parsedRows.length} contacts
								</span>
							</div>
						</div>

						<div className="mx-auto grid max-w-sm grid-cols-3 gap-2 text-center text-xs">
							<div className="rounded-xl bg-muted/40 p-2.5">
								<p className="text-muted-foreground">Created</p>
								<p className="font-semibold text-base text-emerald-600 dark:text-emerald-400">
									{createdTotal}
								</p>
							</div>
							<div className="rounded-xl bg-muted/40 p-2.5">
								<p className="text-muted-foreground">Updated</p>
								<p className="font-semibold text-base text-blue-600 dark:text-blue-400">
									{updatedTotal}
								</p>
							</div>
							<div className="rounded-xl bg-muted/40 p-2.5">
								<p className="text-muted-foreground">Skipped</p>
								<p className="font-semibold text-amber-600 text-base dark:text-amber-400">
									{skippedTotal}
								</p>
							</div>
						</div>

						{isRetrying && (
							<div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
								<p className="font-medium text-red-500 text-sm">
									Upload paused due to a network or server hiccup.
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Already committed contacts are safe. Click below to resume
									remaining chunks.
								</p>
								<Button
									className="mt-3 gap-1.5 text-xs"
									onClick={runBatchImport}
									size="sm"
								>
									<RotateCw className="h-3.5 w-3.5" />
									Resume Import
								</Button>
							</div>
						)}
					</div>
				)}

				{/* ── STAGE 4: COMPLETED ── */}
				{stage === "completed" && (
					<div className="space-y-6 py-4">
						<div className="flex flex-col items-center text-center">
							<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
								<CheckCircle className="h-6 w-6" />
							</div>
							<h3 className="font-semibold text-lg">Import Complete</h3>
							<p className="text-muted-foreground text-sm">
								All spreadsheet rows have been processed and saved.
							</p>
						</div>

						<div className="grid grid-cols-4 gap-2 text-center text-xs">
							<div className="rounded-xl border bg-card p-3">
								<p className="text-muted-foreground">Created</p>
								<p className="font-semibold text-emerald-600 text-lg dark:text-emerald-400">
									{createdTotal}
								</p>
							</div>
							<div className="rounded-xl border bg-card p-3">
								<p className="text-muted-foreground">Updated</p>
								<p className="font-semibold text-blue-600 text-lg dark:text-blue-400">
									{updatedTotal}
								</p>
							</div>
							<div className="rounded-xl border bg-card p-3">
								<p className="text-muted-foreground">Skipped</p>
								<p className="font-semibold text-amber-600 text-lg dark:text-amber-400">
									{skippedTotal}
								</p>
							</div>
							<div className="rounded-xl border bg-card p-3">
								<p className="text-muted-foreground">Errors</p>
								<p className="font-semibold text-lg text-red-500">
									{importErrors.length}
								</p>
							</div>
						</div>

						{importErrors.length > 0 && (
							<div className="space-y-2">
								<Label className="flex items-center gap-1.5 text-red-500 text-xs">
									<AlertTriangle className="h-3.5 w-3.5" />
									Rejected Rows ({importErrors.length})
								</Label>
								<div className="max-h-40 overflow-y-auto rounded-xl border bg-muted/20 p-2 text-xs">
									<div className="space-y-1">
										{importErrors.slice(0, 50).map((err, i) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: error list
											<div
												className="flex items-center justify-between border-border/40 border-b py-1 text-muted-foreground last:border-0"
												key={i}
											>
												<span>
													Row {err.rowNumber}: {err.phone || "Missing phone"}
												</span>
												<span className="font-medium text-red-500">
													{err.reason}
												</span>
											</div>
										))}
									</div>
									{importErrors.length > 50 && (
										<p className="pt-2 text-center text-muted-foreground text-xs">
											...and {importErrors.length - 50} more errors
										</p>
									)}
								</div>
							</div>
						)}

						<DialogFooter>
							<Button
								className="w-full sm:w-auto"
								onClick={() => handleClose(false)}
							>
								Done
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
