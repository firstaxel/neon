import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import LoginView from "#/features/auth/components/login-view";

export const loginRouteSchema = z.object({
	callbackURL: z.string().optional(),
});

export const Route = createFileRoute("/(auth)/login/")({
	component: RouteComponent,
	validateSearch: loginRouteSchema,
});

function RouteComponent() {
	const { callbackURL } = Route.useSearch();
	return <LoginView callbackURL={callbackURL} />;
}
