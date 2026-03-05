/**
 * useOnboardingGuard
 *
 * Client-side guard that redirects to /onboarding when the user's profile
 * isn't complete. Use this in layout components or page components — NOT
 * in middleware (middleware runs on the edge and can't do DB calls).
 *
 * Usage in a layout or page:
 *
 *   export default function DashboardLayout({ children }) {
 *     useOnboardingGuard();
 *     return <>{children}</>;
 *   }
 *
 * It does nothing while the profile is still loading (avoids flash-redirects).
 * It also does nothing on exempt paths (/onboarding itself, /billing/verify, /settings).
 */

import { useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "./use-profile";

const EXEMPT_PREFIXES = [
	"/onboarding",
	"/billing/verify",
	"/settings",
	"/login",
	"/register",
];

export function useOnboardingGuard() {
	const router = useRouter();
	const location = useLocation();
	const { data: profile, isLoading } = useProfile();

	const pathname = location.pathname;

	useEffect(() => {
		if (isLoading) {
			return;
		}
		if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
			return;
		}
		if (profile && !profile.onboardingComplete) {
			router.navigate({
				to: "/onboarding",
			});
		}
	}, [isLoading, profile, pathname, router]);
}
