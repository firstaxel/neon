import { createFileRoute, Outlet } from "@tanstack/react-router";
import { authMiddleware } from "#/middleware/auth";

export const Route = createFileRoute("/(auth)")({
	component: RouteComponent,
	server: {
		middleware: [authMiddleware],
	},
});

function RouteComponent() {
	return (
		<main className="relative flex min-h-svh w-full items-center justify-center bg-background p-4 sm:p-6 md:p-8">
			{/* Subtle ambient lighting */}
			<div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
				<div className="size-[560px] rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
			</div>
			<div className="w-full max-w-sm">
				<Outlet />
			</div>
		</main>
	);
}
