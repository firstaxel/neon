import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "#/features/profile/views/settings-view";

export const Route = createFileRoute("/(dashboard)/settings/")({
	component: SettingsView,
});
