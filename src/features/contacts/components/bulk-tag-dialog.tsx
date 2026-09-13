"use client";

import { Loader2, Plus, Tag, X } from "lucide-react";
import { useState } from "react";
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
import { useBatchTagContacts, useTags } from "../hooks/use-contacts";

interface BulkTagDialogProps {
	contactIds: string[];
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
	open: boolean;
}

export function BulkTagDialog({
	contactIds,
	open,
	onOpenChange,
	onSuccess,
}: BulkTagDialogProps) {
	const [tagInput, setTagInput] = useState("");
	const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
	const [tagsToRemove, setTagsToRemove] = useState<string[]>([]);

	const { data: tagData } = useTags();
	const availableTags = tagData?.tags ?? [];

	const batchMutation = useBatchTagContacts();

	function handleAddTag(tag: string) {
		const clean = tag.trim().toLowerCase();
		if (!clean || tagsToAdd.includes(clean)) {
			return;
		}
		setTagsToAdd((prev) => [...prev, clean]);
		setTagInput("");
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			handleAddTag(tagInput);
		}
	}

	function toggleRemoveTag(tag: string) {
		const clean = tag.trim().toLowerCase();
		if (tagsToRemove.includes(clean)) {
			setTagsToRemove((prev) => prev.filter((t) => t !== clean));
		} else {
			setTagsToRemove((prev) => [...prev, clean]);
		}
	}

	function handleSave() {
		if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
			toast.error("Please specify at least one tag to add or remove");
			return;
		}

		batchMutation.mutate(
			{
				addTags: tagsToAdd,
				contactIds,
				removeTags: tagsToRemove,
			},
			{
				onError: (err) => {
					toast.error("Failed to update tags", {
						description: err instanceof Error ? err.message : "Unknown error",
					});
				},
				onSuccess: (res) => {
					toast.success(`Updated tags for ${res.updatedCount} contacts`);
					setTagsToAdd([]);
					setTagsToRemove([]);
					setTagInput("");
					onOpenChange(false);
					onSuccess?.();
				},
			}
		);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Tag className="h-5 w-5 text-primary" />
						Manage Tags for {contactIds.length} Contact
						{contactIds.length === 1 ? "" : "s"}
					</DialogTitle>
					<DialogDescription>
						Add new tags or remove existing tags across your selected contacts.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Add Tags Section */}
					<div className="space-y-2">
						<Label className="text-xs">Add Tags</Label>
						<div className="flex gap-2">
							<Input
								className="h-9 rounded-xl"
								onChange={(e) => setTagInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Type a tag and press Enter or comma…"
								value={tagInput}
							/>
							<Button
								className="h-9 shrink-0 gap-1 rounded-xl px-3"
								disabled={!tagInput.trim()}
								onClick={() => handleAddTag(tagInput)}
								size="sm"
								type="button"
							>
								<Plus className="h-4 w-4" />
								Add
							</Button>
						</div>

						{/* Tags to add pill list */}
						{tagsToAdd.length > 0 && (
							<div className="flex flex-wrap gap-1.5 pt-1">
								{tagsToAdd.map((tag) => (
									<Badge
										className="gap-1 bg-primary/10 text-primary hover:bg-primary/20"
										key={tag}
										variant="secondary"
									>
										{tag}
										<button
											className="rounded-full p-0.5 hover:bg-primary/20"
											onClick={() =>
												setTagsToAdd((prev) => prev.filter((t) => t !== tag))
											}
											type="button"
										>
											<X className="h-3 w-3" />
										</button>
									</Badge>
								))}
							</div>
						)}

						{/* Quick tag suggestions */}
						{availableTags.length > 0 && (
							<div className="pt-1">
								<p className="mb-1 text-muted-foreground text-xs">
									Existing tags:
								</p>
								<div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
									{availableTags.slice(0, 10).map(({ tag, count }) => (
										<button
											className="rounded-md border bg-muted/30 px-2 py-0.5 text-muted-foreground text-xs hover:border-primary/50 hover:text-foreground"
											key={tag}
											onClick={() => handleAddTag(tag)}
											type="button"
										>
											+{tag} ({count})
										</button>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Remove Tags Section */}
					{availableTags.length > 0 && (
						<div className="space-y-2 border-t pt-3">
							<Label className="text-xs">Remove Tags from Selected</Label>
							<p className="text-muted-foreground text-xs">
								Click any tag below to remove it from all selected contacts:
							</p>
							<div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
								{availableTags.map(({ tag }) => {
									const isSelectedToRemove = tagsToRemove.includes(
										tag.toLowerCase()
									);
									return (
										<button
											className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
												isSelectedToRemove
													? "border-red-500/50 bg-red-500/10 text-red-500"
													: "bg-muted/30 text-muted-foreground hover:bg-muted"
											}`}
											key={tag}
											onClick={() => toggleRemoveTag(tag)}
											type="button"
										>
											{isSelectedToRemove ? "✕ " : ""}
											{tag}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						disabled={
							batchMutation.isPending ||
							(tagsToAdd.length === 0 && tagsToRemove.length === 0)
						}
						onClick={handleSave}
					>
						{batchMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Apply Tags
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
