import { createFileRoute } from "@tanstack/react-router";
import OnboardingView from "#/features/profile/views/onboarding-view";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/(dashboard)/onboarding/")({
	component: RouteComponent,
	head: () => ({
		meta: [pageHeadMeta.onboarding],
	}),
});

function RouteComponent() {
	return <OnboardingView />;
}
