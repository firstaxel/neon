import { createFileRoute } from "@tanstack/react-router";
import ContactsListView from "#/features/contacts/views/contact-list-view";

export const Route = createFileRoute("/(dashboard)/contacts/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <ContactsListView />;
}
