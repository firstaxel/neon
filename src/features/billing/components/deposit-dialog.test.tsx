import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DepositDialog } from "./deposit-dialog";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("#/features/billing/hooks/use-billing", () => ({
	useInitDeposit: () => ({
		error: mockError,
		isPending: mockIsPending,
		mutateAsync: mockMutateAsync,
	}),
}));

const DIALOG_TITLE_REGEX = /top up messaging wallet/i;
const CUSTOM_AMOUNT_TAB_REGEX = /custom amount/i;
const PROCEED_BUTTON_REGEX = /proceed to pay/i;
const CONNECTING_BUTTON_REGEX = /connecting to paystack/i;
const AMOUNT_ERROR_REGEX = /amount must be between ₦500 and ₦5,000,000/i;
const DEPOSIT_AMOUNT_LABEL_REGEX = /deposit amount/i;
const MOCK_CHECKOUT_URL = "https://checkout.paystack.com/access_code_123";

describe("DepositDialog component", () => {
	const originalLocation = window.location;

	beforeEach(() => {
		vi.clearAllMocks();
		mockIsPending = false;
		mockError = null;

		Object.defineProperty(window, "location", {
			configurable: true,
			value: {
				...originalLocation,
				assign: vi.fn(),
				href: "http://localhost:3000/billing",
				origin: "http://localhost:3000",
				replace: vi.fn(),
			},
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
			writable: true,
		});
	});

	// covers: AC-1, AC-7
	it("renders dialog header and default preset selection when open", () => {
		render(<DepositDialog onOpenChange={vi.fn()} open={true} />);

		expect(
			screen.getByRole("heading", { name: DIALOG_TITLE_REGEX })
		).toBeDefined();
		expect(screen.getByText("Wallet Deposit")).toBeDefined();
		expect(screen.getAllByText("₦10,000").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("Paystack Processing Fee")).toBeDefined();
		expect(screen.getByText("Total Checkout Charge")).toBeDefined();
	});

	// covers: AC-1, AC-7
	it("updates fee breakdown and message estimates when selecting a different preset", () => {
		render(<DepositDialog onOpenChange={vi.fn()} open={true} />);

		const preset25k = screen.getByRole("button", { name: "₦25,000" });
		fireEvent.click(preset25k);

		expect(screen.getAllByText("₦25,000").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("WhatsApp Marketing")).toBeDefined();
		expect(screen.getByText("SMS Broadcast")).toBeDefined();
	});

	// covers: AC-1, AC-7
	it("handles custom amount input and displays validation error for out of bounds amounts", () => {
		render(<DepositDialog onOpenChange={vi.fn()} open={true} />);

		const customTab = screen.getByRole("button", {
			name: CUSTOM_AMOUNT_TAB_REGEX,
		});
		fireEvent.click(customTab);

		const input = screen.getByLabelText(DEPOSIT_AMOUNT_LABEL_REGEX);
		expect(input).toBeDefined();

		fireEvent.change(input, { target: { value: "300" } });
		expect(screen.getByText(AMOUNT_ERROR_REGEX)).toBeDefined();

		fireEvent.change(input, { target: { value: "6000000" } });
		expect(screen.getByText(AMOUNT_ERROR_REGEX)).toBeDefined();

		fireEvent.change(input, { target: { value: "15000" } });
		expect(screen.queryByText(AMOUNT_ERROR_REGEX)).toBeNull();
		expect(screen.getByText("₦15,000")).toBeDefined();
	});

	// covers: AC-1, AC-7
	it("initiates deposit mutation and redirects to checkout url on proceed click", async () => {
		mockMutateAsync.mockResolvedValueOnce({
			checkoutUrl: MOCK_CHECKOUT_URL,
		});

		render(<DepositDialog onOpenChange={vi.fn()} open={true} />);

		const proceedButton = screen.getByRole("button", {
			name: PROCEED_BUTTON_REGEX,
		});
		expect(proceedButton).toBeDefined();
		fireEvent.click(proceedButton);

		await waitFor(() => {
			expect(mockMutateAsync).toHaveBeenCalledWith({
				amountNaira: 10_000,
				callbackUrl: "http://localhost:3000/billing/verify",
			});
			expect(window.location.href).toBe(MOCK_CHECKOUT_URL);
		});
	});

	// covers: AC-1
	it("disables button and shows loading state while deposit initialization is pending", () => {
		mockIsPending = true;

		render(<DepositDialog onOpenChange={vi.fn()} open={true} />);

		const submitButton = screen.getByRole("button", {
			name: CONNECTING_BUTTON_REGEX,
		});
		expect(submitButton.hasAttribute("disabled")).toBe(true);
	});

	// covers: AC-1
	it("renders error message when deposit initiation fails", () => {
		mockError = new Error("Paystack gateway unreachable");

		render(<DepositDialog onOpenChange={vi.fn()} open={true} />);

		expect(screen.getByText("Paystack gateway unreachable")).toBeDefined();
	});
});
