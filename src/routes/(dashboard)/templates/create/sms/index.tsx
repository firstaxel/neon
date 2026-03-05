import { createFileRoute } from "@tanstack/react-router";
import { SmsTemplateCreateView } from "#/features/templates/view/sms-create-view";

export const Route = createFileRoute("/(dashboard)/templates/create/sms/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <SmsTemplateCreateView />;
}
