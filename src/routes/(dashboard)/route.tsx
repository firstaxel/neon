import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "#/components/ui/sidebar";
import { AppSidebar } from "#/features/dashboard/components/app-sidebar";
import { DashboardTopbar } from "#/features/dashboard/components/dashboard-topbar";
import { useOnboardingGuard } from "#/features/profile/hooks/use-onboarding-guard";
import { authMiddleware } from "#/middleware/auth";

export const Route = createFileRoute("/(dashboard)")({
	component: RouteComponent,
	server: {
		middleware: [authMiddleware],
	},
});

function RouteComponent() {
	useOnboardingGuard();
	return (
		<SidebarProvider defaultOpen={true}>
			<AppSidebar />
			<SidebarInset>
				<DashboardTopbar />
				<div className="w-full flex-1">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
