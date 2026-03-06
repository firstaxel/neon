import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";

export type { WaButton } from "../category/whatsapp/templates";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type WaHeaderFormat =
	| "TEXT"
	| "IMAGE"
	| "VIDEO"
	| "DOCUMENT"
	| "LOCATION";
export type WaTemplateStatus =
	| "DRAFT"
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "PAUSED"
	| "DISABLED";

export interface WaTemplateButton {
	example?: string[];
	phoneNumber?: string;
	text: string;
	type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
	url?: string;
}

export interface WaTemplate {
	approvedAt: string | null;

	bodyText: string;
	bodyVars: string[];
	buttons: WaTemplateButton[];
	category: WaCategory;

	channel: "whatsapp" | "sms";
	createdAt: string;
	displayName: string;

	footerText: string | null;

	headerFormat: string | null;
	headerText: string | null;
	headerVars: string[];
	id: string;
	language: string;
	lastUsedAt: string | null;
	name: string;
	rejectionReason: string | null;
	smsBody: string;
	smsVars: string[];
	status: WaTemplateStatus;
	submittedAt: string | null;
	updatedAt: string;

	usageCount: number;
	waTemplateId: string | null;
}

export interface WaTemplateFormValues {
	bodyText: string;
	bodyVars: string[];
	buttons: WaTemplateButton[];
	category: WaCategory;
	channel: "whatsapp" | "sms";
	displayName: string;
	footerText: string;
	headerFormat: WaHeaderFormat | null;
	headerText: string;
	headerVars: string[];
	language: string;
	name: string;
	smsBody?: string;
	smsVars?: string[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useTemplates(opts?: {
	status?: WaTemplateStatus;
	category?: WaCategory;
	channel?: "whatsapp" | "sms";
	search?: string;
}) {
	return useQuery(
		orpc.template.list.queryOptions({
			queryKey: [
				"templates",
				opts?.status,
				opts?.category,
				opts?.channel,
				opts?.search,
			],
			input: {
				status: opts?.status ? opts?.status : undefined,
				category: opts?.category ? opts.category : undefined,
				channel: opts?.channel ?? undefined,
				search: opts?.search ?? undefined,
			},
			staleTime: 15_000,
		})
	);
}

export function useTemplate(id: string | null) {
	return useQuery(
		orpc.template.get.queryOptions({
			queryKey: ["template", id],
			input: { id: id ?? "" },
			enabled: !!id,
			staleTime: 5000,
		})
	);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateTemplate() {
	const qc = useQueryClient();
	return useMutation(
		orpc.template.create.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
		})
	);
}

export function useUpdateTemplate() {
	const qc = useQueryClient();
	return useMutation(
		orpc.template.update.mutationOptions({
			onSuccess: (_, vars) => {
				qc.invalidateQueries({ queryKey: ["templates"] });
				qc.invalidateQueries({ queryKey: ["template", vars.id] });
			},
		})
	);
}

export function useDeleteTemplate() {
	const qc = useQueryClient();
	return useMutation(
		orpc.template.delete.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
		})
	);
}

export function useSubmitTemplate() {
	const qc = useQueryClient();
	return useMutation(
		orpc.template.submit.mutationOptions({
			onSuccess: (_, id) => {
				qc.invalidateQueries({ queryKey: ["templates"] });
				qc.invalidateQueries({ queryKey: ["template", id] });
			},
		})
	);
}

export function useSyncTemplateStatus() {
	const qc = useQueryClient();
	return useMutation(
		orpc.template.syncStatus.mutationOptions({
			onSuccess: (_, id) => {
				qc.invalidateQueries({ queryKey: ["templates"] });
				qc.invalidateQueries({ queryKey: ["template", id] });
			},
		})
	);
}

export function useRecordTemplateUsage() {
	const qc = useQueryClient();
	return useMutation(
		orpc.template.recordUsage.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
		})
	);
}
