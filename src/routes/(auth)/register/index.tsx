import { createFileRoute } from "@tanstack/react-router";
import RegisterView from "#/features/auth/components/register-view";

export const Route = createFileRoute("/(auth)/register/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <RegisterView />;
}
