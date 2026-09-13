import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import VerifyEmailView from "#/features/auth/components/verify-email-view";

export const verifyEmailRouteSchema = z.object({
	email: z.string().optional(),
	error: z.string().optional(),
});

export const Route = createFileRoute("/(auth)/verify-email/")({
	component: RouteComponent,
	validateSearch: verifyEmailRouteSchema,
});

function RouteComponent() {
	const { email, error } = Route.useSearch();
	return <VerifyEmailView email={email} error={error} />;
}
