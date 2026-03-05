import { createFileRoute } from "@tanstack/react-router";
import { CampaignsView } from "#/features/campaigns/view/campaign-view";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/(dashboard)/campaigns/")({
	component: RouteComponent,
	head: () => ({
		meta: [pageHeadMeta.campaigns],
	}),
});

function RouteComponent() {
	return <CampaignsView />;
}
