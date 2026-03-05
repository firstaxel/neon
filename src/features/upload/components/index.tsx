import {
	CircleAlertIcon,
	FileArchiveIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	HeadphonesIcon,
	ImageIcon,
	RefreshCwIcon,
	UploadIcon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import {
	type FileMetadata,
	type FileWithPreview,
	formatBytes,
	useFileUpload,
} from "#/hooks/use-file-upload";
import { cn } from "#/lib/utils";
import {
	type UploadFile,
	type UploadStatus,
	useRealUpload,
} from "../hooks/use-real-upload";

interface FileUploadItem extends FileWithPreview {
	error?: string;
	progress: number;
	status: UploadStatus;
}
interface ProgressUploadProps {
	accept?: string;
	className?: string;
	maxFiles?: number;
	maxSize?: number;
	multiple?: boolean;
	onUploadComplete?: (fileId: string, jobId: string) => void;
}
export function Uploader({
	maxFiles = 5,
	maxSize = 10 * 1024 * 1024, // 10MB
	accept = "*",
	multiple = true,
	className,
	onUploadComplete,
}: ProgressUploadProps) {
	// Create default images using FileMetadata type
	const defaultImages: FileMetadata[] = [];
	// Convert default images to FileUploadItem format
	const defaultUploadFiles: UploadFile[] = defaultImages.map((image) => ({
		id: image.id,
		file: {
			name: image.name,
			size: image.size,
			type: image.type,
		} as File,
		preview: image.url,
		progress: 100,
		status: "completed" as const,
	}));
	const [uploadFiles, setUploadFiles] =
		useState<UploadFile[]>(defaultUploadFiles);

	const uploadFilesRef = useRef<UploadFile[]>([]);
	uploadFilesRef.current = uploadFiles;
	const [
		{ isDragging, errors },
		{
			removeFile,
			clearFiles,
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			openFileDialog,
			getInputProps,
		},
	] = useFileUpload({
		maxFiles,
		maxSize,
		accept,
		multiple,
		initialFiles: defaultImages,
		onFilesChange: (newFiles) => {
			// Convert to upload items when files change, preserving existing status
			const newUploadFiles = newFiles.map((file) => {
				// Check if this file already exists in uploadFiles
				const existingFile = uploadFiles.find(
					(existing) => existing.id === file.id
				);
				if (existingFile) {
					// Preserve existing file status and progress
					return {
						...existingFile,
						...file, // Update any changed properties from the file
					} as UploadFile;
				}
				// New file - set to uploading
				return {
					...file,
					progress: 0,
					status: "uploading" as const,
				} as UploadFile;
			});

			setUploadFiles(newUploadFiles);

			for (const uploadFile of newUploadFiles) {
				const wasAlreadyPresent = uploadFilesRef.current.some(
					(e) => e.id === uploadFile.id
				);

				if (
					!wasAlreadyPresent &&
					uploadFile.status === "uploading" &&
					uploadFile.file instanceof File
				) {
					startUpload({
						file: uploadFile.file,
						id: uploadFile.id,
						progress: uploadFile.progress,
						status: uploadFile.status,
						contacts: uploadFile.contacts,
						error: uploadFile.error,
						jobId: uploadFile.jobId,
						parseProgress: uploadFile.parseProgress,
					});
				}
			}
		},
	});

	const { startUpload, retryUpload, cleanup } = useRealUpload(setUploadFiles, {
		onUploadComplete(fileId, jobId) {
			onUploadComplete?.(fileId, jobId);
		},
	});
	useEffect(() => () => cleanup(), [cleanup]);

	const removeUploadFile = (fileId: string) => {
		setUploadFiles((prev) => prev.filter((file) => file.id !== fileId));
		removeFile(fileId);
	};
	const getFileIcon = (file: File | FileMetadata) => {
		const type = file instanceof File ? file.type : file.type;
		if (type.startsWith("image/")) {
			return <ImageIcon className="size-4" />;
		}
		if (type.startsWith("video/")) {
			return <VideoIcon className="size-4" />;
		}
		if (type.startsWith("audio/")) {
			return <HeadphonesIcon className="size-4" />;
		}
		if (type.includes("pdf")) {
			return <FileTextIcon className="size-4" />;
		}
		if (type.includes("word") || type.includes("doc")) {
			return <FileTextIcon className="size-4" />;
		}
		if (type.includes("excel") || type.includes("sheet")) {
			return <FileSpreadsheetIcon className="size-4" />;
		}
		if (type.includes("zip") || type.includes("rar")) {
			return <FileArchiveIcon className="size-4" />;
		}
		return <FileTextIcon className="size-4" />;
	};
	const completedCount = uploadFiles.filter(
		(f) => f.status === "completed"
	).length;
	const errorCount = uploadFiles.filter((f) => f.status === "error").length;
	const uploadingCount = uploadFiles.filter(
		(f) => f.status === "uploading"
	).length;
	return (
		<div className={cn("w-full max-w-2xl", className)}>
			{/* Upload Area */}

			<div
				className={cn(
					"relative rounded-lg border border-dashed p-8 text-center transition-colors",
					isDragging
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 hover:border-muted-foreground/50"
				)}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<input {...getInputProps()} className="sr-only" />
				<div className="flex flex-col items-center gap-4">
					<div
						className={cn(
							"flex h-16 w-16 items-center justify-center rounded-full",
							isDragging ? "bg-primary/10" : "bg-muted"
						)}
					>
						<UploadIcon
							className={cn(
								"h-6",
								isDragging ? "text-primary" : "text-muted-foreground"
							)}
						/>
					</div>
					<div className="space-y-2">
						<h3 className="font-semibold text-lg">Upload your files</h3>
						<p className="text-muted-foreground text-sm">
							Drag and drop files here or click to browse
						</p>
						<p className="text-muted-foreground text-xs">
							Support for multiple file types up to {formatBytes(maxSize)} each
						</p>
					</div>
					<Button onClick={openFileDialog}>
						<UploadIcon className="h-4 w-4" />
						Select files
					</Button>
				</div>
			</div>
			{/* Upload Stats */}
			{uploadFiles.length > 0 && (
				<div className="mt-6 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h4 className="font-medium text-sm">Upload Progress</h4>
						<div className="flex items-center gap-2">
							{completedCount > 0 && (
								<Badge variant="default">Completed: {completedCount}</Badge>
							)}
							{errorCount > 0 && (
								<Badge variant="destructive">Failed: {errorCount}</Badge>
							)}
							{uploadingCount > 0 && (
								<Badge variant="secondary">Uploading: {uploadingCount}</Badge>
							)}
						</div>
					</div>
					<Button onClick={clearFiles} size="sm" variant="outline">
						Clear all
					</Button>
				</div>
			)}
			{/* File List */}
			{uploadFiles.length > 0 && (
				<div className="mt-4 space-y-3">
					{uploadFiles.map((fileItem: FileUploadItem) => (
						<div
							className="rounded-lg border border-border bg-card p-2.5"
							key={fileItem.id}
						>
							<div className="flex items-start gap-2.5">
								{/* File Icon */}
								<div className="shrink-0">
									{fileItem.preview &&
									fileItem.file.type.startsWith("image/") ? (
										<img
											alt={fileItem.file.name}
											className="h-12 w-12 rounded-lg border object-cover"
											height={48}
											src={fileItem.preview}
											width={48}
										/>
									) : (
										<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border text-muted-foreground">
											{getFileIcon(fileItem.file)}
										</div>
									)}
								</div>
								{/* File Info */}
								<div className="min-w-0 flex-1">
									<div className="mt-0.75 flex items-center justify-between">
										<p className="inline-flex flex-col justify-center gap-1 truncate font-medium">
											<span className="text-sm">{fileItem.file.name}</span>
											<span className="text-muted-foreground text-xs">
												{formatBytes(fileItem.file.size)}
											</span>
										</p>
										<div className="flex items-center gap-2">
											{/* Remove Button */}
											<Button
												className="size-6 text-muted-foreground hover:bg-transparent hover:opacity-100"
												onClick={() => removeUploadFile(fileItem.id)}
												size="icon"
												variant="ghost"
											>
												<XIcon className="size-4" />
											</Button>
										</div>
									</div>
									{/* Progress Bar */}
									{fileItem.status === "uploading" && (
										<div className="mt-2">
											<Progress className="h-1" value={fileItem.progress} />
										</div>
									)}
									{/* Error Message */}
									{fileItem.status === "error" && fileItem.error && (
										<Alert className="mt-2 px-2 py-2" variant="destructive">
											<CircleAlertIcon className="size-4" />
											<AlertTitle className="text-xs">
												{fileItem.error}
											</AlertTitle>
											<AlertAction>
												<Button
													className="size-4 text-muted-foreground hover:bg-transparent hover:opacity-100"
													onClick={() =>
														retryUpload(fileItem.id, fileItem.file as File)
													}
													size="icon"
													variant="ghost"
												>
													<RefreshCwIcon className="size-3.5" />
												</Button>
											</AlertAction>
										</Alert>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
			{/* Error Messages */}
			{errors.length > 0 && (
				<Alert className="mt-5" variant="destructive">
					<CircleAlertIcon />
					<AlertTitle>File upload error(s)</AlertTitle>
					<AlertDescription>
						{errors.map((error) => (
							<p className="last:mb-0" key={error}>
								{error}
							</p>
						))}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
