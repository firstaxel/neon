import { createFileRoute } from "@tanstack/react-router";
import { TemplatesView } from "#/features/templates/view/template-view";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/(dashboard)/templates/")({
	component: RouteComponent,
	head: () => ({
		meta: [pageHeadMeta.templates],
	}),
});

function RouteComponent() {
	return <TemplatesView />;
}
