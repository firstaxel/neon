import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";

export type ContactChannel = "whatsapp" | "sms";
export type ContactType = "new_contact" | "returning" | "contact" | "prospect";

export interface ContactFilters {
	channel?: ContactChannel;
	duplicatesOnly?: boolean;
	page?: number;
	pageSize?: number;
	parseJobId?: string;
	search?: string;
	type?: ContactType;
}

export function useContacts(filters: ContactFilters = {}) {
	return useQuery(
		orpc.contacts.list.queryOptions({
			input: {
				channel: filters.channel || undefined,
				duplicatesOnly: filters.duplicatesOnly,
				page: filters.page ?? 1,
				pageSize: filters.pageSize ?? 20,
				parseJobId: filters.parseJobId || undefined,
				search: filters.search || undefined,
				type: filters.type || undefined,
			},
			placeholderData: (prev) => prev,
			queryKey: ["contacts", filters],
			staleTime: 30_000,
		})
	);
}

export function useContact(id: string | null) {
	return useQuery(
		orpc.contacts.get.queryOptions({
			enabled: !!id,
			input: { id: id ?? "" },
			queryKey: ["contact", id],
		})
	);
}

export function useCreateContact() {
	const queryClient = useQueryClient();
	return useMutation({
		...orpc.contacts.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["contacts"] });
		},
	});
}
