"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScenarioId } from "#/lib/types";
import { orpc } from "#/orpc/client";

export interface CampaignPayload {
	contacts: Array<{
		id: string;
		name: string;
		phone: string;
		channel: "whatsapp" | "sms";
		type: string;
	}>;
	customTemplate?: { whatsapp: string; sms: string };
	scenario: ScenarioId;
	useCustom: boolean;
}

export function useSendCampaign() {
	const queryClient = useQueryClient();

	return useMutation(
		orpc.campaign.send.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			},
		})
	);
}

export function useCampaigns() {
	return useQuery(
		orpc.campaign.list.queryOptions({
			queryKey: ["campaigns"],
			input: {
				limit: 10,
			},
			staleTime: 10_000,
		})
	);
}

export function useCampaignStatus(campaignId: string | null) {
	return useQuery(
		orpc.campaign.getStatus.queryOptions({
			queryKey: ["campaignStatus", campaignId],
			input: {
				campaignId: campaignId ?? "",
			},
			enabled: !!campaignId,
			refetchInterval: ({ state }) => {
				const status = state.data?.status;
				return status === "completed" || status === "failed" ? false : 2000;
			},
		})
	);
}
