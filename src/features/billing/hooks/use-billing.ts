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
export type TransactionTypeFilter =
	| "deposit"
	| "message_debit"
	| "campaign_hold"
	| "campaign_refund"
	| "refund";

export interface UseTransactionsParams {
	page?: number;
	pageSize?: number;
	type?: TransactionTypeFilter;
}

export function useTransactions(params: number | UseTransactionsParams = 1) {
	const normalized =
		typeof params === "number"
			? { page: params, pageSize: 20, type: undefined }
			: {
					page: params.page ?? 1,
					pageSize: params.pageSize ?? 20,
					type: params.type,
				};

	return useQuery(
		orpc.billing.getTransactions.queryOptions({
			input: {
				page: normalized.page,
				pageSize: normalized.pageSize,
				...(normalized.type ? { type: normalized.type } : {}),
			},
			placeholderData: (prev) => prev,
			queryKey: [
				"transactions",
				normalized.page,
				normalized.pageSize,
				normalized.type,
			],
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
