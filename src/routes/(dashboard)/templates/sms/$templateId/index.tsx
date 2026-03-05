import { createFileRoute } from "@tanstack/react-router";
import { SmsTemplateEditView } from "#/features/templates/view/sms-template-edit";

export const Route = createFileRoute("/(dashboard)/templates/sms/$templateId/")(
	{
		component: RouteComponent,
	}
);

function RouteComponent() {
	const { templateId } = Route.useParams();
	return <SmsTemplateEditView id={templateId} />;
}
