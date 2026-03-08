/**
 * MessagesView — Inbox tab
 *
 * Two-pane layout:
 *   Left  — conversation list (grouped by phone + channel)
 *   Right — thread timeline with reply composer
 *
 * Key behaviour:
 *   - WhatsApp conversations show a live countdown to the 24-hour service
 *     window expiry. Within the window: reply billed at ₦1 (service rate).
 *     After it closes: banner warns that the next send needs a template (₦9).
 *   - SMS conversations have no window restriction.
 *   - The reply composer is disabled when the WA window is closed.
 *   - Architecture note: the `replyToConversation` oRPC handler is the AI
 *     chatbot integration point — when AI is enabled for a user it will route
 *     through the AI model instead of sending the manual reply directly.
 */

import {
	AlertTriangle,
	ArrowLeft,
	Bot,
	Clock,
	Inbox,
	Loader2,
	MessageSquare,
	Phone,
	RefreshCw,
	Send,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import type { client } from "#/orpc/client";
import {
	useGetInboxThread,
	useMessageConversations,
	useMessageThread,
} from "../hooks/use-message";

// ─── Types inferred from router returns ──────────────────────────────────────

type Conversation = NonNullable<
	Awaited<ReturnType<typeof client.inbox.list>>
>[number];
type Thread = Awaited<ReturnType<typeof client.inbox.get>>;

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(expiresAtIso: string | null) {
	const [secondsLeft, setSecondsLeft] = useState(0);
	useEffect(() => {
		if (!expiresAtIso) {
			setSecondsLeft(0);
			return;
		}
		function tick() {
			setSecondsLeft(
				Math.max(
					0,
					Math.floor(
						(new Date(expiresAtIso ?? new Date()).getTime() - Date.now()) / 1000
					)
				)
			);
		}
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [expiresAtIso]);
	const h = Math.floor(secondsLeft / 3600);
	const m = Math.floor((secondsLeft % 3600) / 60);
	const s = secondsLeft % 60;
	return {
		secondsLeft,
		isOpen: secondsLeft > 0,
		isWarning: secondsLeft > 0 && secondsLeft < 3600,
		formatted:
			secondsLeft > 0
				? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
				: "Closed",
	};
}

// ─── ServiceWindowBadge ───────────────────────────────────────────────────────

function ServiceWindowBadge({
	windowExpiresAt,
	channel,
	compact = false,
}: {
	windowExpiresAt: string | null;
	channel: string;
	compact?: boolean;
}) {
	const cd = useCountdown(windowExpiresAt);
	if (channel !== "whatsapp") {
		return null;
	}
	return (
		<div
			className={cn(
				"flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 font-semibold text-xs tabular-nums",
				cd.isOpen
					? cd.isWarning
						? "border-amber-500/30 bg-amber-500/10 text-amber-400"
						: "border-primary/30 bg-primary/10 text-primary"
					: "border-destructive/30 bg-destructive/10 text-destructive"
			)}
		>
			<Clock className="h-3 w-3 shrink-0" />
			{compact ? (
				<span className="hidden sm:inline">
					{cd.isOpen ? cd.formatted : "Closed"}
				</span>
			) : (
				<span className="hidden md:inline">
					{cd.isOpen
						? `${cd.formatted} · ₦1`
						: "Window closed · needs template (₦9)"}
				</span>
			)}
		</div>
	);
}

// ─── ConversationRow ──────────────────────────────────────────────────────────

function ConversationRow({
	conv,
	active,
	onClick,
}: {
	conv: NonNullable<Conversation>;
	active: boolean;
	onClick: () => void;
}) {
	const cd = useCountdown(conv.windowExpiresAt ?? null);
	return (
		<button
			className={cn(
				"w-full border-border/50 border-b px-3 py-3.5 text-left transition-colors sm:px-4",
				"hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				active && "border-l-2 border-l-primary bg-primary/5"
			)}
			onClick={onClick}
			type="button"
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-bold text-xs",
						conv.channel === "whatsapp"
							? "border-primary/30 bg-primary/10 text-primary"
							: "border-blue-400/30 bg-blue-400/10 text-blue-400"
					)}
				>
					{conv.contactName ? (
						conv.contactName
							.split(" ")
							.map((n) => n[0])
							.join("")
							.slice(0, 2)
							.toUpperCase()
					) : (
						<Phone className="h-3.5 w-3.5" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="mb-0.5 flex items-center justify-between gap-2">
						<p className="truncate font-semibold text-foreground text-sm">
							{conv.contactName ?? conv.phone}
						</p>
						<span className="shrink-0 text-[10px] text-muted-foreground">
							{new Date(conv.lastMessageAt).toLocaleTimeString("en-GB", {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					</div>
					<p className="mb-1.5 truncate text-muted-foreground text-xs">
						{conv.lastMessage}
					</p>
					<div className="flex items-center gap-2">
						<Badge
							className={cn(
								"h-4 px-1.5 py-0 font-bold text-[9px] uppercase",
								conv.channel === "whatsapp"
									? "border-primary/25 text-primary"
									: "border-blue-400/25 text-blue-400"
							)}
							variant="outline"
						>
							{conv.channel === "whatsapp" ? "WA" : "SMS"}
						</Badge>
						{"hasInbound" in conv &&
							!(conv as { hasInbound: boolean }).hasInbound && (
								<span className="rounded border border-border/40 px-1.5 py-0.5 font-semibold text-[9px] text-muted-foreground/50 uppercase tracking-wide">
									awaiting reply
								</span>
							)}
						{conv.unreadCount > 0 && (
							<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-bold text-[10px] text-primary-foreground">
								{conv.unreadCount}
							</span>
						)}
						{conv.channel === "whatsapp" && conv.windowExpiresAt && (
							<span
								className={cn(
									"font-mono text-[10px] tabular-nums",
									cd.isOpen
										? cd.isWarning
											? "text-amber-400"
											: "text-primary"
										: "text-destructive"
								)}
							>
								{cd.isOpen ? cd.formatted : "Closed"}
							</span>
						)}
					</div>
				</div>
			</div>
		</button>
	);
}

// ─── ThreadMessage ────────────────────────────────────────────────────────────

type TimelineItem = Thread["timeline"][number];

function ThreadMessage({ item }: { item: TimelineItem }) {
	const isOut = item.direction === "out";
	const isCampaignSend =
		isOut && "source" in item && item.source === "campaign_send";
	// const isInboxReply = isOut && "source" in item && item.source === "inbox_reply";
	const time = new Date(item.at).toLocaleString("en-GB", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
	return (
		<div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
			<div
				className={cn(
					"flex max-w-[80%] flex-col gap-1 sm:max-w-[72%]",
					isOut && "items-end"
				)}
			>
				{isCampaignSend && (
					<span className="mb-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground/60">
						<MessageSquare className="h-2.5 w-2.5" />
						Campaign
					</span>
				)}
				<div
					className={cn(
						"rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
						isOut
							? isCampaignSend
								? "rounded-tr-sm bg-primary/80 text-primary-foreground"
								: "rounded-tr-sm bg-primary text-primary-foreground"
							: "rounded-tl-sm border border-border/50 bg-muted text-foreground"
					)}
				>
					{item.body}
				</div>
				<div className="flex items-center gap-1.5 px-1">
					<span className="text-[10px] text-muted-foreground">{time}</span>
					{isOut && (
						<span
							className={cn(
								"font-medium text-[10px]",
								item.status === "delivered" || item.status === "read"
									? "text-primary"
									: item.status === "failed"
										? "text-destructive"
										: "text-muted-foreground"
							)}
						>
							{item.status === "read"
								? "Read"
								: item.status === "delivered"
									? "Delivered"
									: item.status === "sent"
										? "Sent"
										: item.status === "failed"
											? "Failed"
											: "Sending…"}
						</span>
					)}
					{!isOut && item.isKeyword && (
						<Badge
							className="h-3.5 border-amber-500/30 px-1 py-0 text-[9px] text-amber-400"
							variant="outline"
						>
							keyword
						</Badge>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── ThreadPane ───────────────────────────────────────────────────────────────

function ThreadPane({
	phone,
	channel,
	onBack,
}: {
	phone: string;
	channel: "whatsapp" | "sms";
	onBack?: () => void;
}) {
	const [body, setBody] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	const {
		data: thread,
		isLoading,
		refetch,
	} = useGetInboxThread({ phone, channel });

	const cd = useCountdown(thread?.windowExpiresAt ?? null);

	const reply = useMessageThread({ phone, channel });

	// biome-ignore lint/correctness/useExhaustiveDependencies: <need to scroll to bottom>
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [thread?.timeline.length]);

	const canReply = channel === "sms" || cd.isOpen;
	const smsSegments =
		channel === "sms" && body.length > 0 ? Math.ceil(body.length / 160) : 0;

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-3 sm:px-5">
				{/* Back button — visible on mobile */}
				{onBack && (
					<Button
						className="h-8 w-8 shrink-0 rounded-lg sm:hidden"
						onClick={onBack}
						size="icon"
						variant="ghost"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-foreground text-sm">
						{thread?.contactName ?? phone}
					</p>
					<p className="font-mono text-muted-foreground text-xs">{phone}</p>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{thread && (
						<ServiceWindowBadge
							channel={channel}
							windowExpiresAt={thread.windowExpiresAt}
						/>
					)}
					<Button
						className="h-8 w-8 rounded-lg"
						onClick={() => refetch()}
						size="icon"
						variant="ghost"
					>
						<RefreshCw className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			{/* Messages */}
			<div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5">
				{isLoading ? (
					<div className="flex flex-col gap-3">
						{[...new Array(5)].map((_, i) => (
							<div
								className={cn(
									"flex",
									i % 2 === 0 ? "justify-start" : "justify-end"
								)}
								key={i.toString()}
							>
								<Skeleton className="h-10 w-40 rounded-2xl sm:w-48" />
							</div>
						))}
					</div>
				) : (thread?.timeline ?? []).length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
						<MessageSquare className="h-10 w-10 opacity-20" />
						<p className="text-sm">No messages yet</p>
					</div>
				) : (
					(thread?.timeline ?? []).map((item) => (
						<ThreadMessage item={item} key={item.id} />
					))
				)}
				<div ref={bottomRef} />
			</div>

			{/* Window-closed warning */}
			{channel === "whatsapp" && !cd.isOpen && thread && (
				<div className="mx-3 mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 sm:mx-4 sm:px-4">
					<AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-400" />
					<div>
						<p className="font-semibold text-amber-400 text-sm">
							Service window closed
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
							The 24h free reply window has expired. The next message must be a
							pre-approved WhatsApp template (₦9).
							<span className="font-medium text-amber-400">
								{" "}
								Template sending from inbox is coming soon.
							</span>
						</p>
					</div>
				</div>
			)}

			{/* AI banner */}
			<div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 sm:mx-4">
				<Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				<p className="text-[11px] text-muted-foreground">
					AI auto-reply coming soon — responds automatically within the service
					window.
				</p>
			</div>

			{/* Composer */}
			<div className="shrink-0 border-border border-t px-3 py-3 sm:px-4">
				<div className="relative">
					<Textarea
						className="min-h-18 resize-none rounded-xl pr-20 text-sm"
						disabled={!canReply || reply.isPending}
						onChange={(e) => setBody(e.target.value)}
						onKeyDown={(e) => {
							if (
								e.key === "Enter" &&
								(e.metaKey || e.ctrlKey) &&
								body.trim() &&
								canReply
							) {
								reply.mutate({
									channel,
									phone,
								});
							}
						}}
						placeholder={
							canReply
								? channel === "sms"
									? "Type your SMS reply…"
									: "Type your reply (₦1 service rate)…"
								: "Service window closed — template reply coming soon"
						}
						value={body}
					/>
					<div className="absolute right-2.5 bottom-2.5 flex flex-col items-end gap-1.5">
						{smsSegments > 0 && (
							<span className="text-[10px] text-muted-foreground">
								{body.length} · {smsSegments}s
							</span>
						)}
						<Button
							className="h-8 gap-1.5 rounded-lg text-xs"
							disabled={!(body.trim() && canReply) || reply.isPending}
							onClick={() =>
								reply.mutate({
									channel,
									phone,
								})
							}
							size="sm"
						>
							{reply.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Send className="h-3.5 w-3.5" />
							)}
							Send
						</Button>
					</div>
				</div>
				<p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
					{canReply
						? channel === "whatsapp"
							? "₦1 service rate · ⌘↵ to send"
							: "₦2.50 · ⌘↵ to send"
						: "Reply disabled — service window expired"}
				</p>
			</div>
		</div>
	);
}

// ─── MessagesView ─────────────────────────────────────────────────────────────

export function MessagesView() {
	const [selected, setSelected] = useState<{
		phone: string;
		channel: "whatsapp" | "sms";
	} | null>(null);
	const [filter, setFilter] = useState<"all" | "unread" | "keyword">("all");
	const [channelFilter, setChannelFilter] = useState<
		"all" | "whatsapp" | "sms"
	>("all");
	// On mobile we toggle between list and thread
	const [mobileView, setMobileView] = useState<"list" | "thread">("list");

	const {
		data: conversations,
		isLoading,
		refetch,
	} = useMessageConversations({
		filter,
		channelFilter: channelFilter === "all" ? undefined : channelFilter,
	});

	const totalUnread =
		conversations?.reduce((n, c) => n + (c?.unreadCount ?? 0), 0) ?? 0;

	function selectConv(phone: string, channel: "whatsapp" | "sms") {
		setSelected({ phone, channel });
		setMobileView("thread");
	}

	function goBack() {
		setMobileView("list");
	}

	return (
		// Full viewport height minus the AppShell header on mobile (57px)
		<div className="flex h-[calc(100dvh-57px)] w-full overflow-hidden md:h-[calc(100vh-0px)]">
			{/* ── Left: Conversation list ── */}
			<div
				className={cn(
					// On mobile: full width when showing list, hidden when showing thread
					"flex flex-col border-border border-r bg-card/40",
					"w-full md:w-72 md:shrink-0",
					mobileView === "thread" ? "hidden md:flex" : "flex"
				)}
			>
				{/* Header */}
				<div className="shrink-0 border-border border-b px-3 py-3 sm:px-4">
					<div className="mb-3 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Inbox className="h-4 w-4 text-muted-foreground" />
							<h2 className="font-semibold text-foreground text-sm">Inbox</h2>
							{totalUnread > 0 && (
								<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-bold text-[10px] text-primary-foreground">
									{totalUnread}
								</span>
							)}
						</div>
						<Button
							className="h-7 w-7 rounded-lg"
							onClick={() => refetch()}
							size="icon"
							variant="ghost"
						>
							<RefreshCw className="h-3.5 w-3.5" />
						</Button>
					</div>

					{/* Filters */}
					<div className="flex flex-wrap gap-1.5">
						{(["all", "unread", "keyword"] as const).map((f) => (
							<button
								className={cn(
									"rounded-lg px-2.5 py-1 font-semibold text-[11px] capitalize transition-colors",
									filter === f
										? "border border-primary/25 bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
								)}
								key={f}
								onClick={() => setFilter(f)}
								type="button"
							>
								{f}
							</button>
						))}
					</div>

					<div className="mt-1.5 flex gap-1.5">
						{(["all", "whatsapp", "sms"] as const).map((c) => (
							<button
								className={cn(
									"rounded-lg px-2.5 py-1 font-semibold text-[11px] capitalize transition-colors",
									channelFilter === c
										? c === "whatsapp"
											? "border border-primary/25 bg-primary/10 text-primary"
											: c === "sms"
												? "border border-blue-400/25 bg-blue-400/10 text-blue-400"
												: "border border-border bg-muted text-foreground"
										: "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
								)}
								key={c}
								onClick={() => setChannelFilter(c)}
								type="button"
							>
								{c === "whatsapp" ? "WA" : c}
							</button>
						))}
					</div>
				</div>

				{/* Conversation list */}
				<div className="flex-1 overflow-y-auto">
					{isLoading ? (
						<div className="flex flex-col gap-0">
							{[...new Array(6)].map((_, i) => (
								<div
									className="border-border/50 border-b px-4 py-3.5"
									key={i.toString()}
								>
									<div className="flex gap-3">
										<Skeleton className="h-9 w-9 shrink-0 rounded-full" />
										<div className="flex flex-1 flex-col gap-1.5">
											<Skeleton className="h-3.5 w-32" />
											<Skeleton className="h-3 w-full" />
											<Skeleton className="h-3 w-16" />
										</div>
									</div>
								</div>
							))}
						</div>
					) : conversations?.length ? (
						conversations.map((conv) =>
							conv ? (
								<ConversationRow
									active={
										selected?.phone === conv.phone &&
										selected?.channel === conv.channel
									}
									conv={conv}
									key={`${conv.phone}_${conv.channel}`}
									onClick={() =>
										selectConv(conv.phone, conv.channel as "whatsapp" | "sms")
									}
								/>
							) : null
						)
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
							<MessageSquare className="h-10 w-10 text-muted-foreground/20" />
							<div>
								<p className="font-medium text-foreground text-sm">
									No conversations yet
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Replies from contacts will appear here after you send a
									campaign.
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ── Right: Thread pane ── */}
			<div
				className={cn(
					"min-w-0 flex-1 bg-background",
					// Mobile: full width when showing thread, hidden when showing list
					mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
				)}
			>
				{selected ? (
					<ThreadPane
						channel={selected.channel}
						onBack={goBack}
						phone={selected.phone}
					/>
				) : (
					// Empty state — desktop only (mobile never shows this pane without a selection)
					<div className="hidden h-full flex-col items-center justify-center gap-4 px-8 text-center md:flex">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/30">
							<MessageSquare className="h-7 w-7 text-muted-foreground/40" />
						</div>
						<div>
							<p className="font-semibold text-base text-foreground">
								Select a conversation
							</p>
							<p className="mt-1.5 max-w-xs text-muted-foreground text-sm leading-relaxed">
								Pick a conversation from the left to view the thread and reply.
							</p>
						</div>
						<div className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
							{[
								{
									icon: <Clock className="h-3.5 w-3.5" />,
									text: "WhatsApp replies are free for 24h after a contact messages you",
								},
								{
									icon: <Zap className="h-3.5 w-3.5" />,
									text: "Billed at ₦1 within the window, ₦9 template rate after",
								},
								{
									icon: <Bot className="h-3.5 w-3.5" />,
									text: "AI auto-reply coming soon — responds automatically in the window",
								},
							].map(({ icon, text }, i) => (
								<div
									className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
									key={i.toString()}
								>
									<span className="mt-px shrink-0 text-muted-foreground">
										{icon}
									</span>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										{text}
									</p>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
