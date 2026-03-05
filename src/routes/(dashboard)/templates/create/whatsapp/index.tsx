import { createFileRoute } from "@tanstack/react-router";
import { WaTemplateCreateView } from "#/features/templates/view/whatsapp-create-view";

export const Route = createFileRoute("/(dashboard)/templates/create/whatsapp/")(
	{
		component: RouteComponent,
	}
);

function RouteComponent() {
	return <WaTemplateCreateView />;
}
