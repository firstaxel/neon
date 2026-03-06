import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "#/features/messages/view/message-view";

export const Route = createFileRoute("/(dashboard)/messages/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <MessagesView />;
}
