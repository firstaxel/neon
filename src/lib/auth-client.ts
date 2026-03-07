import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "#/env";

/**
 * Better Auth browser client.
 *
 * Provides fully typed hooks and methods for all auth flows.
 * Import from this file everywhere in client components — never import
 * directly from better-auth to ensure plugins are consistently registered.
 *
 * Usage:
 *   const { data: session } = authClient.useSession();
 *   await authClient.signIn.email({ email, password });
 *   await authClient.signIn.magicLink({ email });
 *   await authClient.signIn.social({ provider: "google" });
 *   await authClient.signOut();
 */
export const authClient = createAuthClient({
	baseURL: env.VITE_CLIENT_URL,
	plugins: [magicLinkClient()],
});

// Re-export commonly used hooks for ergonomic imports
export const { useSession, signIn, signOut, signUp } = authClient;
