import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Send, Users } from "lucide-react";
import { Card, CardContent } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { useCampaigns } from "#/features/campaigns/hooks/use-campaign";
import { useContacts } from "#/features/contacts/hooks/use-contacts";
import { ParseJobCard } from "#/features/parsing/components/parsed-card";
import {
	useGetParsing,
	useInvalidateParsing,
} from "#/features/parsing/hooks/useParsing";
import { useProfile } from "#/features/profile/hooks/use-profile";
import { Uploader } from "#/features/upload/components";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/(dashboard)/dashboard/")({
	component: RouteComponent,
	head: () => ({
		meta: [pageHeadMeta.dashboard],
	}),
});

function StatCard({
	icon,
	label,
	value,
	sub,
	href,
	loading,
	color,
}: {
	icon: React.ReactNode;
	label: string;
	value?: string | number;
	sub?: string;
	href: string;
	loading: boolean;
	color: string;
}) {
	return (
		<Link to={href}>
			<Card className="cursor-pointer overflow-hidden rounded-2xl border transition-colors hover:border-border/80 hover:bg-muted/20">
				<CardContent className="p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<p className="font-medium text-muted-foreground text-xs">
								{label}
							</p>
							{loading ? (
								<Skeleton className="mt-1.5 h-7 w-16" />
							) : (
								<p className="mt-1 font-bold text-2xl tabular-nums">
									{value ?? "—"}
								</p>
							)}
							{sub && (
								<p className="mt-0.5 truncate text-muted-foreground text-xs">
									{sub}
								</p>
							)}
						</div>
						<div
							className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}
						>
							{icon}
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

function RouteComponent() {
	const { data: parsing } = useGetParsing();
	const invalidateParsing = useInvalidateParsing();
	const { data: profile } = useProfile();
	const { data: contactsData, isLoading: contactsLoading } = useContacts({
		pageSize: 1,
	});
	const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();

	const totalContacts = contactsData?.pagination.total ?? 0;
	const totalCampaigns = campaigns?.length ?? 0;
	const sentMessages =
		campaigns?.reduce((acc, c) => acc + (c.sent ?? 0), 0) ?? 0;

	const greeting = (() => {
		const hour = new Date().getHours();
		if (hour < 12) {
			return "Good morning";
		}
		if (hour < 17) {
			return "Good afternoon";
		}
		return "Good evening";
	})();

	const firstName = profile?.name?.split(" ")[0] ?? "";

	return (
		<div className="mx-auto h-full w-full max-w-7xl space-y-6 px-4 py-8">
			<div>
				<h1 className="font-semibold text-2xl text-foreground">
					{greeting}
					{firstName ? `, ${firstName}` : ""} 👋
				</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Here's what's happening with your contacts and campaigns.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<StatCard
					color="bg-primary/10 text-primary"
					href="/contacts"
					icon={<Users className="h-4 w-4" />}
					label="Total Contacts"
					loading={contactsLoading}
					value={totalContacts.toLocaleString()}
				/>
				<StatCard
					color="bg-blue-500/10 text-blue-400"
					href="/campaigns"
					icon={<Send className="h-4 w-4" />}
					label="Campaigns"
					loading={campaignsLoading}
					value={totalCampaigns.toLocaleString()}
				/>
				<StatCard
					color="bg-emerald-500/10 text-emerald-400"
					href="/messages"
					icon={<MessageCircle className="h-4 w-4" />}
					label="Messages Sent"
					loading={campaignsLoading}
					sub="across all campaigns"
					value={sentMessages.toLocaleString()}
				/>
			</div>

			<div className="space-y-3">
				<div>
					<h2 className="font-semibold text-foreground text-lg">
						Import Contacts
					</h2>
					<p className="text-muted-foreground text-sm">
						Upload a spreadsheet, PDF, or image — we'll parse the contacts
						automatically.
					</p>
				</div>
				<Uploader
					onUploadComplete={() => {
						invalidateParsing();
					}}
				/>
			</div>

			{parsing?.data && parsing.data.length > 0 && (
				<div className="space-y-3">
					<div>
						<h2 className="font-semibold text-foreground text-lg">
							Parsing Contacts
						</h2>
						<p className="text-muted-foreground text-sm">
							Processing your uploaded files — contacts appear in your list once
							done.
						</p>
					</div>
					{parsing.data.map((parse) => (
						<ParseJobCard {...parse} key={parse.jobId} />
					))}
				</div>
			)}
		</div>
	);
}
