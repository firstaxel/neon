import { createMiddleware } from "@tanstack/react-start";
import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "#/lib/auth";

// ─── Route classification ──────────────────────────────────────────────────────

/**
 * Public paths — no session required.
 * Authenticated users are bounced away from these back into the app.
 */
const PUBLIC_PATHS = new Set([
	"/login",
	"/register",
	"/verify-email",
	"/reset-password",
]);

/**
 * Prefixes that are never intercepted — infrastructure that handles
 * its own auth or is inherently public.
 */
const BYPASS_PREFIXES = [
	"/api/auth", // Better Auth — manages its own tokens
	"/api/inngest", // Inngest webhook — signed with INNGEST_SIGNING_KEY
	"/_build", // TanStack Start build assets
	"/favicon",
	"/robots.txt",
	"/sitemap",
];

// ─── Security headers ──────────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Only allow same-origin relative paths — never external URLs. */
function isSafeRedirect(url: string | null | undefined): url is string {
	return (
		typeof url === "string" && url.startsWith("/") && !url.startsWith("//")
	);
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * authMiddleware — TanStack Start server middleware.
 *
 * Uses Better Auth's `getSessionCookie` to read the signed session cookie
 * with zero DB calls, making it safe as an always-on guard.
 *
 * Behaviour:
 *   Bypass prefixes        → pass through, apply security headers
 *   No session + protected → 302 → /login?callbackURL=<pathname>
 *   Session + public path  → 302 → / (or ?callbackURL if safe)
 *   Session + protected    → inject `isAuthenticated` into context
 *
 * Apply to any route file:
 *
 *   import { authMiddleware } from "@/middleware/auth";
 *
 *   export const Route = createFileRoute("/dashboard")({
 *     middleware: [authMiddleware],
 *     loader: async ({ context }) => {
 *       // context.isAuthenticated === true guaranteed here
 *       const session = await requireSession(); // full user if needed
 *       return { user: session.user };
 *     },
 *   });
 */
export const authMiddleware = createMiddleware().server(({ next }) => {
	const request = getRequest();
	const url = new URL(request.url);
	const { pathname, searchParams } = url;

	// 1. Bypass infrastructure — pass through with security headers only
	if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return next({
			context: { isAuthenticated: false, sessionCookie: null },
		});
	}

	// 2. Read session cookie — zero DB calls, edge-safe
	const sessionCookie = getSessionCookie(request, {
		cookiePrefix: "neon", // must match auth.ts → advanced.cookiePrefix
	});

	const isAuthenticated = !!sessionCookie;
	const isPublicPath = PUBLIC_PATHS.has(pathname);

	// 3. Unauthenticated on a protected route → redirect to /login
	if (!(isAuthenticated || isPublicPath)) {
		const loginUrl = new URL("/login", url.origin);

		if (isSafeRedirect(pathname) && pathname !== "/") {
			loginUrl.searchParams.set("callbackURL", pathname);
		}

		throw new Response(null, {
			status: 302,
			headers: { Location: loginUrl.toString(), ...SECURITY_HEADERS },
		});
	}

	// 4. Authenticated on a public/auth page → redirect into the app
	if (isAuthenticated && isPublicPath) {
		const callbackParam = searchParams.get("callbackURL");
		const destination = isSafeRedirect(callbackParam) ? callbackParam : "/";

		throw new Response(null, {
			status: 302,
			headers: {
				Location: new URL(destination, url.origin).toString(),
				...SECURITY_HEADERS,
			},
		});
	}

	// 5. Authenticated on a protected route — continue, inject context
	return next({
		context: { isAuthenticated, sessionCookie },
	});
});

// ─── requireSession ────────────────────────────────────────────────────────────

/**
 * Resolve the full Better Auth session inside a loader.
 * Only call this when you need the user record — it makes a DB round-trip.
 * The middleware's cookie check is enough to gate access cheaply.
 *
 * Usage:
 *   loader: async () => {
 *     const { user } = await requireSession();
 *     return { user };
 *   },
 */
export async function requireSession() {
	const headers = getRequestHeaders();

	const sessionData = await auth.api.getSession({
		headers,
	});

	if (!sessionData) {
		throw new Response(null, {
			status: 302,
			headers: { Location: "/login" },
		});
	}

	return sessionData;
}

// ─── Context type ──────────────────────────────────────────────────────────────

/**
 * Extend your router context in `createRouter()` with this type
 * so route loaders and components get typed context:
 *
 *   // src/router.ts
 *   import type { AuthContext } from "@/middleware/auth";
 *
 *   export function createRouter() {
 *     return createTanStackRouter({
 *       routeTree,
 *       context: {} as AuthContext,
 *     });
 *   }
 */
export interface AuthContext {
	isAuthenticated: boolean;
	sessionCookie: string | null;
}
