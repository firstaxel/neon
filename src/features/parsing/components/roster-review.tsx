import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Check,
	Eye,
	FileImage,
	Loader2,
	Plus,
	Tag,
	Trash2,
	X,
	XCircle,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Checkbox } from "#/components/ui/checkbox";
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
import { normalizePhoneNumber } from "#/features/contacts/utils/phone";
import type { CandidateContact } from "#/lib/gemini";
import { orpc } from "#/orpc/client";

export interface RosterReviewProps {
	jobId: string;
	onClose?: () => void;
	onSuccess?: (result: {
		createdCount: number;
		updatedCount: number;
		skippedCount: number;
	}) => void;
}

interface TagBadgeProps {
	onRemove: (tag: string) => void;
	tag: string;
}

const TagBadge = memo(function TagBadgeItem({ tag, onRemove }: TagBadgeProps) {
	const handleRemove = useCallback(() => {
		onRemove(tag);
	}, [onRemove, tag]);

	return (
		<Badge className="gap-1 pr-1 pl-2" variant="secondary">
			<Tag className="h-3 w-3" />
			<span>{tag}</span>
			<button
				className="hover:text-destructive"
				onClick={handleRemove}
				type="button"
			>
				<X className="h-3 w-3" />
			</button>
		</Badge>
	);
});

interface CandidateRowProps {
	candidate: CandidateContact;
	onRemove: (id: string) => void;
	onUpdateField: (
		id: string,
		field: keyof CandidateContact,
		value: unknown
	) => void;
}

const CandidateRow = memo(function CandidateRowItem({
	candidate,
	onRemove,
	onUpdateField,
}: CandidateRowProps) {
	const handleIncludedChange = useCallback(
		(checked: boolean | "indeterminate") => {
			onUpdateField(candidate.id, "included", Boolean(checked));
		},
		[candidate.id, onUpdateField]
	);

	const handleNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onUpdateField(candidate.id, "name", e.target.value);
		},
		[candidate.id, onUpdateField]
	);

	const handlePhoneChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onUpdateField(candidate.id, "phone", e.target.value);
		},
		[candidate.id, onUpdateField]
	);

	const handleChannelChange = useCallback(
		(val: "whatsapp" | "sms" | null) => {
			if (val) {
				onUpdateField(candidate.id, "channel", val);
			}
		},
		[candidate.id, onUpdateField]
	);

	const handleTypeChange = useCallback(
		(val: "new_contact" | "returning" | "contact" | "prospect" | null) => {
			if (val) {
				onUpdateField(candidate.id, "type", val);
			}
		},
		[candidate.id, onUpdateField]
	);

	const handleRemoveClick = useCallback(() => {
		onRemove(candidate.id);
	}, [candidate.id, onRemove]);

	const hasPhoneWarning = candidate.warnings.some((w) => w.includes("phone"));
	const confidenceVariant =
		candidate.confidence >= 0.85
			? "default"
			: candidate.confidence >= 0.7
				? "secondary"
				: "destructive";

	return (
		<TableRow className={candidate.hasWarning ? "bg-amber-500/5" : undefined}>
			<TableCell>
				<Checkbox
					checked={candidate.included}
					onCheckedChange={handleIncludedChange}
				/>
			</TableCell>
			<TableCell>
				<Input
					className="h-8"
					onChange={handleNameChange}
					value={candidate.name}
				/>
			</TableCell>
			<TableCell>
				<div className="space-y-1">
					<Input
						className={`h-8 font-mono text-xs ${
							hasPhoneWarning
								? "border-destructive focus-visible:ring-destructive"
								: ""
						}`}
						onChange={handlePhoneChange}
						value={candidate.phone}
					/>
					{candidate.warnings.length > 0 && (
						<div className="flex items-center gap-1 text-amber-500 text-xs">
							<AlertTriangle className="h-3 w-3 shrink-0" />
							<span>{candidate.warnings[0]}</span>
						</div>
					)}
				</div>
			</TableCell>
			<TableCell>
				<Select onValueChange={handleChannelChange} value={candidate.channel}>
					<SelectTrigger className="h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="whatsapp">WhatsApp</SelectItem>
						<SelectItem value="sms">SMS</SelectItem>
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell>
				<Select onValueChange={handleTypeChange} value={candidate.type}>
					<SelectTrigger className="h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="new_contact">New Contact</SelectItem>
						<SelectItem value="returning">Returning</SelectItem>
						<SelectItem value="contact">Contact</SelectItem>
						<SelectItem value="prospect">Prospect</SelectItem>
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell>
				<Badge className="text-xs" variant={confidenceVariant}>
					{Math.round(candidate.confidence * 100)}%
				</Badge>
			</TableCell>
			<TableCell>
				<Button
					className="h-8 w-8 text-muted-foreground hover:text-destructive"
					onClick={handleRemoveClick}
					size="icon"
					type="button"
					variant="ghost"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
});

export function RosterReview({ jobId, onClose, onSuccess }: RosterReviewProps) {
	const queryClient = useQueryClient();
	const [selectedTagInput, setSelectedTagInput] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [strategy, setStrategy] = useState<
		"skip_duplicates" | "overwrite" | "tags_only"
	>("skip_duplicates");
	const [showImagePreview, setShowImagePreview] = useState(false);
	const [editedCandidates, setEditedCandidates] = useState<
		CandidateContact[] | null
	>(null);

	// 1. Fetch ParseJob details
	const { data, isLoading, error } = useQuery(
		orpc.upload.getParseJob.queryOptions({
			input: { jobId },
		})
	);

	// Initialize local candidates from server response
	const candidates = useMemo(() => {
		if (editedCandidates !== null) {
			return editedCandidates;
		}
		if (data?.candidates) {
			return data.candidates;
		}
		return [];
	}, [editedCandidates, data?.candidates]);

	// 2. Commit mutation
	const commitMutation = useMutation(
		orpc.upload.commitParsedJob.mutationOptions({
			onError: (err) => {
				toast.error(err.message || "Failed to commit contacts");
			},
			onSuccess: (res) => {
				toast.success(
					`Import complete: ${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} skipped.`
				);
				queryClient.invalidateQueries({ queryKey: ["contacts"] });
				queryClient.invalidateQueries({ queryKey: ["parsingByUserId"] });
				onSuccess?.(res);
				onClose?.();
			},
		})
	);

	// 3. Dismiss mutation
	const dismissMutation = useMutation(
		orpc.upload.dismissParseJob.mutationOptions({
			onError: (err) => {
				toast.error(err.message || "Failed to dismiss batch");
			},
			onSuccess: () => {
				toast.success("Roster sheet batch dismissed.");
				queryClient.invalidateQueries({ queryKey: ["parsingByUserId"] });
				onClose?.();
			},
		})
	);

	// Tag handlers
	const handleAddTag = useCallback(() => {
		const clean = selectedTagInput.trim();
		if (clean && !tags.includes(clean)) {
			setTags((prev) => [...prev, clean]);
			setSelectedTagInput("");
		}
	}, [selectedTagInput, tags]);

	const handleRemoveTag = useCallback((tagToRemove: string) => {
		setTags((prev) => prev.filter((t) => t !== tagToRemove));
	}, []);

	const handleTagInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setSelectedTagInput(e.target.value);
		},
		[]
	);

	const handleTagInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleAddTag();
			}
		},
		[handleAddTag]
	);

	// Candidate editing handlers
	const updateCandidateField = useCallback(
		(id: string, field: keyof CandidateContact, value: unknown) => {
			setEditedCandidates((prevList) => {
				const currentList = prevList ?? (data?.candidates || []);
				return currentList.map((c) => {
					if (c.id !== id) {
						return c;
					}
					const updated = { ...c, [field]: value };
					if (field === "phone") {
						const norm = normalizePhoneNumber(String(value));
						const warnings = [
							...c.warnings.filter((w) => !w.includes("phone")),
						];
						if (!norm.success) {
							warnings.push("Invalid phone format");
						}
						updated.warnings = warnings;
						updated.hasWarning = warnings.length > 0;
					}
					return updated;
				});
			});
		},
		[data?.candidates]
	);

	const toggleSelectAll = useCallback(
		(checked: boolean) => {
			setEditedCandidates((prevList) => {
				const currentList = prevList ?? (data?.candidates || []);
				return currentList.map((c) => ({ ...c, included: checked }));
			});
		},
		[data?.candidates]
	);

	const removeCandidate = useCallback(
		(id: string) => {
			setEditedCandidates((prevList) => {
				const currentList = prevList ?? (data?.candidates || []);
				return currentList.filter((c) => c.id !== id);
			});
		},
		[data?.candidates]
	);

	const handleStrategyChange = useCallback(
		(val: "skip_duplicates" | "overwrite" | "tags_only" | null) => {
			if (val) {
				setStrategy(val);
			}
		},
		[]
	);

	const handleSelectAllCheckedChange = useCallback(
		(checked: boolean | "indeterminate") => {
			toggleSelectAll(Boolean(checked));
		},
		[toggleSelectAll]
	);

	const handleOpenImagePreview = useCallback(() => {
		setShowImagePreview(true);
	}, []);

	const handleCloseImagePreview = useCallback(() => {
		setShowImagePreview(false);
	}, []);

	const handleDismissBatch = useCallback(() => {
		dismissMutation.mutate({ jobId });
	}, [dismissMutation, jobId]);

	const handleCommitBatch = useCallback(() => {
		commitMutation.mutate({
			contacts: candidates,
			jobId,
			strategy,
			tags,
		});
	}, [candidates, commitMutation, jobId, strategy, tags]);

	const includedCount = candidates.filter((c) => c.included).length;
	const warningCount = candidates.filter((c) => c.hasWarning).length;

	if (isLoading) {
		return (
			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
				<h3 className="font-semibold text-lg">Loading roster candidates</h3>
				<p className="text-muted-foreground text-sm">
					Fetching extracted contacts and image preview...
				</p>
			</Card>
		);
	}

	if (error || !data) {
		return (
			<Card className="p-8 text-center">
				<XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
				<h3 className="font-semibold text-lg">Failed to load parse job</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					{error?.message || "Job not found or inaccessible."}
				</p>
				{onClose ? (
					<Button onClick={onClose} variant="outline">
						Close
					</Button>
				) : null}
			</Card>
		);
	}

	const confidencePercent = Math.round(data.confidence * 100);
	const warningColorClass =
		warningCount > 0 ? "text-amber-500" : "text-emerald-500";

	return (
		<div className="flex flex-col gap-6">
			{/* Top summary card */}
			<Card>
				<CardHeader className="flex flex-row items-start justify-between pb-4">
					<div>
						<div className="flex items-center gap-2">
							<FileImage className="h-5 w-5 text-primary" />
							<CardTitle className="text-xl">
								Review Roster Sheet: {data.originalFilename || "Uploaded Image"}
							</CardTitle>
						</div>
						<CardDescription className="mt-1">
							Verify extracted names and phone numbers before committing to your
							contact directory.
						</CardDescription>
					</div>

					{data.imageUrl ? (
						<Button
							className="gap-2"
							onClick={handleOpenImagePreview}
							size="sm"
							variant="outline"
						>
							<Eye className="h-4 w-4" />
							Inspect Original Photo
						</Button>
					) : null}
				</CardHeader>

				<CardContent className="grid gap-4 sm:grid-cols-4">
					<div className="rounded-xl border bg-muted/30 p-3">
						<span className="text-muted-foreground text-xs uppercase">
							Total Candidates
						</span>
						<p className="font-semibold text-2xl">{candidates.length}</p>
					</div>
					<div className="rounded-xl border bg-muted/30 p-3">
						<span className="text-muted-foreground text-xs uppercase">
							Selected to Import
						</span>
						<p className="font-semibold text-2xl text-primary">
							{includedCount}
						</p>
					</div>
					<div className="rounded-xl border bg-muted/30 p-3">
						<span className="text-muted-foreground text-xs uppercase">
							Flags and Warnings
						</span>
						<p className={`font-semibold text-2xl ${warningColorClass}`}>
							{warningCount}
						</p>
					</div>
					<div className="rounded-xl border bg-muted/30 p-3">
						<span className="text-muted-foreground text-xs uppercase">
							Overall Confidence
						</span>
						<p className="font-semibold text-2xl">{confidencePercent}%</p>
					</div>
				</CardContent>
			</Card>

			{/* Import controls (Strategy & Tags) */}
			<Card>
				<CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="strategy-select">
							Duplicate Resolution Strategy
						</Label>
						<Select onValueChange={handleStrategyChange} value={strategy}>
							<SelectTrigger id="strategy-select">
								<SelectValue placeholder="Select strategy" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="skip_duplicates">
									Skip Duplicates (preserve existing contacts)
								</SelectItem>
								<SelectItem value="overwrite">
									Overwrite Existing (update name and details)
								</SelectItem>
								<SelectItem value="tags_only">
									Apply Tags Only (leave contact details untouched)
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Determines how to treat phone numbers already in your directory.
						</p>
					</div>

					<div className="space-y-2">
						<Label>Batch Tags</Label>
						<div className="flex gap-2">
							<Input
								onChange={handleTagInputChange}
								onKeyDown={handleTagInputKeyDown}
								placeholder="e.g. Sunday Service 2026-09-13"
								value={selectedTagInput}
							/>
							<Button
								onClick={handleAddTag}
								size="sm"
								type="button"
								variant="secondary"
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex flex-wrap gap-1 pt-1">
							{tags.map((t) => (
								<TagBadge key={t} onRemove={handleRemoveTag} tag={t} />
							))}
							{tags.length === 0 && (
								<span className="text-muted-foreground text-xs">
									No tags added yet.
								</span>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Candidates Table */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<div className="flex items-center gap-3">
						<Checkbox
							checked={
								includedCount === candidates.length && candidates.length > 0
							}
							id="select-all"
							onCheckedChange={handleSelectAllCheckedChange}
						/>
						<Label
							className="cursor-pointer font-medium text-sm"
							htmlFor="select-all"
						>
							Select All ({includedCount} of {candidates.length} selected)
						</Label>
					</div>
				</CardHeader>

				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12" />
								<TableHead className="min-w-[180px]">Name</TableHead>
								<TableHead className="min-w-[180px]">Phone Number</TableHead>
								<TableHead className="min-w-[120px]">Channel</TableHead>
								<TableHead className="min-w-[120px]">Category</TableHead>
								<TableHead className="w-[100px]">Confidence</TableHead>
								<TableHead className="w-12" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{candidates.map((c) => (
								<CandidateRow
									candidate={c}
									key={c.id}
									onRemove={removeCandidate}
									onUpdateField={updateCandidateField}
								/>
							))}
						</TableBody>
					</Table>
				</div>

				<CardFooter className="flex items-center justify-between border-t p-4">
					<Button
						disabled={dismissMutation.isPending || commitMutation.isPending}
						onClick={handleDismissBatch}
						variant="ghost"
					>
						{dismissMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
						)}
						Dismiss Batch
					</Button>

					<div className="flex items-center gap-3">
						{onClose ? (
							<Button onClick={onClose} variant="outline">
								Cancel
							</Button>
						) : null}
						<Button
							disabled={
								includedCount === 0 ||
								commitMutation.isPending ||
								dismissMutation.isPending
							}
							onClick={handleCommitBatch}
						>
							{commitMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Check className="mr-2 h-4 w-4" />
							)}
							Commit {includedCount} Contacts to Directory
						</Button>
					</div>
				</CardFooter>
			</Card>

			{/* Modal image inspector */}
			{data.imageUrl ? (
				<Dialog onOpenChange={setShowImagePreview} open={showImagePreview}>
					<DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-4xl">
						<DialogHeader>
							<DialogTitle>Original Roster Sheet Photograph</DialogTitle>
							<DialogDescription>
								Use this high resolution reference to inspect handwriting or
								correct uncertain numbers.
							</DialogDescription>
						</DialogHeader>
						<div className="flex items-center justify-center overflow-hidden rounded-xl border bg-black/5 p-2">
							<img
								alt="Roster sheet"
								className="max-h-[70vh] rounded-lg object-contain shadow-sm"
								height={800}
								src={data.imageUrl}
								width={1200}
							/>
						</div>
						<DialogFooter>
							<Button onClick={handleCloseImagePreview}>Close Preview</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	);
}
