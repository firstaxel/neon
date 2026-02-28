import { createFileRoute, Outlet } from "@tanstack/react-router";
import AnimatedHeader from "#/features/dashboard/components/header";
import { authMiddleware } from "#/middleware/auth";

export const Route = createFileRoute("/(dashboard)")({
	component: RouteComponent,
	server: {
		middleware: [authMiddleware],
	},
});

function RouteComponent() {
	return (
		<main className="flex w-full flex-col items-center">
			<AnimatedHeader />
			<Outlet />
		</main>
	);
}
