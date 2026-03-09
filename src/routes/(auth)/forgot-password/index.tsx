import { createFileRoute } from "@tanstack/react-router";
import ForgotPasswordView from "#/features/auth/components/forgot-password-view";

export const Route = createFileRoute("/(auth)/forgot-password/")({
	component: ForgotPasswordView,
});
