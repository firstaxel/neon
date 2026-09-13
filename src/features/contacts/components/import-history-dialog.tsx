"use client";

import {
	AlertTriangle,
	Calendar,
	CheckCircle,
	Clock,
	FileSpreadsheet,
	History,
	Loader2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { useImports } from "../hooks/use-contacts";

interface ImportHistoryDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function ImportHistoryDialog({
	open,
	onOpenChange,
}: ImportHistoryDialogProps) {
	const [page, setPage] = useState(1);
	const { data, isLoading } = useImports(page, 10);

	const imports = data?.imports ?? [];
	const pagination = data?.pagination;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="h-5 w-5 text-primary" />
						CSV Import History
					</DialogTitle>
					<DialogDescription>
						Audit records of previous spreadsheet uploads and row counts.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{isLoading ? (
						<div className="flex h-48 items-center justify-center">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : imports.length === 0 ? (
						<div className="flex h-48 flex-col items-center justify-center text-center">
							<FileSpreadsheet className="mb-2 h-8 w-8 text-muted-foreground" />
							<p className="font-medium text-sm">No CSV imports recorded yet</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Spreadsheets you import will appear here with error logs and row
								counts.
							</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-xl border">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/40">
										<TableHead>File</TableHead>
										<TableHead>Date</TableHead>
										<TableHead>Strategy</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Results</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{/* biome-ignore lint/suspicious/noExplicitAny: record mapping */}
									{imports.map((imp: any) => {
										const formattedDate = new Date(
											imp.createdAt
										).toLocaleDateString(undefined, {
											day: "numeric",
											month: "short",
											year: "numeric",
										});

										return (
											<TableRow key={imp.id}>
												<TableCell>
													<div className="flex items-center gap-2">
														<FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
														<span className="font-medium text-sm">
															{imp.filename}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-muted-foreground text-xs">
													<span className="flex items-center gap-1">
														<Calendar className="h-3 w-3" />
														{formattedDate}
													</span>
												</TableCell>
												<TableCell>
													<Badge
														className="text-xs capitalize"
														variant="outline"
													>
														{imp.strategy.replace("_", " ")}
													</Badge>
												</TableCell>
												<TableCell>
													{imp.status === "completed" ? (
														<span className="flex items-center gap-1 font-medium text-emerald-600 text-xs dark:text-emerald-400">
															<CheckCircle className="h-3.5 w-3.5" />
															Done
														</span>
													) : imp.status === "failed" ? (
														<span className="flex items-center gap-1 font-medium text-red-500 text-xs">
															<AlertTriangle className="h-3.5 w-3.5" />
															Failed
														</span>
													) : (
														<span className="flex items-center gap-1 text-amber-500 text-xs">
															<Clock className="h-3.5 w-3.5" />
															In progress
														</span>
													)}
												</TableCell>
												<TableCell className="text-right text-xs">
													<div className="space-x-1 tabular-nums">
														<span className="text-emerald-600 dark:text-emerald-400">
															+{imp.createdCount}
														</span>
														<span className="text-muted-foreground">/</span>
														<span className="text-blue-600 dark:text-blue-400">
															~{imp.updatedCount}
														</span>
														<span className="text-muted-foreground">/</span>
														<span className="text-amber-600 dark:text-amber-400">
															{imp.skippedCount} skipped
														</span>
														{imp.errorCount > 0 && (
															<span className="font-medium text-red-500">
																{" "}
																({imp.errorCount} err)
															</span>
														)}
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}

					{pagination && pagination.totalPages > 1 && (
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">
								Page {pagination.page} of {pagination.totalPages}
							</span>
							<div className="flex gap-1.5">
								<Button
									disabled={page <= 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									size="sm"
									variant="outline"
								>
									Previous
								</Button>
								<Button
									disabled={page >= pagination.totalPages}
									onClick={() => setPage((p) => p + 1)}
									size="sm"
									variant="outline"
								>
									Next
								</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
