import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	FileImage,
	Loader2,
	Phone,
	RefreshCw,
	User,
	XCircle,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { Separator } from "#/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParseJobStatus = "pending" | "parsing" | "done" | "error";

interface ParsedContact {
	channel: "whatsapp" | "sms";
	id: string;
	name: string;
	phone: string;
	type: string;
}

export interface ParseJobCardProps {
	/** 0–1 float from Gemini confidence score */
	confidence?: number | null;
	contacts?: ParsedContact[];
	error?: string | null;
	fileSizeBytes?: number | null;
	jobId: string;
	/** Fires when user clicks "Use these contacts" on the done state */
	onConfirm?: (contacts: ParsedContact[]) => void;
	/** Fires when user clicks "Try again" on the error state */
	onRetry?: () => void;
	originalFilename?: string | null;
	/** 0–100, maps from getParseStatus.progress */
	progress: number;
	status: ParseJobStatus;
	totalExtracted?: number;
	warnings?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceBadgeVariant(
	v: number
): "default" | "secondary" | "destructive" {
	if (v >= 0.85) {
		return "default";
	}
	if (v >= 0.6) {
		return "secondary";
	}
	return "destructive";
}

function channelClass(channel: "whatsapp" | "sms"): string {
	return channel === "whatsapp"
		? "border-[#25d36640] bg-[#0d2016] text-[#25d366]"
		: "border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa]";
}

// ─── Shared: file chip ────────────────────────────────────────────────────────

function FileChip({ filename }: { filename: string }) {
	return (
		<div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
			<FileImage className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
			<span className="truncate text-muted-foreground text-xs">{filename}</span>
		</div>
	);
}

// ─── State: Pending ───────────────────────────────────────────────────────────

function PendingState({
	progress,
	fileSizeBytes,
}: {
	progress: number;
	fileSizeBytes?: number | null;
}) {
	return (
		<>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
						<Clock className="h-5 w-5 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1">
						<CardTitle className="text-base">Queued for parsing</CardTitle>
						<CardDescription>
							{fileSizeBytes ? formatBytes(fileSizeBytes) : "Waiting to start"}
						</CardDescription>
					</div>
					<Badge variant="secondary">Pending</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3 pb-4">
				<Progress className="h-1.5" value={progress} />
				<p className="text-muted-foreground text-xs">
					Your image is uploaded and queued. Processing will begin shortly.
				</p>
			</CardContent>
		</>
	);
}

// ─── State: Parsing ───────────────────────────────────────────────────────────

function ParsingState({
	progress,
	fileSizeBytes,
}: {
	progress: number;
	fileSizeBytes?: number | null;
}) {
	return (
		<>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
						<Loader2 className="h-5 w-5 animate-spin text-violet-500" />
					</div>
					<div className="min-w-0 flex-1">
						<CardTitle className="text-base">Gemini is reading…</CardTitle>
						<CardDescription>
							{fileSizeBytes
								? formatBytes(fileSizeBytes)
								: "Extracting contacts"}
						</CardDescription>
					</div>
					<Badge
						className="border-violet-500/40 bg-violet-500/10 text-violet-500"
						variant="outline"
					>
						Parsing
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3 pb-4">
				<Progress className="h-1.5" value={progress} />
				<p className="text-muted-foreground text-xs">
					AI is extracting names and phone numbers. Usually takes 5–15 seconds.
				</p>
			</CardContent>
		</>
	);
}

// ─── State: Done ──────────────────────────────────────────────────────────────

function DoneState({
	fileSizeBytes,
	confidence,
	warnings = [],
	contacts = [],
	totalExtracted = 0,
	onConfirm,
}: Pick<
	ParseJobCardProps,
	| "fileSizeBytes"
	| "confidence"
	| "warnings"
	| "contacts"
	| "totalExtracted"
	| "onConfirm"
>) {
	const waCount = contacts.filter((c) => c.channel === "whatsapp").length;
	const smsCount = contacts.filter((c) => c.channel === "sms").length;

	return (
		<>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
						<CheckCircle2 className="h-5 w-5 text-emerald-500" />
					</div>
					<div className="min-w-0 flex-1">
						<CardTitle className="text-base">
							{totalExtracted} contact{totalExtracted !== 1 ? "s" : ""}{" "}
							extracted
						</CardTitle>
						<CardDescription>
							{fileSizeBytes ? formatBytes(fileSizeBytes) : "Parsing complete"}
						</CardDescription>
					</div>
					<Badge
						className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
						variant="outline"
					>
						Done
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-4 pb-2">
				{/* Stats */}
				<div className="flex flex-wrap gap-2">
					{confidence != null && (
						<Badge variant={confidenceBadgeVariant(confidence)}>
							{Math.round(confidence * 100)}% confidence
						</Badge>
					)}
					{waCount > 0 && (
						<span
							className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-xs ${channelClass("whatsapp")}`}
						>
							{waCount} WhatsApp
						</span>
					)}
					{smsCount > 0 && (
						<span
							className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-xs ${channelClass("sms")}`}
						>
							{smsCount} SMS
						</span>
					)}
				</div>

				{/* Warnings */}
				{warnings.length > 0 && (
					<div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
						<div className="flex items-center gap-1.5">
							<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
							<span className="font-medium text-amber-600 text-xs dark:text-amber-400">
								{warnings.length} warning{warnings.length !== 1 ? "s" : ""}
							</span>
						</div>
						<ul className="space-y-0.5 pl-5">
							{warnings.map((w, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: display-only list
								<li className="list-disc text-muted-foreground text-xs" key={i}>
									{w}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Contact list — capped at 5 */}
				{contacts.length > 0 && (
					<>
						<Separator />
						<ul className="divide-y divide-border">
							{contacts.slice(0, 5).map((contact) => (
								<li
									className="flex items-center gap-3 py-2 text-sm"
									key={contact.id}
								>
									<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
										<User className="h-3.5 w-3.5 text-muted-foreground" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium leading-none">
											{contact.name}
										</p>
										<p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
											<Phone className="h-3 w-3" />
											{contact.phone}
										</p>
									</div>
									<span
										className={`shrink-0 rounded-md border px-1.5 py-0.5 font-semibold text-[10px] uppercase tracking-wide ${channelClass(contact.channel)}`}
									>
										{contact.channel === "whatsapp" ? "WA" : "SMS"}
									</span>
								</li>
							))}
						</ul>
						{contacts.length > 5 && (
							<p className="text-center text-muted-foreground text-xs">
								+{contacts.length - 5} more contact
								{contacts.length - 5 !== 1 ? "s" : ""}
							</p>
						)}
					</>
				)}
			</CardContent>

			{onConfirm && (
				<CardFooter className="pt-2">
					<Button
						className="w-full rounded-xl"
						onClick={() => onConfirm(contacts)}
					>
						Use these contacts
					</Button>
				</CardFooter>
			)}
		</>
	);
}

// ─── State: Error ─────────────────────────────────────────────────────────────

function ErrorState({
	error,
	onRetry,
}: Pick<ParseJobCardProps, "error" | "onRetry">) {
	return (
		<>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
						<XCircle className="h-5 w-5 text-destructive" />
					</div>
					<div className="min-w-0 flex-1">
						<CardTitle className="text-base">Parsing failed</CardTitle>
						<CardDescription>Could not extract contacts</CardDescription>
					</div>
					<Badge variant="destructive">Error</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-3 pb-4">
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
					<p className="text-destructive text-xs">
						{error ?? "An unexpected error occurred while parsing your image."}
					</p>
				</div>
				<p className="text-muted-foreground text-xs">
					Try uploading a clearer image. Ensure names and phone numbers are
					legible.
				</p>
			</CardContent>

			{onRetry && (
				<CardFooter className="pt-0">
					<Button
						className="w-full gap-2 rounded-xl"
						onClick={onRetry}
						variant="outline"
					>
						<RefreshCw className="h-4 w-4" />
						Try again
					</Button>
				</CardFooter>
			)}
		</>
	);
}

// ─── ParseJobCard ─────────────────────────────────────────────────────────────

/**
 * Displays the current state of a Gemini contact-parsing job.
 *
 * Covers all four ParseJobStatus states:
 *   pending  → clock icon + queued message + thin progress bar
 *   parsing  → spinning Gemini loader + animated progress
 *   done     → contact list + confidence badge + channel breakdown + warnings
 *   error    → error message from Gemini/server + retry button
 *
 * Wire up with oRPC polling:
 *
 *   const { data } = useQuery({
 *     queryKey: ["parseJob", jobId],
 *     queryFn: () => orpcClient.upload.getParseStatus({ jobId }),
 *     refetchInterval: ({ state }) =>
 *       state.data?.status === "done" || state.data?.status === "error"
 *         ? false : 1500,
 *   });
 *
 *   <ParseJobCard
 *     {...data}
 *     onRetry={() => startUpload(file)}
 *     onConfirm={(contacts) => setSelectedContacts(contacts)}
 *   />
 */
export function ParseJobCard(props: ParseJobCardProps) {
	const {
		status,
		progress,
		originalFilename,
		fileSizeBytes,
		confidence,
		warnings,
		contacts,
		totalExtracted,
		error,
		onRetry,
		onConfirm,
	} = props;

	return (
		<Card className="w-full overflow-hidden rounded-2xl">
			{originalFilename && <FileChip filename={originalFilename} />}

			{status === "pending" && (
				<PendingState fileSizeBytes={fileSizeBytes} progress={progress} />
			)}
			{status === "parsing" && (
				<ParsingState fileSizeBytes={fileSizeBytes} progress={progress} />
			)}
			{status === "done" && (
				<DoneState
					confidence={confidence}
					contacts={contacts}
					fileSizeBytes={fileSizeBytes}
					onConfirm={onConfirm}
					totalExtracted={totalExtracted}
					warnings={warnings}
				/>
			)}
			{status === "error" && <ErrorState error={error} onRetry={onRetry} />}
		</Card>
	);
}
