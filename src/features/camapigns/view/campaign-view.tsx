import { PlusCircle } from "lucide-react";
import { PageHeader } from "#/components/shared/page-header";
import { CampaignHistory } from "../components/campaign-history";

export function CampaignView() {
	return (
		<div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
			<PageHeader
				action={{
					label: "Create Campaign",
					icon: <PlusCircle className="h-4 w-4" />,
					href: "/campaigns/create",
				}}
				description="View and create new campaigns to send messages to contacts"
				title="Campaigns"
			/>
			<CampaignHistory />
		</div>
	);
}
