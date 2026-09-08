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

// ── Subscription (Deprecated — prepaid wallet migration) ──────────────────────
export interface BillingPlan {
	key: string;
	label: string;
	monthlyLimit: string;
	paystackPlanCode?: string;
	priceFormatted: string;
	priceKobo: number;
}

export interface UserSubscription {
	currentPeriodEnd: string;
	id: string;
	messagesUsedThisCycle: number;
	monthlyMessageLimit: number;
	paystackSubCode?: string | null;
	plan: string;
	remainingMessages: number;
	status: string;
	usagePercent: number;
}

export function useSubscription() {
	return {
		data: {
			plans: [] as BillingPlan[],
			subscription: null as UserSubscription | null,
		},
		isError: false,
		isLoading: false,
	};
}

export function useInitSubscription() {
	return {
		isPending: false,
		mutateAsync: async (_args: {
			callbackUrl: string;
			plan: "starter" | "growth" | "pro";
		}) => ({
			checkoutUrl: "",
		}),
	};
}

export function useCancelSubscription() {
	return {
		isPending: false,
		mutateAsync: async (_args?: unknown) => ({
			cancelled: true,
			currentPeriodEnd: new Date().toISOString(),
			message: "Subscription cancelled",
		}),
	};
}
