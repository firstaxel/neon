// ─── Site config ──────────────────────────────────────────────────────────────

import { env } from "#/env";

export const siteConfig = {
	description:
		"Send personalised WhatsApp and SMS campaigns to your entire contact list — tracked, fast, and affordable.",
	locale: "en_NG",
	name: "Velocast",
	ogImage: "/og.png",
	tagline: "Messaging Console",
	themeColor: "#25d366",
	twitterHandle: "@Velocast",
	url: env.VITE_CLIENT_URL ?? "https://Velocast.app",
} as const;

// ─── Page-title template ──────────────────────────────────────────────────────

/**
 * Formats a browser tab title.
 *   "Campaigns"         → "Campaigns —  Velocast"
 *   undefined           → " Velocast — Church & NGO Messaging Console"
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
	/** Short page title. Appended with " —  Velocast". Omit for the home title. */
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
	"Velocast",
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
		{ content: "width=device-width, initial-scale=1", name: "viewport" },
		{ content: resolvedDescription, name: "description" },
		{ content: allKeywords.join(", "), name: "keywords" },
		{ content: siteConfig.name, name: "author" },
		{ content: siteConfig.themeColor, name: "theme-color" },
		{ content: "en-NG", httpEquiv: "content-language" },
	];

	if (noIndex) {
		meta.push({ content: "noindex, nofollow", name: "robots" });
	} else {
		meta.push({ content: "index, follow", name: "robots" });

		// OpenGraph
		meta.push(
			{ content: "website", property: "og:type" },
			{ content: canonicalUrl, property: "og:url" },
			{ content: siteConfig.name, property: "og:site_name" },
			{ content: resolvedTitle, property: "og:title" },
			{ content: resolvedDescription, property: "og:description" },
			{ content: ogImageUrl, property: "og:image" },
			{ content: "1200", property: "og:image:width" },
			{ content: "630", property: "og:image:height" },
			{ content: resolvedTitle, property: "og:image:alt" },
			{ content: siteConfig.locale, property: "og:locale" }
		);

		// Twitter card
		meta.push(
			{ content: "summary_large_image", name: "twitter:card" },
			{ content: siteConfig.twitterHandle, name: "twitter:site" },
			{ content: siteConfig.twitterHandle, name: "twitter:creator" },
			{ content: resolvedTitle, name: "twitter:title" },
			{ content: resolvedDescription, name: "twitter:description" },
			{ content: ogImageUrl, name: "twitter:image" }
		);
	}

	const links: HeadMeta["links"] = [
		{ href: "/favicon.ico", rel: "icon" },
		{ href: "/icon.png", rel: "icon", type: "image/png" },
		{ href: "/apple-icon.png", rel: "apple-touch-icon", sizes: "180x180" },
		{ href: "/manifest.json", rel: "manifest" },
		...(canonicalPath && !noIndex
			? [{ href: canonicalUrl, rel: "canonical" }]
			: []),
	];

	return { links, meta, title: resolvedTitle };
}

/**
 * TanStack Start equivalents of pageMetadata — same pages, same options,
 * correct output shape for head() exports.
 */
export const pageHeadMeta = {
	billing: createHeadMeta({
		canonicalPath: "/billing",
		description:
			"Manage your wallet, subscription plan, and transaction history",
		noIndex: true,
		title: "Billing",
	}),
	billingVerify: createHeadMeta({ noIndex: true, title: "Verifying payment" }),

	campaigns: createHeadMeta({
		canonicalPath: "/campaigns",
		description: "Create and manage your WhatsApp and SMS messaging campaigns",
		keywords: ["campaign", "send messages", "bulk messaging"],
		title: "Campaigns",
	}),

	contacts: createHeadMeta({
		canonicalPath: "/contacts",
		description:
			"Manage your congregation or contact list for messaging campaigns",
		keywords: ["contacts", "congregation", "members", "contact list"],
		title: "Contacts",
	}),

	dashboard: createHeadMeta({
		canonicalPath: "/dashboard",
		description: "Overview of your campaigns, contacts, and wallet balance",
		keywords: ["dashboard", "analytics", "overview"],
		title: "Dashboard",
	}),
	home: createHeadMeta({ canonicalPath: "/" }),

	login: createHeadMeta({ noIndex: true, title: "Sign in" }),

	messages: createHeadMeta({
		canonicalPath: "/messages",
		description: "View all sent, pending, and failed messages across campaigns",
		keywords: ["messages", "delivery", "inbox", "WhatsApp", "SMS"],
		title: "Messages",
	}),
	onboarding: createHeadMeta({ noIndex: true, title: "Get started" }),
	register: createHeadMeta({ noIndex: true, title: "Create account" }),
	resetPassword: createHeadMeta({ noIndex: true, title: "Reset password" }),

	settings: createHeadMeta({
		canonicalPath: "/settings",
		description: "Update your profile, organisation details, and password",
		noIndex: true,
		title: "Account Settings",
	}),

	templates: createHeadMeta({
		canonicalPath: "/templates",
		description:
			"Create and manage reusable WhatsApp and SMS message templates",
		keywords: ["templates", "WhatsApp templates", "SMS templates"],
		title: "Templates",
	}),
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
		canonicalPath: `/campaigns/${id}`,
		description: `${status === "completed" ? "Completed" : "Active"} campaign to ${totalContacts.toLocaleString()} contacts`,
		noIndex: true,
		title: name,
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
		canonicalPath: `/templates/${channel}/${id}`,
		description: `Edit the "${name}" ${channel === "whatsapp" ? "WhatsApp" : "SMS"} message template`,
		noIndex: true,
		title: `${name} — ${channel === "whatsapp" ? "WhatsApp" : "SMS"} Template`,
	});
}
