// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerifyEmailView from "./verify-email-view";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("#/lib/auth-client", () => ({
	authClient: {
		sendVerificationEmail: vi.fn().mockResolvedValue({ error: null }),
	},
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

import { authClient } from "#/lib/auth-client";

const VERIFY_HEADING_REGEX = /verify your email/i;
const RESEND_BUTTON_REGEX = /resend verification email/i;
const ERROR_HEADING_REGEX = /verification error/i;
const ERROR_EXPIRED_REGEX = /the verification link is invalid or has expired/i;

describe("VerifyEmailView", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// covers: AC-1, AC-2
	it("renders heading and sent email address", () => {
		render(<VerifyEmailView email="adewale@church.ng" />);

		expect(
			screen.getByRole("heading", { name: VERIFY_HEADING_REGEX })
		).toBeDefined();
		expect(screen.getByText("adewale@church.ng")).toBeDefined();
		expect(
			screen.getByRole("button", { name: RESEND_BUTTON_REGEX })
		).toBeDefined();
	});

	// covers: AC-2
	it("renders invalid token alert when error prop is set", () => {
		render(<VerifyEmailView email="adewale@church.ng" error="invalid_token" />);

		expect(screen.getByText(ERROR_HEADING_REGEX)).toBeDefined();
		expect(screen.getByText(ERROR_EXPIRED_REGEX)).toBeDefined();
	});

	// covers: AC-1, AC-2
	it("calls authClient.sendVerificationEmail on resend click", () => {
		render(<VerifyEmailView email="adewale@church.ng" />);

		const resendBtn = screen.getByRole("button", {
			name: RESEND_BUTTON_REGEX,
		});
		fireEvent.click(resendBtn);

		expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
			callbackURL: "/onboarding",
			email: "adewale@church.ng",
		});
	});
});
