import { createFileRoute } from "@tanstack/react-router";
import { CampaignWizardView } from "#/features/camapigns/view/campaign-wizard-view";

export const Route = createFileRoute("/(dashboard)/campaigns/create/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <CampaignWizardView />;
}
