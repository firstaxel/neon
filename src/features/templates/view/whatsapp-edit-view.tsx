import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "#/components/shared/page-header";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { WaTemplateEditor } from "#/features/templates/components/whatsapp-template-editor";
import type { WaTemplateFormValues } from "#/features/templates/hooks/use-templates";
import {
	useTemplate,
	useUpdateTemplate,
} from "#/features/templates/hooks/use-templates";

export function WaTemplateEditView({ id }: { id: string }) {
	const router = useRouter();
	const { data: template, isLoading } = useTemplate(id);
	const { mutateAsync: update, isPending } = useUpdateTemplate();

	const navigateBack = () => {
		router.navigate({
			search: { channel: "whatsapp" },
			to: "/templates",
		});
	};

	async function handleSave(values: WaTemplateFormValues) {
		try {
			await update({ id, ...values, smsBody: values.smsBody ?? "" });
			toast.success("Template saved", {
				description: `"${values.displayName}" updated.`,
			});
			navigateBack();
		} catch (e) {
			toast.error("Error", {
				description: (e as Error).message,
			});
		}
	}

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-6xl px-4 py-8">
				<Skeleton className="mb-6 h-8 w-48" />
				<Skeleton className="mb-8 h-6 w-72" />
				<div className="space-y-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton className="h-16 w-full rounded-xl" key={i.toString()} />
					))}
				</div>
			</div>
		);
	}

	if (!template) {
		return (
			<div className="mx-auto w-full max-w-6xl px-4 py-20 text-center text-muted-foreground">
				Template not found.{" "}
				<Button onClick={navigateBack} variant="link">
					Go back
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-8">
			<div className="mb-6 flex items-center gap-3">
				<Button
					className="gap-1.5 rounded-xl"
					onClick={navigateBack}
					size="sm"
					variant="ghost"
				>
					<ArrowLeft className="h-4 w-4" /> Back to templates
				</Button>
			</div>
			<PageHeader
				description={`Editing WhatsApp template · ${template.name}`}
				title={template.displayName}
			/>
			<div className="mt-6">
				<WaTemplateEditor
					isSaving={isPending}
					onCancel={navigateBack}
					onSave={handleSave}
					template={template}
				/>
			</div>
		</div>
	);
}
