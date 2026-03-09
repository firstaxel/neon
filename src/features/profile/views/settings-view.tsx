/**
 * src/features/profile/views/settings-view.tsx
 *
 * Full settings page. Sections:
 *   1. Profile       — name, phone
 *   2. Organisation  — orgName, orgType, orgSize, role
 *   3. SMS Sender ID — view status, submit new, delete pending
 *   4. Security      — change password (email accounts only), sign out
 *   5. Danger zone   — (placeholder for future account deletion)
 */

import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	Building2,
	CheckCircle2,
	ChevronRight,
	Clock,
	Eye,
	EyeOff,
	Loader2,
	LogOut,
	Plus,
	RefreshCw,
	Shield,
	Smartphone,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { authClient } from "#/lib/auth-client";
import {
	getOrgSizeLabel,
	getRoleMeta,
	ORG_TYPE_LABELS,
	type OrgType,
	type UserRole,
} from "#/features/miscellaneous/org";
import {
	useDeleteAccount,
	useDeleteSenderNumber,
	useProfile,
	useReseedTemplates,
	useSenderNumbers,
	useSubmitSenderId,
	useUpdatePassword,
	useUpdateProfile,
} from "../hooks/use-profile";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type OrgSize = "1-50" | "51-200" | "201-500" | "500+";

function SectionHeader({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
}) {
	return (
		<CardHeader className="pb-3">
			<div className="flex items-center gap-2.5">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
					<Icon className="h-4 w-4 text-primary" />
				</div>
				<div>
					<CardTitle className="text-base">{title}</CardTitle>
					<CardDescription className="text-xs">{description}</CardDescription>
				</div>
			</div>
		</CardHeader>
	);
}

function SaveRow({
	isPending,
	dirty,
}: {
	isPending: boolean;
	dirty: boolean;
}) {
	return (
		<div className="flex justify-end pt-2">
			<Button
				className="gap-1.5 rounded-xl"
				disabled={!dirty || isPending}
				size="sm"
				type="submit"
			>
				{isPending ? (
					<>
						<Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
					</>
				) : (
					"Save changes"
				)}
			</Button>
		</div>
	);
}

// ─── Section 1: Profile ───────────────────────────────────────────────────────

function ProfileSection() {
	const { data: profile, isLoading } = useProfile();
	const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

	const form = useForm({
		defaultValues: {
			name: profile?.name ?? "",
			phone: profile?.phone ?? "",
		},
		onSubmit: async ({ value }) => {
			try {
				await updateProfile({
					name: value.name.trim() || undefined,
					phone: value.phone.trim() || undefined,
				});
				toast.success("Profile updated");
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Failed to update profile");
			}
		},
	});

	// Re-sync defaults when profile loads
	if (profile && form.state.values.name === "" && profile.name) {
		form.setFieldValue("name", profile.name ?? "");
		form.setFieldValue("phone", profile.phone ?? "");
	}

	if (isLoading) return null;

	return (
		<Card className="rounded-2xl">
			<SectionHeader
				description="Your personal display name and contact number"
				icon={User}
				title="Profile"
			/>
			<Separator />
			<CardContent className="pt-5">
				{/* Read-only email */}
				<div className="mb-4 space-y-1.5">
					<Label className="text-muted-foreground text-xs">Email address</Label>
					<div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
						<span className="flex-1 text-muted-foreground text-sm">{profile?.email}</span>
						<Badge className="text-[10px]" variant="secondary">
							Read-only
						</Badge>
					</div>
				</div>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Subscribe selector={(s) => s.values}>
						{(values) => (
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label className="text-xs">Full name</Label>
										<Input
											className="rounded-xl"
											onChange={(e) => form.setFieldValue("name", e.target.value)}
											placeholder="Your full name"
											value={values.name}
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs">Phone number</Label>
										<Input
											className="rounded-xl"
											onChange={(e) => form.setFieldValue("phone", e.target.value)}
											placeholder="+234 800 000 0000"
											type="tel"
											value={values.phone}
										/>
									</div>
								</div>
								<SaveRow
									dirty={
										values.name !== (profile?.name ?? "") ||
										values.phone !== (profile?.phone ?? "")
									}
									isPending={isPending}
								/>
							</div>
						)}
					</form.Subscribe>
				</form>
			</CardContent>
		</Card>
	);
}

// ─── Section 2: Organisation ──────────────────────────────────────────────────

function OrgTile<T extends string>({
	value,
	current,
	onClick,
	icon,
	label,
	sub,
}: {
	value: T;
	current: T;
	onClick: (v: T) => void;
	icon: string;
	label: string;
	sub?: string;
}) {
	const active = value === current;
	return (
		<button
			className={[
				"flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition-all",
				active
					? "border-primary bg-primary/5 ring-2 ring-primary/20"
					: "border-border hover:border-muted-foreground/40",
			].join(" ")}
			onClick={() => onClick(value)}
			type="button"
		>
			<span className="shrink-0 text-base leading-none">{icon}</span>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-xs leading-tight">{label}</p>
				{sub && <p className="truncate text-muted-foreground text-[10px]">{sub}</p>}
			</div>
			{active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
		</button>
	);
}

function OrganisationSection() {
	const { data: profile, isLoading } = useProfile();
	const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
	const { mutateAsync: reseedTemplates, isPending: reseeding } = useReseedTemplates();

	const form = useForm({
		defaultValues: {
			orgName: profile?.orgName ?? "",
			orgType: (profile?.orgType ?? "church") as OrgType,
			orgSize: (profile?.orgSize ?? "1-50") as OrgSize,
			role: (profile?.role ?? "staff") as UserRole,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateProfile({
					orgName: value.orgName.trim() || undefined,
					orgType: value.orgType,
					orgSize: value.orgSize,
					role: value.role,
				});
				toast.success("Organisation updated");
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Failed to update");
			}
		},
	});

	if (profile && form.state.values.orgName === "" && profile.orgName) {
		form.setFieldValue("orgName", profile.orgName ?? "");
		form.setFieldValue("orgType", (profile.orgType ?? "church") as OrgType);
		form.setFieldValue("orgSize", (profile.orgSize ?? "1-50") as OrgSize);
		form.setFieldValue("role", (profile.role ?? "staff") as UserRole);
	}

	if (isLoading) return null;

	const orgTypes = Object.entries(ORG_TYPE_LABELS) as [OrgType, (typeof ORG_TYPE_LABELS)[OrgType]][];

	return (
		<Card className="rounded-2xl">
			<SectionHeader
				description="Organisation details used to personalise your messages"
				icon={Building2}
				title="Organisation"
			/>
			<Separator />
			<CardContent className="pt-5">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Subscribe selector={(s) => s.values}>
						{(values) => {
							const roleMeta = getRoleMeta(values.orgType);
							const sizeMeta = getOrgSizeLabel(values.orgType);
							const roleKeys = Object.keys(roleMeta) as UserRole[];

							const dirty =
								values.orgName !== (profile?.orgName ?? "") ||
								values.orgType !== (profile?.orgType ?? "church") ||
								values.orgSize !== (profile?.orgSize ?? "1-50") ||
								values.role !== (profile?.role ?? "staff");

							return (
								<div className="space-y-5">
									{/* Org name */}
									<div className="space-y-1.5">
										<Label className="text-xs">Organisation name</Label>
										<Input
											className="rounded-xl"
											onChange={(e) => form.setFieldValue("orgName", e.target.value)}
											placeholder="Grace Assembly, Red Cross Lagos…"
											value={values.orgName}
										/>
									</div>

									{/* Org type */}
									<div className="space-y-2">
										<p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">
											Organisation type
										</p>
										<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
											{orgTypes.map(([type, meta]) => (
												<OrgTile
													current={values.orgType}
													icon={meta.icon}
													key={type}
													label={meta.label}
													onClick={(v) => form.setFieldValue("orgType", v)}
													sub={meta.sub}
													value={type}
												/>
											))}
										</div>
									</div>

									{/* Role */}
									<div className="space-y-2">
										<p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">
											Your role
										</p>
										<div className="grid grid-cols-3 gap-2">
											{roleKeys.map((r) => (
												<OrgTile
													current={values.role}
													icon={roleMeta[r].icon}
													key={r}
													label={roleMeta[r].label}
													onClick={(v) => form.setFieldValue("role", v)}
													value={r}
												/>
											))}
										</div>
									</div>

									{/* Org size */}
									<div className="space-y-2">
										<p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">
											Organisation size
										</p>
										<div className="grid grid-cols-2 gap-2">
											{sizeMeta.map((s) => (
												<OrgTile
													current={values.orgSize}
													icon={s.icon}
													key={s.value}
													label={s.label}
													onClick={(v) => form.setFieldValue("orgSize", v as OrgSize)}
													value={s.value as OrgSize}
												/>
											))}
										</div>
									</div>

									<div className="flex items-center justify-between gap-3 pt-1">
									<Button
										className="gap-1.5 rounded-xl text-xs"
										disabled={reseeding}
										onClick={async () => {
											try {
												await reseedTemplates({ orgType: values.orgType });
												toast.success("Templates reseeded for this org type");
											} catch (e) {
												toast.error(e instanceof Error ? e.message : "Failed to reseed");
											}
										}}
										size="sm"
										type="button"
										variant="outline"
										title="Regenerate default message templates for the selected org type"
									>
										{reseeding ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<RefreshCw className="h-3.5 w-3.5" />
										)}
										Reseed templates
									</Button>
									<SaveRow dirty={dirty} isPending={isPending} />
								</div>
								</div>
							);
						}}
					</form.Subscribe>
				</form>
			</CardContent>
		</Card>
	);
}

// ─── Section 3: SMS Sender ID ─────────────────────────────────────────────────

function SenderIdSection() {
	const { data: senders, isLoading } = useSenderNumbers();
	const { mutateAsync: submitSenderId, isPending: submitting } = useSubmitSenderId();
	const { mutateAsync: deleteSender, isPending: deleting } = useDeleteSenderNumber();
	const [showForm, setShowForm] = useState(false);
	const [newId, setNewId] = useState("");
	const [newLabel, setNewLabel] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const cleaned = newId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11);
	const idValid = cleaned.length >= 3;

	async function handleSubmit() {
		if (!idValid) return;
		try {
			const result = await submitSenderId({ senderId: cleaned, label: newLabel || undefined });
			if (result.success) {
				toast.success(result.reason ?? "Sender ID submitted");
				setShowForm(false);
				setNewId("");
				setNewLabel("");
			} else {
				toast.error(result.reason ?? "Submission failed");
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to submit");
		}
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await deleteSender({ id });
			toast.success("Sender ID removed");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to delete");
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<Card className="rounded-2xl">
			<SectionHeader
				description="The alphanumeric name contacts see when they receive an SMS from you"
				icon={Smartphone}
				title="SMS Sender ID"
			/>
			<Separator />
			<CardContent className="pt-5 space-y-4">
				{/* Info callout */}
				<div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
					<p className="text-[11px] text-amber-400/90 leading-relaxed">
						Termii and NCC approval takes 2–5 business days. While pending, your
						messages send from the platform default sender. Sender IDs only apply to
						SMS — WhatsApp always uses your Meta WABA number.
					</p>
				</div>

				{/* Existing sender IDs */}
				{isLoading ? (
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<Loader2 className="h-4 w-4 animate-spin" /> Loading…
					</div>
				) : senders && senders.length > 0 ? (
					<div className="space-y-2">
						{senders.map((s) => (
							<div
								className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3"
								key={s.id}
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="font-mono font-semibold text-sm">{s.number}</span>
										{s.label && s.label !== "Primary SMS Sender ID" && (
											<span className="text-muted-foreground text-xs">· {s.label}</span>
										)}
										{s.isActive ? (
											<span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
												<CheckCircle2 className="h-3 w-3" /> Active
											</span>
										) : (
											<span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
												<Clock className="h-3 w-3" /> Pending approval
											</span>
										)}
									</div>
									{s.sentCount > 0 && (
										<p className="mt-0.5 text-muted-foreground text-[10px]">
											{s.sentCount.toLocaleString()} messages sent
										</p>
									)}
								</div>
								{/* Only show delete for inactive (pending/rejected) senders */}
								{!s.isActive && (
									<Button
										className="h-7 w-7 shrink-0"
										disabled={deleting && deletingId === s.id}
										onClick={() => handleDelete(s.id)}
										size="icon"
										variant="ghost"
									>
										{deleting && deletingId === s.id ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
										) : (
											<Trash2 className="h-3.5 w-3.5 text-destructive/70" />
										)}
									</Button>
								)}
							</div>
						))}
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No sender ID registered. Using platform default sender.
					</p>
				)}

				{/* Add form */}
				{showForm ? (
					<div className="space-y-3 rounded-xl border bg-muted/10 p-4">
						<div className="flex items-center justify-between">
							<p className="font-medium text-sm">Register a sender ID</p>
							<Button
								className="h-6 w-6"
								onClick={() => {
									setShowForm(false);
									setNewId("");
									setNewLabel("");
								}}
								size="icon"
								variant="ghost"
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label className="text-xs">Sender ID *</Label>
								<Input
									className="rounded-xl font-mono"
									maxLength={11}
									onChange={(e) => setNewId(e.target.value)}
									placeholder="e.g. MyChurch"
									value={newId}
								/>
								{newId.length > 0 && (
									<p className={`text-[10px] ${idValid ? "text-primary" : "text-destructive"}`}>
										{idValid
											? `✓ "${cleaned}" — ${cleaned.length}/11 characters`
											: "Must be 3–11 alphanumeric characters"}
									</p>
								)}
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Label (optional)</Label>
								<Input
									className="rounded-xl"
									maxLength={60}
									onChange={(e) => setNewLabel(e.target.value)}
									placeholder="e.g. Main sender"
									value={newLabel}
								/>
							</div>
						</div>
						<div className="flex justify-end">
							<Button
								className="gap-1.5 rounded-xl"
								disabled={!idValid || submitting}
								onClick={handleSubmit}
								size="sm"
								type="button"
							>
								{submitting ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
									</>
								) : (
									<>
										<ChevronRight className="h-3.5 w-3.5" /> Submit for approval
									</>
								)}
							</Button>
						</div>
					</div>
				) : (
					<Button
						className="gap-1.5 rounded-xl"
						onClick={() => setShowForm(true)}
						size="sm"
						variant="outline"
					>
						<Plus className="h-3.5 w-3.5" /> Register sender ID
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

// ─── Section 4: Security ──────────────────────────────────────────────────────

function SecuritySection() {
	const { mutateAsync: updatePassword, isPending } = useUpdatePassword();
	const navigate = useNavigate();
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		onSubmit: async ({ value }) => {
			if (value.newPassword !== value.confirmPassword) {
				toast.error("New passwords do not match");
				return;
			}
			try {
				await updatePassword({
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
				});
				toast.success("Password changed successfully");
				form.reset();
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Failed to change password");
			}
		},
	});

	async function handleSignOut() {
		setSigningOut(true);
		try {
			await authClient.signOut();
			navigate({ to: "/login" });
		} catch {
			toast.error("Sign out failed — try again");
			setSigningOut(false);
		}
	}

	return (
		<Card className="rounded-2xl">
			<SectionHeader
				description="Change your password and manage your session"
				icon={Shield}
				title="Security"
			/>
			<Separator />
			<CardContent className="pt-5 space-y-6">
				{/* Change password */}
				<div>
					<p className="mb-3 font-medium text-sm">Change password</p>
					<form
						className="space-y-3"
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<form.Subscribe selector={(s) => s.values}>
							{(values) => (
								<>
									{/* Current password */}
									<div className="space-y-1.5">
										<Label className="text-xs">Current password</Label>
										<div className="relative">
											<Input
												className="rounded-xl pr-10"
												onChange={(e) =>
													form.setFieldValue("currentPassword", e.target.value)
												}
												placeholder="Your current password"
												type={showCurrent ? "text" : "password"}
												value={values.currentPassword}
											/>
											<button
												className="absolute inset-y-0 right-3 flex items-center text-muted-foreground"
												onClick={() => setShowCurrent((v) => !v)}
												type="button"
											>
												{showCurrent ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>

									{/* New password */}
									<div className="grid grid-cols-2 gap-3">
										<div className="space-y-1.5">
											<Label className="text-xs">New password</Label>
											<div className="relative">
												<Input
													className="rounded-xl pr-10"
													minLength={8}
													onChange={(e) =>
														form.setFieldValue("newPassword", e.target.value)
													}
													placeholder="Min 8 characters"
													type={showNew ? "text" : "password"}
													value={values.newPassword}
												/>
												<button
													className="absolute inset-y-0 right-3 flex items-center text-muted-foreground"
													onClick={() => setShowNew((v) => !v)}
													type="button"
												>
													{showNew ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">Confirm new password</Label>
											<Input
												className={[
													"rounded-xl",
													values.confirmPassword.length > 0 &&
													values.confirmPassword !== values.newPassword
														? "border-destructive ring-1 ring-destructive/30"
														: "",
												].join(" ")}
												onChange={(e) =>
													form.setFieldValue("confirmPassword", e.target.value)
												}
												placeholder="Repeat new password"
												type="password"
												value={values.confirmPassword}
											/>
										</div>
									</div>

									{values.confirmPassword.length > 0 &&
										values.confirmPassword !== values.newPassword && (
											<p className="flex items-center gap-1 text-destructive text-xs">
												<AlertCircle className="h-3.5 w-3.5" /> Passwords do not match
											</p>
										)}

									<div className="flex justify-end">
										<Button
											className="gap-1.5 rounded-xl"
											disabled={
												isPending ||
												!values.currentPassword ||
												values.newPassword.length < 8 ||
												values.newPassword !== values.confirmPassword
											}
											size="sm"
											type="submit"
										>
											{isPending ? (
												<>
													<Loader2 className="h-3.5 w-3.5 animate-spin" /> Changing…
												</>
											) : (
												"Change password"
											)}
										</Button>
									</div>
								</>
							)}
						</form.Subscribe>
					</form>
				</div>

				<Separator />

				{/* Sign out */}
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-sm">Sign out</p>
						<p className="text-muted-foreground text-xs">
							Sign out of your account on this device
						</p>
					</div>
					<Button
						className="gap-1.5 rounded-xl"
						disabled={signingOut}
						onClick={handleSignOut}
						size="sm"
						variant="outline"
					>
						{signingOut ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<LogOut className="h-3.5 w-3.5" />
						)}
						Sign out
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// ─── Section 5: Danger Zone ───────────────────────────────────────────────────

function DangerZone() {
	const { data: profile } = useProfile();
	const { mutateAsync: deleteAccount, isPending } = useDeleteAccount();
	const navigate = useNavigate();
	const [confirmEmail, setConfirmEmail] = useState("");

	const userEmail = profile?.email ?? "";
	const ready = confirmEmail.toLowerCase() === userEmail.toLowerCase();

	async function handleDelete() {
		if (!ready) return;
		try {
			await deleteAccount({ confirmEmail });
			toast.success("Account deleted");
			// Sign out and redirect — session is now invalid
			await authClient.signOut().catch(() => {});
			navigate({ to: "/login" });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to delete account");
		}
	}

	return (
		<Card className="rounded-2xl border-destructive/30">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
						<Trash2 className="h-4 w-4 text-destructive" />
					</div>
					<div>
						<CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
						<CardDescription className="text-xs">
							Permanent, irreversible actions
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<Separator />
			<CardContent className="pt-5 space-y-4">
				<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
					<div>
						<p className="font-medium text-sm">Delete account</p>
						<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
							Permanently deletes your account and all associated data — contacts, campaigns,
							messages, templates, and billing history. Your wallet balance will be forfeited.
							<span className="font-semibold text-foreground"> This cannot be undone.</span>
						</p>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Type your email{" "}
							<span className="font-mono text-foreground">{userEmail}</span>{" "}
							to confirm
						</Label>
						<Input
							className="rounded-xl"
							onChange={(e) => setConfirmEmail(e.target.value)}
							placeholder={userEmail}
							type="email"
							value={confirmEmail}
						/>
					</div>
					<Button
						className="gap-1.5 rounded-xl"
						disabled={!ready || isPending}
						onClick={handleDelete}
						size="sm"
						variant="destructive"
					>
						{isPending ? (
							<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
						) : (
							<><Trash2 className="h-3.5 w-3.5" /> Delete my account permanently</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView() {
	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
			<div>
				<h1 className="font-semibold text-2xl">Settings</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your account, organisation, and messaging preferences.
				</p>
			</div>

			<ProfileSection />
			<OrganisationSection />
			<SenderIdSection />
			<SecuritySection />
			<DangerZone />
		</div>
	);
}
