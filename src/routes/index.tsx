/**
 * src/routes/index.tsx — Velocast public landing page
 *
 * Features:
 *  - Full light / dark mode via useTheme() + ThemeToggle
 *  - Fully responsive: mobile (< 768), tablet (< 1024), desktop
 *  - Design tokens adapt per-theme while preserving the premium SaaS aesthetic
 */

import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "#/features/home/homepage-responsive";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => {
		return {
			meta: [pageHeadMeta.home],
		};
	},
});
