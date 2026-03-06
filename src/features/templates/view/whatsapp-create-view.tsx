import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "#/components/shared/page-header";
import { Button } from "#/components/ui/button";
import { WaTemplateEditor } from "#/features/templates/components/whatsapp-template-editor";
import type { WaTemplateFormValues } from "#/features/templates/hooks/use-templates";
import { useCreateTemplate } from "#/features/templates/hooks/use-templates";

export function WaTemplateCreateView() {
	const router = useRouter();
	const { mutateAsync: create, isPending } = useCreateTemplate();

	async function handleSave(values: WaTemplateFormValues) {
		try {
			const result = await create({
				...values,
				channel: "whatsapp",
				smsBody: "",
				smsVars: [],
			});
			toast.success("Template created", {
				description: `"${values.displayName}" saved as draft.`,
			});
			router.navigate({
				to: `/templates/whatsapp/${result.id}`,
			});
		} catch (e) {
			toast("Error", {
				description: (e as Error).message,
			});
		}
	}

	return (
		<div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
			<div className="mb-6 flex items-center gap-3">
				<Button
					className="gap-1.5 rounded-xl"
					onClick={() =>
						router.navigate({
							to: "/templates",
							search: {
								channel: "whatsapp",
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
				description="Build a template for Meta approval. Once approved it can be used in campaigns."
				title="New WhatsApp template"
			/>
			<div className="mt-6">
				<WaTemplateEditor
					isSaving={isPending}
					onCancel={() =>
						router.navigate({
							to: "/templates",
							search: {
								channel: "whatsapp",
							},
						})
					}
					onSave={handleSave}
				/>
			</div>
		</div>
	);
}
