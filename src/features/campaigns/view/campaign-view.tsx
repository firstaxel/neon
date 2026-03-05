/**
 * CampaignsView  —  /campaigns
 *
 * URL state (nuqs):
 *   ?new=1    open the wizard automatically
 *
 * After wizard submits → redirects to /campaigns/[id]
 * History rows link to /campaigns/[id]
 */

import { useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "#/components/shared/page-header";
import { CampaignHistory } from "#/features/campaigns/components/campaign-history";

export function CampaignsView() {
	const router = useRouter();

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-8">
			<PageHeader
				action={{
					label: "New Campaign",
					icon: <Plus size={15} />,
					onClick: () => {
						router.navigate({
							to: "/campaigns/create",
						});
					},
				}}
				description="Create outreach campaigns and track their progress."
				title="Campaigns"
			/>

			<div className="mt-7">
				<CampaignHistory />
			</div>
		</div>
	);
}
