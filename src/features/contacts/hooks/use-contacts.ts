"use client";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";

export type ContactChannel = "whatsapp" | "sms";
export type ContactType = "first_timer" | "returning" | "member" | "visitor";

export interface ContactFilters {
	channel?: ContactChannel;
	page?: number;
	pageSize?: number;
	parseJobId?: string;
	search?: string;
	type?: ContactType;
}

export function useContacts(filters: ContactFilters = {}) {
	return useQuery(
		orpc.contacts.listContacts.queryOptions({
			queryKey: ["contacts", filters],
			input: {
				search: filters.search || undefined,
				channel: filters.channel || undefined,
				type: filters.type || undefined,
				parseJobId: filters.parseJobId || undefined,
				page: filters.page ?? 1,
				pageSize: filters.pageSize ?? 20,
			},
			placeholderData: (prev) => prev,
			staleTime: 30_000,
		})
	);
}

export function useContact(id: string | null) {
	return useQuery(
		orpc.contacts.get.queryOptions({
			queryKey: ["contact", id],
			input: { id: id ?? "" },
			enabled: !!id,
		})
	);
}
