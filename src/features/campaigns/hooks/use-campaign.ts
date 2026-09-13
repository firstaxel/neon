import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScenarioId } from "#/lib/types";
import { orpc } from "#/orpc/client";

export interface CampaignPayload {
	contacts: Array<{
		channel: "whatsapp" | "sms";
		id: string;
		name: string;
		phone: string;
		type: string;
	}>;
	customTemplate?: { sms: string; whatsapp: string };
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

export function useEstimateCampaignCost() {
	return useMutation(orpc.campaign.estimateCost.mutationOptions());
}

export function useCreateSmsCampaign() {
	const queryClient = useQueryClient();

	return useMutation(
		orpc.campaign.createSmsCampaign.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["wallet"] });
			},
		})
	);
}

export function useEstimateWhatsappCost() {
	return useMutation(orpc.campaign.estimateWhatsappCost.mutationOptions());
}

export function useCreateWhatsappCampaign() {
	const queryClient = useQueryClient();

	return useMutation(
		orpc.campaign.createWhatsappCampaign.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["wallet"] });
			},
		})
	);
}

export function useCancelScheduledCampaign() {
	const queryClient = useQueryClient();

	return useMutation(
		orpc.campaign.cancelScheduledCampaign.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["campaignStatus"] });
				queryClient.invalidateQueries({ queryKey: ["wallet"] });
			},
		})
	);
}

export function useCampaigns() {
	return useQuery(
		orpc.campaign.list.queryOptions({
			input: {
				limit: 10,
			},
			queryKey: ["campaigns"],
			staleTime: 10_000,
		})
	);
}

export function useCampaignStatus(campaignId: string | null) {
	return useQuery(
		orpc.campaign.getStatus.queryOptions({
			enabled: !!campaignId,
			input: {
				campaignId: campaignId ?? "",
			},
			queryKey: ["campaignStatus", campaignId],
			refetchInterval: ({ state }) => {
				const status = state.data?.status;
				return status === "completed" ||
					status === "failed" ||
					status === "cancelled"
					? false
					: 2000;
			},
		})
	);
}

export function useCampaignDetail(campaignId: string | null) {
	return useCampaignStatus(campaignId);
}
