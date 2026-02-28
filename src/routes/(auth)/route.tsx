import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<main className="container mx-auto">
			<Outlet />
		</main>
	);
}
