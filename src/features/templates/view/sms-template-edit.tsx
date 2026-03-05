import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "#/components/shared/page-header";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { SmsOnlyTemplateEditor } from "#/features/templates/components/sms-template-editor";
import type { WaTemplateFormValues } from "#/features/templates/hooks/use-templates";
import {
	useTemplate,
	useUpdateTemplate,
} from "#/features/templates/hooks/use-templates";

export function SmsTemplateEditView({ id }: { id: string }) {
	const router = useRouter();
	const { data: template, isLoading } = useTemplate(id);
	const { mutateAsync: update, isPending } = useUpdateTemplate();

	async function handleSave(values: WaTemplateFormValues) {
		try {
			await update({ id, ...values });
			toast.success("Template saved", {
				description: `"${values.displayName}" updated.`,
			});
			router.navigate({
				to: "/templates",
				search: {
					channel: "sms",
				},
			});
		} catch (e) {
			toast("Error", {
				description: (e as Error).message,
			});
		}
	}

	if (isLoading) {
		return (
			<div style={{ padding: "32px 28px", maxWidth: 860, margin: "0 auto" }}>
				<Skeleton className="mb-6 h-8 w-48" />
				<Skeleton className="mb-8 h-6 w-64" />
				<div className="space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton className="h-16 w-full rounded-xl" key={i.toString()} />
					))}
				</div>
			</div>
		);
	}

	if (!template) {
		return (
			<div
				className="text-center text-muted-foreground"
				style={{ padding: "32px 28px" }}
			>
				Template not found.{" "}
				<Button
					onClick={() =>
						router.navigate({
							to: "/templates",
							search: {
								channel: "sms",
							},
						})
					}
					variant="link"
				>
					Go back
				</Button>
			</div>
		);
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
				description="Editing SMS template"
				title={template.displayName}
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
					template={template}
				/>
			</div>
		</div>
	);
}
