import { createFileRoute } from "@tanstack/react-router";
import { CampaignView } from "#/features/camapigns/view/campaign-view";

export const Route = createFileRoute("/(dashboard)/campaigns/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <CampaignView />;
}
