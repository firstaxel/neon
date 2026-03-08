import { useForm } from "@tanstack/react-form";
import {
	Mail,
	MessageCircle,
	Phone,
	StickyNote,
	User,
	UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import { Textarea } from "#/components/ui/textarea";
import { useCreateContact } from "../hooks/use-contacts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddContactDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

interface FormValues {
	channel: "whatsapp" | "sms";
	email: string;
	name: string;
	notes: string;
	phone: string;
	type: "first_timer" | "returning" | "member" | "visitor";
}

const CHANNEL_OPTIONS = [
	{ value: "whatsapp" as const, label: "WhatsApp" },
	{ value: "sms" as const, label: "SMS" },
];

const TYPE_OPTIONS = [
	{ value: "first_timer" as const, label: "First Timer" },
	{ value: "returning" as const, label: "Returning" },
	{ value: "member" as const, label: "Member" },
	{ value: "visitor" as const, label: "Visitor" },
];

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
	icon,
	label,
	required,
	children,
	error,
}: {
	icon: React.ReactNode;
	label: string;
	required?: boolean;
	children: React.ReactNode;
	error?: string;
}) {
	return (
		<div className="space-y-1.5">
			<Label className="flex items-center gap-1.5 font-medium text-sm">
				<span className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground">
					{icon}
				</span>
				{label}
				{required && <span className="text-destructive">*</span>}
			</Label>
			{children}
			{error && <p className="text-destructive text-xs">{error}</p>}
		</div>
	);
}

// ─── AddContactDialog ─────────────────────────────────────────────────────────

export function AddContactDialog({
	open,
	onOpenChange,
}: AddContactDialogProps) {
	const { mutateAsync: createContact, isPending } = useCreateContact();

	const form = useForm({
		defaultValues: {
			name: "",
			phone: "",
			channel: "whatsapp",
			type: "first_timer",
			email: "",
			notes: "",
		} as FormValues,
		onSubmit: async ({ value }) => {
			try {
				await createContact({
					name: value.name.trim(),
					phone: value.phone.trim(),
					channel: value.channel,
					type: value.type,
					email: value.email.trim() || null,
					notes: value.notes.trim() || null,
				});
				toast.success(`${value.name} added to contacts`);
				onOpenChange(false);
				form.reset();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to add contact"
				);
			}
		},
	});

	function handleOpenChange(v: boolean) {
		if (!v) {
			form.reset();
		}
		onOpenChange(v);
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<UserPlus className="h-4 w-4 text-primary" />
						Add Contact
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-1">
					{/* Name */}
					<form.Field name="name">
						{(field) => (
							<Field
								error={
									field.state.meta.isTouched && !field.state.value.trim()
										? "Name is required"
										: undefined
								}
								icon={<User className="h-3.5 w-3.5" />}
								label="Full name"
								required
							>
								<Input
									className="rounded-xl"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="e.g. Amara Osei"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>

					{/* Phone + Channel (side by side) */}
					<div className="grid grid-cols-[1fr_auto] gap-3">
						<form.Field name="phone">
							{(field) => (
								<Field
									error={
										field.state.meta.isTouched && !field.state.value.trim()
											? "Phone is required"
											: undefined
									}
									icon={<Phone className="h-3.5 w-3.5" />}
									label="Phone number"
									required
								>
									<Input
										className="rounded-xl"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="+2348012345678"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>

						<form.Field name="channel">
							{(field) => (
								<Field
									icon={<MessageCircle className="h-3.5 w-3.5" />}
									label="Channel"
									required
								>
									<Select
										onValueChange={(v) =>
											field.handleChange(v as "whatsapp" | "sms")
										}
										value={field.state.value}
									>
										<SelectTrigger className="w-[110px] rounded-xl">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CHANNEL_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							)}
						</form.Field>
					</div>

					{/* Contact type */}
					<form.Field name="type">
						{(field) => (
							<Field
								icon={<User className="h-3.5 w-3.5" />}
								label="Contact type"
								required
							>
								<Select
									onValueChange={(v) =>
										field.handleChange(
											v as "first_timer" | "returning" | "member" | "visitor"
										)
									}
									value={field.state.value}
								>
									<SelectTrigger className="rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TYPE_OPTIONS.map((o) => (
											<SelectItem key={o.value} value={o.value}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>

					{/* Email (optional) */}
					<form.Field name="email">
						{(field) => (
							<Field
								icon={<Mail className="h-3.5 w-3.5" />}
								label="Email address"
							>
								<Input
									className="rounded-xl"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="optional"
									type="email"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>

					{/* Notes (optional) */}
					<form.Field name="notes">
						{(field) => (
							<Field
								icon={<StickyNote className="h-3.5 w-3.5" />}
								label="Notes"
							>
								<Textarea
									className="min-h-16 resize-none rounded-xl text-sm"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="optional"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
				</div>

				<DialogFooter>
					<Button
						className="rounded-xl"
						disabled={isPending}
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className="gap-2 rounded-xl"
						disabled={isPending}
						onClick={() => form.handleSubmit()}
					>
						{isPending ? (
							"Saving…"
						) : (
							<>
								<UserPlus className="h-4 w-4" /> Add Contact
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
