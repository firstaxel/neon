"use client";

import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "#/components/shared/page-header";
import { Button } from "#/components/ui/button";
import { SmsOnlyTemplateEditor } from "#/features/templates/components/sms-template-editor";
import type { WaTemplateFormValues } from "#/features/templates/hooks/use-templates";
import { useCreateTemplate } from "#/features/templates/hooks/use-templates";

export function SmsTemplateCreateView() {
	const router = useRouter();
	const { mutateAsync: create, isPending } = useCreateTemplate();

	async function handleSave(values: WaTemplateFormValues) {
		try {
			await create(values);
			toast.success("SMS template created", {
				description: `"${values.displayName}" is ready to use.`,
			});
			router.navigate({
				to: "/templates",
				search: {
					channel: "sms",
				},
			});
		} catch (e) {
			toast.error("Error", {
				description: (e as Error).message,
			});
		}
	}

	return (
		<div style={{ padding: "32px 28px", maxWidth: 860, margin: "0 auto" }}>
			<div className="mb-6 flex items-center gap-3">
				<Button
					className="gap-1.5 rounded-xl"
					onClick={() =>
						router.navigate({
							to: "/templates",
							search: {
								channel: "sms",
							},
						})
					}
					size="sm"
					variant="ghost"
				>
					<ArrowLeft className="h-4 w-4" /> Back to templates
				</Button>
			</div>
			<PageHeader
				description="Create a reusable SMS message with dynamic variables. Ready to use immediately."
				title="New SMS template"
			/>
			<div className="mt-6">
				<SmsOnlyTemplateEditor
					isSaving={isPending}
					onCancel={() =>
						router.navigate({
							to: "/templates",
							search: {
								channel: "sms",
							},
						})
					}
					onSave={handleSave}
				/>
			</div>
		</div>
	);
}
