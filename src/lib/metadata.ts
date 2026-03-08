// ─── Site config ──────────────────────────────────────────────────────────────

import { env } from "#/env";

export const siteConfig = {
	name: "MessageDesk",
	tagline: "Messaging Console",
	description:
		"Send personalised WhatsApp and SMS campaigns to your entire contact list — tracked, fast, and affordable.",
	url: env.VITE_CLIENT_URL ?? "https://messagedesk.app",
	ogImage: "/og.png",
	twitterHandle: "@messagedesk",
	locale: "en_NG",
	themeColor: "#25d366",
} as const;

// ─── Page-title template ──────────────────────────────────────────────────────

/**
 * Formats a browser tab title.
 *   "Campaigns"         → "Campaigns —  neon"
 *   undefined           → " neon — Church & NGO Messaging Console"
 */
function formatTitle(pageTitle?: string): string {
	if (!pageTitle) {
		return `${siteConfig.name} — ${siteConfig.tagline}`;
	}
	return `${pageTitle} — ${siteConfig.name}`;
}

// ─── createMetadata ───────────────────────────────────────────────────────────

export interface MetadataOptions {
	/** Absolute or root-relative path for the canonical URL, e.g. "/campaigns/abc". */
	canonicalPath?: string;
	/** Page-specific description. Defaults to siteConfig.description. */
	description?: string;
	/** Extra keywords to merge with the default set. */
	keywords?: string[];
	/**
	 * Set true for auth pages, admin-only pages, or anything you don't want
	 * indexed (login, register, onboarding, reset-password, billing/verify).
	 */
	noIndex?: boolean;
	/**
	 * Custom OG image path (root-relative) or full URL.
	 * Defaults to siteConfig.ogImage.
	 */
	ogImage?: string;
	/** Short page title. Appended with " —  neon". Omit for the home title. */
	title?: string;
}

const DEFAULT_KEYWORDS = [
	"WhatsApp",
	"SMS",
	"messaging",
	" messaging",
	"campaign",
	"Nigeria",
	"bulk SMS",
	"neon",
];

// ─────────────────────────────────────────────────────────────────────────────
// TanStack Start — head() helper
// ─────────────────────────────────────────────────────────────────────────────
//
// TanStack Start uses a different metadata API from Next.js.
// Instead of exporting a `metadata` object, each route file exports a `head()`
// function (or uses the `head` option in createFileRoute) that returns
// { title, meta[], links[] }. These are injected via <Meta /> and <Links />
// in the root layout.
//
// Usage in a route file:
//
//   import { createFileRoute } from "@tanstack/react-router";
//   import { createHeadMeta, pageHeadMeta } from "@/lib/metadata";
//
//   export const Route = createFileRoute("/dashboard")({
//     head: () => pageHeadMeta.dashboard,
//     component: DashboardPage,
//   });
//
// Dynamic route:
//
//   export const Route = createFileRoute("/campaigns/$id")({
//     head: ({ params }) => createHeadMeta({
//       title: `Campaign ${params.id}`,
//       description: "Campaign details",
//       canonicalPath: `/campaigns/${params.id}`,
//       noIndex: true,
//     }),
//     component: CampaignDetailPage,
//   });
//
// ─────────────────────────────────────────────────────────────────────────────

/** Shape returned by head() in TanStack Start route files. */
export interface HeadMeta {
	links: Array<{ rel: string; href: string; type?: string; sizes?: string }>;
	meta: Array<{
		name?: string;
		property?: string;
		content?: string;
		charSet?: "utf-8";
		httpEquiv?: string;
	}>;
	title: string;
}

/**
 * Build a TanStack Start `head()` return value from the same options
 * as createMetadata(), so the two frameworks share a single source of truth.
 */
export function createHeadMeta({
	title,
	description,
	canonicalPath,
	ogImage,
	noIndex = false,
	keywords = [],
}: MetadataOptions = {}): HeadMeta {
	const resolvedTitle = formatTitle(title);
	const resolvedDescription = description ?? siteConfig.description;
	const resolvedOgImage = ogImage ?? siteConfig.ogImage;
	const canonicalUrl = canonicalPath
		? `${siteConfig.url}${canonicalPath}`
		: siteConfig.url;

	const ogImageUrl = resolvedOgImage.startsWith("http")
		? resolvedOgImage
		: `${siteConfig.url}${resolvedOgImage}`;

	const allKeywords = [...DEFAULT_KEYWORDS, ...keywords];

	const meta: HeadMeta["meta"] = [
		{ charSet: "utf-8" },
		{ name: "viewport", content: "width=device-width, initial-scale=1" },
		{ name: "description", content: resolvedDescription },
		{ name: "keywords", content: allKeywords.join(", ") },
		{ name: "author", content: siteConfig.name },
		{ name: "theme-color", content: siteConfig.themeColor },
		{ httpEquiv: "content-language", content: "en-NG" },
	];

	if (noIndex) {
		meta.push({ name: "robots", content: "noindex, nofollow" });
	} else {
		meta.push({ name: "robots", content: "index, follow" });

		// OpenGraph
		meta.push(
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: canonicalUrl },
			{ property: "og:site_name", content: siteConfig.name },
			{ property: "og:title", content: resolvedTitle },
			{ property: "og:description", content: resolvedDescription },
			{ property: "og:image", content: ogImageUrl },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:image:alt", content: resolvedTitle },
			{ property: "og:locale", content: siteConfig.locale }
		);

		// Twitter card
		meta.push(
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:site", content: siteConfig.twitterHandle },
			{ name: "twitter:creator", content: siteConfig.twitterHandle },
			{ name: "twitter:title", content: resolvedTitle },
			{ name: "twitter:description", content: resolvedDescription },
			{ name: "twitter:image", content: ogImageUrl }
		);
	}

	const links: HeadMeta["links"] = [
		{ rel: "icon", href: "/favicon.ico" },
		{ rel: "icon", href: "/icon.png", type: "image/png" },
		{ rel: "apple-touch-icon", href: "/apple-icon.png", sizes: "180x180" },
		{ rel: "manifest", href: "/manifest.json" },
		...(canonicalPath && !noIndex
			? [{ rel: "canonical", href: canonicalUrl }]
			: []),
	];

	return { title: resolvedTitle, meta, links };
}

/**
 * TanStack Start equivalents of pageMetadata — same pages, same options,
 * correct output shape for head() exports.
 */
export const pageHeadMeta = {
	home: createHeadMeta({ canonicalPath: "/" }),

	dashboard: createHeadMeta({
		title: "Dashboard",
		description: "Overview of your campaigns, contacts, and wallet balance",
		canonicalPath: "/dashboard",
		keywords: ["dashboard", "analytics", "overview"],
	}),

	campaigns: createHeadMeta({
		title: "Campaigns",
		description: "Create and manage your WhatsApp and SMS messaging campaigns",
		canonicalPath: "/campaigns",
		keywords: ["campaign", "send messages", "bulk messaging"],
	}),

	contacts: createHeadMeta({
		title: "Contacts",
		description:
			"Manage your congregation or contact list for messaging campaigns",
		canonicalPath: "/contacts",
		keywords: ["contacts", "congregation", "members", "contact list"],
	}),

	messages: createHeadMeta({
		title: "Messages",
		description: "View all sent, pending, and failed messages across campaigns",
		canonicalPath: "/messages",
		keywords: ["messages", "delivery", "inbox", "WhatsApp", "SMS"],
	}),

	templates: createHeadMeta({
		title: "Templates",
		description:
			"Create and manage reusable WhatsApp and SMS message templates",
		canonicalPath: "/templates",
		keywords: ["templates", "WhatsApp templates", "SMS templates"],
	}),

	billing: createHeadMeta({
		title: "Billing",
		description:
			"Manage your wallet, subscription plan, and transaction history",
		canonicalPath: "/billing",
		noIndex: true,
	}),

	settings: createHeadMeta({
		title: "Account Settings",
		description: "Update your profile, organisation details, and password",
		canonicalPath: "/settings",
		noIndex: true,
	}),

	login: createHeadMeta({ title: "Sign in", noIndex: true }),
	register: createHeadMeta({ title: "Create account", noIndex: true }),
	resetPassword: createHeadMeta({ title: "Reset password", noIndex: true }),
	onboarding: createHeadMeta({ title: "Get started", noIndex: true }),
	billingVerify: createHeadMeta({ title: "Verifying payment", noIndex: true }),
} as const;

/**
 * Build TanStack Start head() metadata for a campaign detail page.
 */
export function campaignHeadMeta({
	name,
	id,
	totalContacts,
	status,
}: {
	name: string;
	id: string;
	totalContacts: number;
	status: string;
}): HeadMeta {
	return createHeadMeta({
		title: name,
		description: `${status === "completed" ? "Completed" : "Active"} campaign to ${totalContacts.toLocaleString()} contacts`,
		canonicalPath: `/campaigns/${id}`,
		noIndex: true,
	});
}

/**
 * Build TanStack Start head() metadata for a template edit page.
 */
export function templateHeadMeta({
	name,
	id,
	channel,
}: {
	name: string;
	id: string;
	channel: "whatsapp" | "sms";
}): HeadMeta {
	return createHeadMeta({
		title: `${name} — ${channel === "whatsapp" ? "WhatsApp" : "SMS"} Template`,
		description: `Edit the "${name}" ${channel === "whatsapp" ? "WhatsApp" : "SMS"} message template`,
		canonicalPath: `/templates/${channel}/${id}`,
		noIndex: true,
	});
}
