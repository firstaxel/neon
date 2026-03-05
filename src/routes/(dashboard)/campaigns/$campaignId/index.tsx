import { createFileRoute } from "@tanstack/react-router";
import { CampaignDetailView } from "#/features/campaigns/view/campaign-detail-view";

export const Route = createFileRoute("/(dashboard)/campaigns/$campaignId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { campaignId } = Route.useParams();
	return <CampaignDetailView campaignId={campaignId} />;
}
