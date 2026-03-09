import { createFileRoute } from "@tanstack/react-router";
import ResetPasswordView from "#/features/auth/components/reset-password-view";

export const Route = createFileRoute("/(auth)/reset-password/")({
	component: ResetPasswordView,
});
