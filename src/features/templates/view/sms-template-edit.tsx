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
			await update({ id, ...values, smsBody: values.smsBody ?? "" });
			toast.success("Template saved", {
				description: `"${values.displayName}" updated.`,
			});
			router.navigate({
				search: {
					channel: "sms",
				},
				to: "/templates",
			});
		} catch (e) {
			toast("Error", {
				description: (e as Error).message,
			});
		}
	}

	if (isLoading) {
		return (
			<div style={{ margin: "0 auto", maxWidth: 860, padding: "32px 28px" }}>
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
							search: {
								channel: "sms",
							},
							to: "/templates",
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
		<div style={{ margin: "0 auto", maxWidth: 860, padding: "32px 28px" }}>
			<div className="mb-6 flex items-center gap-3">
				<Button
					className="gap-1.5 rounded-xl"
					onClick={() =>
						router.navigate({
							search: {
								channel: "sms",
							},
							to: "/templates",
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
							search: {
								channel: "sms",
							},
							to: "/templates",
						})
					}
					onSave={handleSave}
					template={template}
				/>
			</div>
		</div>
	);
}
