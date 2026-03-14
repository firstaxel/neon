import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import RegisterView from "#/features/auth/components/register-view";

export const registerRouteSchema = z.object({
	callbackURL: z.string().optional(),
});

export const Route = createFileRoute("/(auth)/register/")({
	component: RouteComponent,
	validateSearch: registerRouteSchema,
});

function RouteComponent() {
	const { callbackURL } = Route.useSearch();
	return <RegisterView callbackURL={callbackURL} />;
}
