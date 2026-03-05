import { createFileRoute } from "@tanstack/react-router";
import { BillingView } from "#/features/billing/views/billing-view";

export const Route = createFileRoute("/(dashboard)/billing/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <BillingView />;
}
