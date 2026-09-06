import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";

// ── Wallet ────────────────────────────────────────────────────────────────────
export function useWallet() {
	return useQuery(
		orpc.billing.getWallet.queryOptions({
			queryKey: ["wallet"],
			refetchOnWindowFocus: true,
			staleTime: 10_000,
		})
	);
}

// ── Transactions ──────────────────────────────────────────────────────────────
export function useTransactions(page = 1) {
	return useQuery(
		orpc.billing.getTransactions.queryOptions({
			input: {
				page,
			},
			placeholderData: (prev) => prev,
			queryKey: ["transactions", page],
			staleTime: 30_000,
		})
	);
}

// ── Deposit ───────────────────────────────────────────────────────────────────
export function useInitDeposit() {
	return useMutation(orpc.billing.initDeposit.mutationOptions());
}

export function useVerifyDeposit() {
	const queryClient = useQueryClient();
	return useMutation(
		orpc.billing.verifyDeposit.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["wallet"] });
				queryClient.invalidateQueries({ queryKey: ["transactions"] });
			},
		})
	);
}

// ── Campaign cost check ───────────────────────────────────────────────────────
export function useCampaignCost(
	contacts: Array<{ channel: "whatsapp" | "sms" }>,
	deliveryMode:
		| "marketing"
		| "utility_prescreen"
		| "sms_fallback" = "marketing",
	contactIds?: string[]
) {
	return useQuery(
		orpc.billing.checkCampaignCost.queryOptions({
			enabled: contacts.length > 0,
			input: { contactIds, contacts, deliveryMode },
			queryKey: ["campaignCost", contacts, deliveryMode, contactIds],
			staleTime: 5000,
		})
	);
}

// ── Subscription ──────────────────────────────────────────────────────────────
export function useSubscription() {
	return useQuery(
		orpc.billing.getSubscription.queryOptions({
			staleTime: 60_000,
		})
	);
}

export function useInitSubscription() {
	return useMutation(orpc.billing.initSubscription.mutationOptions());
}

export function useCancelSubscription() {
	const queryClient = useQueryClient();
	return useMutation(
		orpc.billing.cancelSubscription.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["subscription"] });
			},
		})
	);
}
