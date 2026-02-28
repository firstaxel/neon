"use client";

import {
	FileImage,
	Mail,
	MessageCircle,
	Phone,
	StickyNote,
	User,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { useContact } from "../hooks/use-contacts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactDialogProps {
	contactId: string | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

const TYPE_LABELS: Record<string, string> = {
	first_timer: "First Timer",
	returning: "Returning",
	member: "Member",
	visitor: "Visitor",
};

const CHANNEL_STYLE: Record<string, string> = {
	whatsapp: "border-[#25d36640] bg-[#0d2016] text-[#25d366]",
	sms: "border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa]",
};

// ─── Detail row ───────────────────────────────────────────────────────────────

function Row({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
				{icon}
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-muted-foreground text-xs">{label}</p>
				<div className="wrap-break-word mt-0.5 font-medium text-sm">
					{value}
				</div>
			</div>
		</div>
	);
}

// ─── ContactDialog ────────────────────────────────────────────────────────────

export function ContactDialog({
	contactId,
	open,
	onOpenChange,
}: ContactDialogProps) {
	const { data: contact, isLoading } = useContact(contactId);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Contact Details</DialogTitle>
				</DialogHeader>

				{isLoading || !contact ? (
					<div className="space-y-4 pt-2">
						{[...new Array(5)].map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
							<div className="flex items-center gap-3" key={i}>
								<Skeleton className="h-8 w-8 rounded-lg" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-3 w-16" />
									<Skeleton className="h-4 w-40" />
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="space-y-4 pt-2">
						{/* Avatar + name */}
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-lg">
								{contact.name.charAt(0).toUpperCase()}
							</div>
							<div className="min-w-0">
								<p className="truncate font-semibold text-lg leading-tight">
									{contact.name}
								</p>
								<div className="mt-1 flex flex-wrap items-center gap-2">
									<span
										className={`rounded-md border px-2 py-0.5 font-bold text-[10px] uppercase tracking-wide ${CHANNEL_STYLE[contact.channel]}`}
									>
										{contact.channel === "whatsapp" ? "WhatsApp" : "SMS"}
									</span>
									<Badge className="font-normal text-xs" variant="secondary">
										{TYPE_LABELS[contact.type] ?? contact.type}
									</Badge>
								</div>
							</div>
						</div>

						<Separator />

						<div className="space-y-3">
							<Row
								icon={<Phone className="h-4 w-4" />}
								label="Phone"
								value={contact.phone}
							/>
							{contact.email && (
								<Row
									icon={<Mail className="h-4 w-4" />}
									label="Email"
									value={contact.email}
								/>
							)}
							<Row
								icon={<MessageCircle className="h-4 w-4" />}
								label="Channel"
								value={<span className="capitalize">{contact.channel}</span>}
							/>
							<Row
								icon={<User className="h-4 w-4" />}
								label="Contact type"
								value={TYPE_LABELS[contact.type] ?? contact.type}
							/>
							{contact.notes && (
								<Row
									icon={<StickyNote className="h-4 w-4" />}
									label="Notes"
									value={contact.notes}
								/>
							)}
						</div>

						<Separator />

						{/* Source parse job */}
						<div className="space-y-1.5 rounded-xl border bg-muted/30 px-3 py-3">
							<div className="flex items-center gap-1.5">
								<FileImage className="h-3.5 w-3.5 text-muted-foreground" />
								<span className="font-medium text-muted-foreground text-xs">
									Source file
								</span>
							</div>
							<p className="truncate font-medium text-sm">
								{contact.sourceFilename ?? "Unknown file"}
							</p>
							<div className="flex items-center gap-3 text-muted-foreground text-xs">
								{contact.sourceConfidence != null && (
									<span>
										{Math.round(contact.sourceConfidence * 100)}% AI confidence
									</span>
								)}
								<span>
									{new Date(contact.sourceCreatedAt).toLocaleDateString(
										"en-GB",
										{
											day: "numeric",
											month: "short",
											year: "numeric",
										}
									)}
								</span>
							</div>
						</div>

						{contact.rawRow && (
							<div className="rounded-xl border bg-muted/20 px-3 py-2.5">
								<p className="mb-1.5 font-medium text-muted-foreground text-xs">
									Raw extracted text
								</p>
								<p className="break-all font-mono text-foreground/60 text-xs leading-relaxed">
									{contact.rawRow}
								</p>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
