import Link from "next/link";

("use client");

import {
	CheckCircle2,
	Clock,
	Loader2,
	MessageCircle,
	XCircle,
} from "lucide-react";
import { Progress } from "#/components/ui/progress";
import { Skeleton } from "#/components/ui/skeleton";
import { getScenarioMeta } from "#/features/miscellaneous/org";
import { useProfile } from "#/features/profile/hooks/use-profile";
import { useCampaigns } from "../hooks/use-campaign";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
	switch (status) {
		case "completed":
			return (
				<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-[10px] text-emerald-500">
					<CheckCircle2 className="h-2.5 w-2.5" /> Completed
				</span>
			);
		case "processing":
			return (
				<span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-[10px] text-primary">
					<Loader2 className="h-2.5 w-2.5 animate-spin" /> Sending
				</span>
			);
		case "failed":
			return (
				<span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-semibold text-[10px] text-destructive">
					<XCircle className="h-2.5 w-2.5" /> Failed
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted/50 px-2 py-0.5 font-semibold text-[10px] text-muted-foreground">
					<Clock className="h-2.5 w-2.5" /> Pending
				</span>
			);
	}
}

// ─── CampaignHistory ─────────────────────────────────────────────────────────

interface CampaignHistoryProps {
	/** Max number of campaigns to show */
	limit?: number;
}

export function CampaignHistory({ limit = 20 }: CampaignHistoryProps) {
	const { data: campaigns, isLoading } = useCampaigns();
	const { data: profile } = useProfile();

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[...new Array(3)].map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
					<div className="space-y-3 rounded-xl border p-4" key={i}>
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-5 w-20 rounded-full" />
						</div>
						<Skeleton className="h-1.5 w-full rounded-full" />
						<div className="flex gap-4">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-3 w-16" />
						</div>
					</div>
				))}
			</div>
		);
	}

	const rows = (campaigns ?? []).slice(0, limit);

	if (rows.length === 0) {
		return (
			<div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
				No campaigns yet. Create your first one above.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{rows.map((c) => {
				const sentPct = c.total ? (c.sent / c.total) * 100 : 0;
				// const failPct = c.total ? (c.failed / c.total) * 100 : 0;
				const isActive = c.status === "processing" || c.status === "pending";

				const meta = getScenarioMeta(c.scenario, profile?.orgType);
				return (
					<Link
						className="block space-y-3 rounded-xl border bg-card p-4 transition-colors hover:border-muted-foreground/30 hover:bg-muted/20"
						href={`/campaigns/${c.id}`}
						key={c.id}
					>
						{/* Header */}
						<div className="flex items-start gap-3">
							<span className="mt-0.5 text-xl leading-none">{meta.icon}</span>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="truncate font-medium text-sm">{meta.label}</p>
									<StatusBadge status={c.status} />
								</div>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{new Date(c.createdAt).toLocaleDateString("en-GB", {
										day: "numeric",
										month: "short",
										year: "numeric",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</p>
							</div>
						</div>

						{/* Progress bar */}
						{c.total > 0 && (
							<div className="space-y-1">
								<Progress
									className={`h-1.5 ${isActive ? "animate-pulse" : ""}`}
									value={sentPct}
								/>
								<div className="flex items-center justify-between text-[10px] text-muted-foreground">
									<span>{c.sent} sent</span>
									{c.failed > 0 && (
										<span className="text-destructive">{c.failed} failed</span>
									)}
									<span>{c.total} total</span>
								</div>
							</div>
						)}

						{/* Stats row */}
						<div className="flex items-center gap-4 text-muted-foreground text-xs">
							<span className="flex items-center gap-1">
								<MessageCircle className="h-3 w-3" />
								{c.total} messages
							</span>

							{c.completedAt && (
								<span className="flex items-center gap-1">
									<CheckCircle2 className="h-3 w-3 text-emerald-500" />
									Done{" "}
									{new Date(c.completedAt).toLocaleDateString("en-GB", {
										day: "numeric",
										month: "short",
									})}
								</span>
							)}
						</div>
					</Link>
				);
			})}
		</div>
	);
}
