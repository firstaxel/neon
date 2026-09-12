/**
 * CampaignDetailView  —  /campaigns/[id]
 *
 * Shows live progress while sending, then full results once complete.
 * Shareable URL — anyone with access can open /campaigns/[id] to check status.
 *
 * Sections:
 *   Header  — scenario icon, label, status badge, created/completed timestamps
 *   Stats   — total / sent / failed / in-progress counts
 *   Progress bar  (animates while processing)
 *   Message list  — per-contact status rows with channel badge
 */

import { Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Clock,
	Loader2,
	MessageCircle,
	MessageSquare,
	Phone,
	Send,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { UserAvatar } from "#/features/auth/components/user-avatar";
import {
	useCampaignStatus,
	useCancelScheduledCampaign,
} from "#/features/campaigns/hooks/use-campaign";
import { getScenarioMeta } from "#/features/miscellaneous/org";
import { useProfile } from "#/features/profile/hooks/use-profile";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | Date | null | undefined) {
	if (!iso) {
		return null;
	}
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function StatusBadge({
	status,
	scheduledAt,
}: {
	status: string;
	scheduledAt?: string | Date | null;
}) {
	switch (status) {
		case "completed":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-400 text-xs">
					<CheckCircle2 className="h-3 w-3" /> Completed
				</span>
			);
		case "dispatching":
		case "processing":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-semibold text-primary text-xs">
					<Loader2 className="h-3 w-3 animate-spin" /> Dispatching
				</span>
			);
		case "cancelled":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-500 text-xs">
					<XCircle className="h-3 w-3" /> Cancelled
				</span>
			);
		case "failed":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 font-semibold text-destructive text-xs">
					<XCircle className="h-3 w-3" /> Failed
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-muted-foreground/30 bg-muted/50 px-3 py-1 font-semibold text-muted-foreground text-xs">
					<Clock className="h-3 w-3" /> {scheduledAt ? "Scheduled" : "Queued"}
				</span>
			);
	}
}

function MsgStatusDot({ status }: { status: string }) {
	switch (status) {
		case "sent":
			return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
		case "sending":
			return (
				<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
			);
		case "failed":
			return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
		default:
			return <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
	}
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
	icon,
	label,
	value,
	accent,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
	accent: string;
}) {
	return (
		<div
			className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 ${accent}`}
		>
			<div className="flex items-center gap-1.5 text-current opacity-70">
				{icon}
				<span className="font-semibold text-[10px] uppercase tracking-wider">
					{label}
				</span>
			</div>
			<p className="font-bold text-2xl tabular-nums leading-tight">{value}</p>
		</div>
	);
}

// ─── CampaignDetailView ───────────────────────────────────────────────────────

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
	const { data, isLoading, refetch } = useCampaignStatus(campaignId);
	const { data: profile } = useProfile();
	const { mutateAsync: cancelCampaign, isPending: isCancelling } =
		useCancelScheduledCampaign();
	const [confirmCancel, setConfirmCancel] = useState(false);

	async function handleCancel() {
		try {
			await cancelCampaign({ campaignId });
			toast.success(
				"Campaign cancelled successfully. Reserved funds have been released."
			);
			setConfirmCancel(false);
			await refetch();
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to cancel campaign";
			toast.error(message);
		}
	}

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-6xl px-4 py-8">
				<Skeleton className="mb-6 h-5 w-32" />
				<Skeleton className="mb-2 h-8 w-56" />
				<Skeleton className="mb-8 h-5 w-72" />
				<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton className="h-20 rounded-2xl" key={i.toString()} />
					))}
				</div>
				<Skeleton className="mb-8 h-2 w-full rounded-full" />
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton className="h-12 rounded-xl" key={i.toString()} />
					))}
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="mx-auto w-full max-w-6xl px-4 py-20 text-center text-muted-foreground">
				<p className="mb-2 font-medium">Campaign not found</p>
				<Button
					className="mt-3 gap-1.5 rounded-xl"
					nativeButton={false}
					render={
						<Link to="/campaigns">
							<ArrowLeft className="h-4 w-4" /> Back to campaigns
						</Link>
					}
					variant="outline"
				/>
			</div>
		);
	}

	const meta = getScenarioMeta(data.scenario as never, profile?.orgType);
	const total = data.total ?? 0;
	const sent = data.sent ?? 0;
	const failed = data.failed ?? 0;
	const pending = total - sent - failed;
	const sentPct = total ? (sent / total) * 100 : 0;
	const isLive = data.status === "processing" || data.status === "dispatching";
	const isPending = data.status === "pending";

	const waMessages =
		data.messages?.filter((m) => m.channel === "whatsapp") ?? [];
	const smsMessages = data.messages?.filter((m) => m.channel === "sms") ?? [];

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-8">
			{/* Back link */}
			<Button
				className="mb-6 gap-1.5 rounded-xl"
				nativeButton={false}
				render={
					<Link to="/campaigns">
						<ArrowLeft className="h-4 w-4" /> All campaigns
					</Link>
				}
				size="sm"
				variant="ghost"
			/>

			{/* Header */}
			<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
				<div className="flex items-start gap-4">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-muted/50 text-2xl">
						{meta.icon}
					</div>
					<div className="min-w-0 flex-1">
						<div className="mb-1 flex flex-wrap items-center gap-3">
							<h1 className="font-bold text-xl">{data.name || meta.label}</h1>
							<StatusBadge
								scheduledAt={data.scheduledAt}
								status={data.status}
							/>
						</div>
						<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
							<span>Created {fmtDate(data.createdAt)}</span>
							{data.scheduledAt && (
								<span className="font-medium text-blue-500">
									Scheduled for {fmtDate(data.scheduledAt)}
								</span>
							)}
							{data.completedAt && (
								<span>Completed {fmtDate(data.completedAt)}</span>
							)}
							<span className="font-mono text-[10px] opacity-50">
								{campaignId}
							</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{isLive && (
						<div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1">
							<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
							<span className="font-medium text-[10px] text-primary">Live</span>
						</div>
					)}
					{isPending && (
						<div>
							{confirmCancel ? (
								<div className="flex items-center gap-2">
									<Button
										disabled={isCancelling}
										onClick={handleCancel}
										size="sm"
										variant="destructive"
									>
										{isCancelling ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											"Confirm Cancel"
										)}
									</Button>
									<Button
										disabled={isCancelling}
										onClick={() => setConfirmCancel(false)}
										size="sm"
										variant="outline"
									>
										Back
									</Button>
								</div>
							) : (
								<Button
									className="text-amber-500 hover:text-amber-600"
									onClick={() => setConfirmCancel(true)}
									size="sm"
									variant="outline"
								>
									<AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Cancel
									Broadcast
								</Button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Stats */}
			<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard
					accent="border-border"
					icon={<Send className="h-3.5 w-3.5" />}
					label="Total"
					value={total}
				/>
				<StatCard
					accent="border-emerald-500/20 text-emerald-400"
					icon={<CheckCircle2 className="h-3.5 w-3.5" />}
					label="Sent"
					value={sent}
				/>
				<StatCard
					accent="border-destructive/20 text-destructive"
					icon={<XCircle className="h-3.5 w-3.5" />}
					label="Failed"
					value={failed}
				/>
				<StatCard
					accent="border-amber-500/20 text-amber-400"
					icon={<Clock className="h-3.5 w-3.5" />}
					label="Pending"
					value={pending}
				/>
			</div>

			{/* Progress bar */}
			{total > 0 && (
				<div className="mb-6 space-y-1.5">
					<Progress
						className={`h-2 ${isLive ? "animate-pulse" : ""}`}
						value={sentPct}
					/>
					<div className="flex justify-between text-[11px] text-muted-foreground">
						<span>{Math.round(sentPct)}% sent</span>
						<span>
							{sent} of {total} messages delivered
						</span>
					</div>
				</div>
			)}

			<Separator className="mb-6" />

			{/* Per-message list */}
			{data.messages && data.messages.length > 0 ? (
				<div className="space-y-5">
					{/* WhatsApp messages */}
					{waMessages.length > 0 && (
						<div>
							<div className="mb-3 flex items-center gap-2">
								<MessageSquare className="h-3.5 w-3.5 text-[#25d366]" />
								<p className="font-semibold text-[#25d366] text-xs uppercase tracking-wider">
									WhatsApp · {waMessages.length}
								</p>
							</div>
							<div className="divide-y overflow-hidden rounded-2xl border">
								{waMessages.map((m) => (
									<div
										className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
										key={m.id}
									>
										<MsgStatusDot status={m.status} />
										<UserAvatar name={m.contactName} size={28} />
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-sm">
												{m.contactName}
											</p>
											<p className="truncate text-[10px] text-muted-foreground">
												{m.phone}
											</p>
										</div>
										<div className="shrink-0 text-right">
											<p
												className={`font-medium text-[11px] uppercase ${
													m.status === "sent"
														? "text-emerald-400"
														: m.status === "failed"
															? "text-destructive"
															: m.status === "sending"
																? "text-primary"
																: "text-muted-foreground"
												}`}
											>
												{m.status}
											</p>
											{m.sentAt && (
												<p className="text-[10px] text-muted-foreground">
													{new Date(m.sentAt).toLocaleTimeString("en-GB", {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</p>
											)}
											{m.errorMessage && (
												<p className="max-w-40 truncate text-[10px] text-destructive">
													{m.errorMessage}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* SMS messages */}
					{smsMessages.length > 0 && (
						<div>
							<div className="mb-3 flex items-center gap-2">
								<Phone className="h-3.5 w-3.5 text-[#60a5fa]" />
								<p className="font-semibold text-[#60a5fa] text-xs uppercase tracking-wider">
									SMS · {smsMessages.length}
								</p>
							</div>
							<div className="divide-y overflow-hidden rounded-2xl border">
								{smsMessages.map((m) => (
									<div
										className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
										key={m.id}
									>
										<MsgStatusDot status={m.status} />
										<UserAvatar name={m.contactName} size={28} />
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="truncate font-medium text-sm">
													{m.contactName}
												</p>
												{m.segments && (
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
														{m.segments}{" "}
														{m.segments === 1 ? "segment" : "segments"}
													</span>
												)}
											</div>
											<p className="truncate text-[10px] text-muted-foreground">
												{m.phone}
											</p>
										</div>
										<div className="shrink-0 text-right">
											<p
												className={`font-medium text-[11px] uppercase ${
													m.status === "sent"
														? "text-emerald-400"
														: m.status === "failed"
															? "text-destructive"
															: m.status === "sending"
																? "text-primary"
																: "text-muted-foreground"
												}`}
											>
												{m.status}
											</p>
											{m.sentAt && (
												<p className="text-[10px] text-muted-foreground">
													{new Date(m.sentAt).toLocaleTimeString("en-GB", {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</p>
											)}
											{m.errorMessage && (
												<p className="max-w-40 truncate text-[10px] text-destructive">
													{m.errorMessage}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			) : (
				<div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
					<MessageCircle className="h-4 w-4" />
					<span className="text-sm">No message data yet</span>
				</div>
			)}
		</div>
	);
}
