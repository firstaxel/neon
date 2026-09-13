import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle2,
	Circle,
	CreditCard,
	MessageCircle,
	Send,
	Sparkles,
	Users,
	Wallet,
} from "lucide-react";
import React, { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { DepositDialog } from "#/features/billing/components/deposit-dialog";
import { useWallet } from "#/features/billing/hooks/use-billing";
import { formatNaira } from "#/features/billing/utils/format";
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
import { cn } from "#/lib/utils";

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
								<p className="mt-1 font-bold font-mono text-2xl tabular-nums">
									{value ?? "0"}
								</p>
							)}
							{Boolean(sub) && (
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

// ─── Activation Checklist for New Users ───────────────────────────────────────

interface ActivationStep {
	actionLabel: string;
	completed: boolean;
	description: string;
	id: string;
	onAction?: () => void;
	stepNumber: number;
	title: string;
	to?: string;
}

function ActivationChecklist({
	onOpenDeposit,
	spendableKobo,
	totalCampaigns,
	totalContacts,
}: {
	onOpenDeposit: () => void;
	spendableKobo: number;
	totalCampaigns: number;
	totalContacts: number;
}) {
	const steps: ActivationStep[] = [
		{
			actionLabel: "Top up wallet",
			completed: spendableKobo > 0,
			description:
				"Deposit Naira via Paystack to fund outbound SMS and WhatsApp dispatches.",
			id: "fund-wallet",
			onAction: onOpenDeposit,
			stepNumber: 1,
			title: "Fund your prepaid wallet",
		},
		{
			actionLabel: "Import contacts",
			completed: totalContacts > 0,
			description:
				"Upload a spreadsheet, PDF, or image to parse and save your audience phone numbers.",
			id: "add-contacts",
			onAction: () => {
				const el = document.getElementById("import-uploader");
				el?.scrollIntoView({ behavior: "smooth" });
			},
			stepNumber: 2,
			title: "Add your audience contacts",
			to: "/contacts",
		},
		{
			actionLabel: "Create campaign",
			completed: totalCampaigns > 0,
			description:
				"Select your audience, draft your message template, and launch your first broadcast.",
			id: "first-campaign",
			stepNumber: 3,
			title: "Launch your first broadcast",
			to: "/campaigns/create",
		},
	];

	const completedCount = steps.filter((s) => s.completed).length;
	const progressPercent = Math.round((completedCount / steps.length) * 100);

	return (
		<div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-0.5">
					<div className="flex items-center gap-2">
						<span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
							<Sparkles className="size-3.5" />
						</span>
						<h2 className="font-semibold text-base text-foreground">
							Getting Started
						</h2>
					</div>
					<p className="text-muted-foreground text-xs">
						Complete these three steps to activate your broadcasting pipeline.
					</p>
				</div>

				<div className="flex items-center gap-3">
					<span className="font-medium font-mono text-muted-foreground text-xs">
						{completedCount} of {steps.length} complete
					</span>
					<div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-3">
				{steps.map((step) => (
					<div
						className={cn(
							"flex flex-col justify-between rounded-2xl border p-4 transition-colors",
							step.completed
								? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
								: "border-border/80 bg-background/50 hover:bg-background"
						)}
						key={step.id}
					>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
									Step {step.stepNumber}
								</span>
								{step.completed ? (
									<span className="flex items-center gap-1 font-medium text-emerald-500 text-xs">
										<CheckCircle2 className="size-4" />
										<span>Ready</span>
									</span>
								) : (
									<Circle className="size-4 text-muted-foreground/60" />
								)}
							</div>

							<div>
								<h3 className="font-semibold text-foreground text-sm">
									{step.title}
								</h3>
								<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
									{step.description}
								</p>
							</div>
						</div>

						<div className="pt-4">
							{step.to ? (
								<Link className="inline-flex w-full" to={step.to}>
									<Button
										className="w-full justify-between rounded-stadium font-medium text-xs"
										size="xs"
										type="button"
										variant={step.completed ? "outline" : "default"}
									>
										<span>{step.actionLabel}</span>
										<ArrowRight className="size-3.5" />
									</Button>
								</Link>
							) : (
								<Button
									className="w-full justify-between rounded-stadium font-medium text-xs"
									onClick={step.onAction}
									size="xs"
									type="button"
									variant={step.completed ? "outline" : "default"}
								>
									<span>{step.actionLabel}</span>
									<CreditCard className="size-3.5" />
								</Button>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Dashboard Route Component ────────────────────────────────────────────────

function RouteComponent() {
	const { data: parsing } = useGetParsing();
	const invalidateParsing = useInvalidateParsing();
	const { data: profile } = useProfile();
	const { data: wallet, isLoading: walletLoading } = useWallet();
	const { data: contactsData, isLoading: contactsLoading } = useContacts({
		pageSize: 1,
	});
	const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
	const [depositOpen, setDepositOpen] = useState(false);

	const balanceKobo = wallet?.balanceKobo ?? 0;
	const heldKobo = wallet?.heldKobo ?? 0;
	const spendableKobo = Math.max(0, balanceKobo - heldKobo);

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

	const handleOpenDeposit = React.useCallback(() => {
		setDepositOpen(true);
	}, []);

	const handleUploadComplete = React.useCallback(() => {
		invalidateParsing();
	}, [invalidateParsing]);

	return (
		<div className="mx-auto h-full w-full max-w-7xl space-y-6 px-4 py-8">
			{/* Top greeting */}
			<div>
				<h1 className="font-semibold text-2xl text-foreground">
					{greeting}
					{firstName ? `, ${firstName}` : ""} 👋
				</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Here is what is happening with your audience and broadcast campaigns.
				</p>
			</div>

			{/* 4-card operational metrics overview */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					color="bg-emerald-500/10 text-emerald-500"
					href="/billing"
					icon={<Wallet className="h-4 w-4" />}
					label="Spendable Wallet"
					loading={walletLoading}
					sub={
						heldKobo > 0 ? `${formatNaira(heldKobo)} held` : "Available balance"
					}
					value={formatNaira(spendableKobo)}
				/>
				<StatCard
					color="bg-primary/10 text-primary"
					href="/contacts"
					icon={<Users className="h-4 w-4" />}
					label="Total Contacts"
					loading={contactsLoading}
					sub="Audience list"
					value={totalContacts.toLocaleString()}
				/>
				<StatCard
					color="bg-blue-500/10 text-blue-400"
					href="/campaigns"
					icon={<Send className="h-4 w-4" />}
					label="Campaigns"
					loading={campaignsLoading}
					sub="Broadcasts created"
					value={totalCampaigns.toLocaleString()}
				/>
				<StatCard
					color="bg-indigo-500/10 text-indigo-400"
					href="/messages"
					icon={<MessageCircle className="h-4 w-4" />}
					label="Messages Sent"
					loading={campaignsLoading}
					sub="Across all broadcasts"
					value={sentMessages.toLocaleString()}
				/>
			</div>

			{/* Activation checklist */}
			<ActivationChecklist
				onOpenDeposit={handleOpenDeposit}
				spendableKobo={spendableKobo}
				totalCampaigns={totalCampaigns}
				totalContacts={totalContacts}
			/>

			{/* Contact uploader */}
			<div className="space-y-3" id="import-uploader">
				<div>
					<h2 className="font-semibold text-foreground text-lg">
						Import Contacts
					</h2>
					<p className="text-muted-foreground text-sm">
						Upload a spreadsheet, PDF, or image. We parse the contacts
						automatically using AI extraction.
					</p>
				</div>
				<Uploader onUploadComplete={handleUploadComplete} />
			</div>

			{/* Parsing status cards */}
			{parsing?.data && parsing.data.length > 0 && (
				<div className="space-y-3">
					<div>
						<h2 className="font-semibold text-foreground text-lg">
							Parsing Contacts
						</h2>
						<p className="text-muted-foreground text-sm">
							Processing your uploaded files. Contacts appear in your list once
							parsing completes.
						</p>
					</div>
					{parsing.data.map((parse) => (
						<ParseJobCard {...parse} key={parse.jobId} />
					))}
				</div>
			)}

			<DepositDialog onOpenChange={setDepositOpen} open={depositOpen} />
		</div>
	);
}
