// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingGuard } from "./use-onboarding-guard";

const mockNavigate = vi.fn();
let mockPathname = "/dashboard";
let mockProfileData: unknown = null;
let mockIsLoading = false;

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({ pathname: mockPathname }),
	useRouter: () => ({ navigate: mockNavigate }),
}));

vi.mock("./use-profile", () => ({
	useProfile: () => ({
		data: mockProfileData,
		isLoading: mockIsLoading,
	}),
}));

describe("useOnboardingGuard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPathname = "/dashboard";
		mockProfileData = null;
		mockIsLoading = false;
	});

	// covers: AC-8
	it("does not navigate while profile is still loading", () => {
		mockIsLoading = true;
		mockProfileData = null;
		mockPathname = "/dashboard";

		renderHook(() => useOnboardingGuard());

		expect(mockNavigate).not.toHaveBeenCalled();
	});

	// covers: AC-8
	it("redirects uncompleted profile on dashboard to /onboarding", () => {
		mockIsLoading = false;
		mockProfileData = { id: "usr_1", onboardingComplete: false };
		mockPathname = "/dashboard";

		renderHook(() => useOnboardingGuard());

		expect(mockNavigate).toHaveBeenCalledWith({ to: "/onboarding" });
	});

	// covers: AC-8
	it("redirects completed profile on /onboarding back to /dashboard", () => {
		mockIsLoading = false;
		mockProfileData = { id: "usr_1", onboardingComplete: true };
		mockPathname = "/onboarding";

		renderHook(() => useOnboardingGuard());

		expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" });
	});

	// covers: AC-8
	it("does not redirect when user is on an exempt path", () => {
		mockIsLoading = false;
		mockProfileData = { id: "usr_1", onboardingComplete: false };
		mockPathname = "/login";

		renderHook(() => useOnboardingGuard());

		expect(mockNavigate).not.toHaveBeenCalled();
	});

	// covers: AC-8
	it("does not redirect completed profile on /dashboard", () => {
		mockIsLoading = false;
		mockProfileData = { id: "usr_1", onboardingComplete: true };
		mockPathname = "/dashboard";

		renderHook(() => useOnboardingGuard());

		expect(mockNavigate).not.toHaveBeenCalled();
	});
});
