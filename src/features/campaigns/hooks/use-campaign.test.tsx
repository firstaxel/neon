// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	useCancelScheduledCampaign,
	useCreateSmsCampaign,
	useEstimateCampaignCost,
	useSendCampaign,
} from "./use-campaign";

const mockSendMutation = vi.fn();
const mockCreateSmsMutation = vi.fn();
const mockCancelMutation = vi.fn();
const mockEstimateMutation = vi.fn();

vi.mock("#/orpc/client", () => ({
	orpc: {
		campaign: {
			cancelScheduledCampaign: {
				mutationOptions: (options?: any) => ({
					mutationFn: mockCancelMutation,
					...options,
				}),
			},
			createSmsCampaign: {
				mutationOptions: (options?: any) => ({
					mutationFn: mockCreateSmsMutation,
					...options,
				}),
			},
			estimateCost: {
				mutationOptions: (options?: any) => ({
					mutationFn: mockEstimateMutation,
					...options,
				}),
			},
			getStatus: {
				queryOptions: (options: any) => options,
			},
			list: {
				queryOptions: (options: any) => options,
			},
			send: {
				mutationOptions: (options?: any) => ({
					mutationFn: mockSendMutation,
					...options,
				}),
			},
		},
	},
}));

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			mutations: { retry: false },
			queries: { retry: false },
		},
	});

	return {
		queryClient,
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	};
}

describe("use-campaign hooks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// covers: AC-6
	it("useSendCampaign invalidates campaigns query cache on success", async () => {
		const { queryClient, wrapper } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		mockSendMutation.mockResolvedValueOnce({ campaignId: "camp_1" });

		const { result } = renderHook(() => useSendCampaign(), { wrapper });

		await result.current.mutateAsync({
			contacts: [],
			scenario: "general",
			useCustom: false,
		});

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["campaigns"],
			});
		});
	});

	// covers: AC-5, AC-6
	it("useCreateSmsCampaign invalidates campaigns and wallet query cache on success", async () => {
		const { queryClient, wrapper } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		mockCreateSmsMutation.mockResolvedValueOnce({
			campaignId: "camp_sms_1",
			heldKobo: 1200,
			status: "pending",
		});

		const { result } = renderHook(() => useCreateSmsCampaign(), { wrapper });

		await result.current.mutateAsync({
			contactIds: ["c1"],
			messageText: "Hello",
			scenario: "general",
		});

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["campaigns"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["wallet"],
			});
		});
	});

	// covers: AC-8
	it("useCancelScheduledCampaign invalidates campaigns, campaignStatus, and wallet on success", async () => {
		const { queryClient, wrapper } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		mockCancelMutation.mockResolvedValueOnce({
			campaignId: "camp_sms_1",
			releasedKobo: 1200,
			status: "cancelled",
		});

		const { result } = renderHook(() => useCancelScheduledCampaign(), {
			wrapper,
		});

		await result.current.mutateAsync({
			campaignId: "camp_sms_1",
		});

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["campaigns"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["campaignStatus"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["wallet"],
			});
		});
	});

	// covers: AC-4, AC-5
	it("useEstimateCampaignCost invokes cost estimation mutation", async () => {
		const { wrapper } = createWrapper();
		mockEstimateMutation.mockResolvedValueOnce({
			availableBalanceKobo: 5000,
			baseSegments: 1,
			encoding: "GSM_7",
			sufficientBalance: true,
			totalContacts: 1,
			totalEstimatedCostKobo: 600,
		});

		const { result } = renderHook(() => useEstimateCampaignCost(), { wrapper });

		const res = await result.current.mutateAsync({
			contactIds: ["c1"],
			messageText: "Sunday service",
		});

		expect(res.sufficientBalance).toBe(true);
		expect(res.totalEstimatedCostKobo).toBe(600);
	});
});
