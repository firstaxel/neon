// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingVerifyView } from "./billing-verify";

const mockNavigate = vi.fn();
let mockMutate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		className,
		...props
	}: {
		children: React.ReactNode;
		className?: string;
		to: string;
	}) => (
		<a className={className} href={to} {...props}>
			{children}
		</a>
	),
	useRouter: () => ({
		navigate: mockNavigate,
	}),
}));

vi.mock("#/features/billing/hooks/use-billing", () => ({
	useVerifyDeposit: () => ({
		mutate: mockMutate,
	}),
}));

const NO_REFERENCE_REGEX = /no reference found/i;
const NO_REF_DETAIL_REGEX = /this page was opened without a payment reference/i;
const GO_TO_BILLING_REGEX = /go to billing/i;
const VERIFYING_HEADING_REGEX = /verifying payment\.\.\./i;
const VERIFYING_DETAIL_REGEX =
	/please wait while we confirm your payment with paystack/i;
const CONFIRMED_HEADING_REGEX = /payment confirmed/i;
const CONFIRMED_DETAIL_REGEX = /your wallet has been topped up successfully/i;
const REDIRECTING_REGEX = /redirecting to billing/i;
const ALREADY_CREDITED_REGEX = /already credited/i;
const ALREADY_CREDITED_DETAIL_REGEX =
	/this payment was already processed\. your wallet balance is up to date/i;
const VERIFICATION_FAILED_REGEX = /verification failed/i;

describe("BillingVerifyView component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// covers: AC-2
	it("renders error state when opened without a payment reference", () => {
		render(<BillingVerifyView reference="" />);

		expect(
			screen.getByRole("heading", { name: NO_REFERENCE_REGEX })
		).toBeDefined();
		expect(screen.getByText(NO_REF_DETAIL_REGEX)).toBeDefined();
		expect(
			screen.getByRole("button", { name: GO_TO_BILLING_REGEX })
		).toBeDefined();
	});

	// covers: AC-2
	it("shows loading state and initiates verification mutation when reference is present", () => {
		mockMutate = vi.fn();

		render(<BillingVerifyView reference="dep_test_ref_123" />);

		expect(
			screen.getByRole("heading", { name: VERIFYING_HEADING_REGEX })
		).toBeDefined();
		expect(screen.getByText(VERIFYING_DETAIL_REGEX)).toBeDefined();
		expect(mockMutate).toHaveBeenCalledWith(
			{ reference: "dep_test_ref_123" },
			expect.any(Object)
		);
	});

	// covers: AC-2
	it("displays payment confirmation and formatted amount upon successful verification", () => {
		mockMutate = vi.fn(
			(
				_input: { reference: string },
				options?: {
					onSuccess?: (data: {
						alreadyProcessed: boolean;
						amountKobo: number;
						newBalanceFormatted: string;
						newBalanceKobo: number;
					}) => void;
				}
			) => {
				options?.onSuccess?.({
					alreadyProcessed: false,
					amountKobo: 2_500_000,
					newBalanceFormatted: "₦25,000.00",
					newBalanceKobo: 2_500_000,
				});
			}
		);

		render(<BillingVerifyView reference="dep_test_ref_success" />);

		expect(
			screen.getByRole("heading", { name: CONFIRMED_HEADING_REGEX })
		).toBeDefined();
		expect(screen.getByText(CONFIRMED_DETAIL_REGEX)).toBeDefined();
		expect(screen.getByText("₦25,000")).toBeDefined();
		expect(screen.getByText(REDIRECTING_REGEX)).toBeDefined();
	});

	// covers: AC-2, AC-4
	it("handles idempotent callback when deposit was already processed", () => {
		mockMutate = vi.fn(
			(
				_input: { reference: string },
				options?: {
					onSuccess?: (data: {
						alreadyProcessed: boolean;
						amountKobo: number;
						newBalanceFormatted: string;
						newBalanceKobo: number;
					}) => void;
				}
			) => {
				options?.onSuccess?.({
					alreadyProcessed: true,
					amountKobo: 1_000_000,
					newBalanceFormatted: "₦10,000.00",
					newBalanceKobo: 1_000_000,
				});
			}
		);

		render(<BillingVerifyView reference="dep_test_ref_repeat" />);

		expect(
			screen.getByRole("heading", { name: ALREADY_CREDITED_REGEX })
		).toBeDefined();
		expect(screen.getByText(ALREADY_CREDITED_DETAIL_REGEX)).toBeDefined();
		expect(screen.getByText("₦10,000")).toBeDefined();
	});

	// covers: AC-2
	it("renders failure message and navigation button when verification errors", () => {
		mockMutate = vi.fn(
			(
				_input: { reference: string },
				options?: {
					onError?: (error: Error) => void;
				}
			) => {
				options?.onError?.(
					new Error("Transaction was declined by issuing bank")
				);
			}
		);

		render(<BillingVerifyView reference="dep_test_ref_failed" />);

		expect(
			screen.getByRole("heading", { name: VERIFICATION_FAILED_REGEX })
		).toBeDefined();
		expect(
			screen.getByText("Transaction was declined by issuing bank")
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: GO_TO_BILLING_REGEX })
		).toBeDefined();
	});

	// covers: AC-2
	it("schedules redirect navigation after successful payment confirmation", () => {
		vi.useFakeTimers();

		mockMutate = vi.fn(
			(
				_input: { reference: string },
				options?: {
					onSuccess?: (data: {
						alreadyProcessed: boolean;
						amountKobo: number;
						newBalanceFormatted: string;
						newBalanceKobo: number;
					}) => void;
				}
			) => {
				options?.onSuccess?.({
					alreadyProcessed: false,
					amountKobo: 500_000,
					newBalanceFormatted: "₦5,000.00",
					newBalanceKobo: 500_000,
				});
			}
		);

		render(<BillingVerifyView reference="dep_test_ref_redirect" />);

		expect(mockNavigate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(3000);

		expect(mockNavigate).toHaveBeenCalledWith({ to: "/billing" });
	});
});
