import { createFileRoute } from "@tanstack/react-router";
import { WaTemplateEditView } from "#/features/templates/view/whatsapp-edit-view";

export const Route = createFileRoute(
	"/(dashboard)/templates/whatsapp/$templateId/"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { templateId } = Route.useParams();
	return <WaTemplateEditView id={templateId} />;
}
