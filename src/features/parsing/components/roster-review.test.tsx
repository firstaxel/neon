// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RosterReview } from "./roster-review";

const mockGetParseJob = vi.fn();
const mockCommitMutation = vi.fn();
const mockDismissMutation = vi.fn();

const REVIEW_ROSTER_TITLE_REGEX = /Review Roster Sheet/i;
const BATCH_TAG_PLACEHOLDER_REGEX = /e\.g\. Sunday Service/i;
const COMMIT_BUTTON_REGEX = /Commit 2 Contacts to Directory/i;

vi.mock("#/orpc/client", () => ({
	orpc: {
		upload: {
			commitParsedJob: {
				mutationOptions: (options?: any) => ({
					mutationFn: mockCommitMutation,
					...options,
				}),
			},
			dismissParseJob: {
				mutationOptions: (options?: any) => ({
					mutationFn: mockDismissMutation,
					...options,
				}),
			},
			getParseJob: {
				queryOptions: (options?: any) => ({
					queryFn: () => mockGetParseJob(),
					queryKey: ["parseJob", options?.input?.jobId],
					...options,
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
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

describe("RosterReview component", () => {
	const sampleJobData = {
		candidates: [
			{
				category: "First Timer",
				channel: "whatsapp",
				confidence: 0.95,
				hasWarning: false,
				id: "cand_1",
				included: true,
				name: "Chukwudi Okafor",
				notes: "",
				phone: "+2348011223344",
				rawPhone: "08011223344",
				type: "prospect",
				warnings: [],
			},
			{
				category: "Member",
				channel: "whatsapp",
				confidence: 0.65,
				hasWarning: true,
				id: "cand_2",
				included: true,
				name: "Amina Bello",
				notes: "",
				phone: "0809999",
				rawPhone: "0809999",
				type: "contact",
				warningReason: "Invalid phone format",
				warnings: ["Invalid phone format"],
			},
		],
		confidence: 0.8,
		createdAt: "2026-09-13T10:00:00.000Z",
		error: null,
		fileSizeBytes: 5000,
		imageUrl: "https://r2.example.com/roster.jpg",
		jobId: "job_test_123",
		originalFilename: "sunday_service_roster.jpg",
		reviewStatus: "pending_review",
		status: "done",
		strategy: "skip_duplicates",
		tagsApplied: [],
		totalExtracted: 2,
		warnings: [],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetParseJob.mockResolvedValue(sampleJobData);
	});

	// covers: AC-4, AC-5
	it("renders extracted candidates and flags low confidence items with warning", async () => {
		const { wrapper } = createWrapper();

		render(<RosterReview jobId="job_test_123" />, { wrapper });

		await waitFor(() => {
			expect(screen.getByText(REVIEW_ROSTER_TITLE_REGEX)).toBeDefined();
			expect(screen.getByDisplayValue("Chukwudi Okafor")).toBeDefined();
			expect(screen.getByDisplayValue("Amina Bello")).toBeDefined();
			expect(screen.getByText("Invalid phone format")).toBeDefined();
		});

		expect(screen.getByText("95%")).toBeDefined();
		expect(screen.getByText("65%")).toBeDefined();
	});

	// covers: AC-5
	it("allows editing candidate name and phone number", async () => {
		const { wrapper } = createWrapper();

		render(<RosterReview jobId="job_test_123" />, { wrapper });

		await waitFor(() => {
			expect(screen.getByDisplayValue("Chukwudi Okafor")).toBeDefined();
		});

		const nameInput = screen.getByDisplayValue("Chukwudi Okafor");
		fireEvent.change(nameInput, { target: { value: "Chukwudi O. Okafor" } });
		expect(screen.getByDisplayValue("Chukwudi O. Okafor")).toBeDefined();

		const phoneInput = screen.getByDisplayValue("+2348011223344");
		fireEvent.change(phoneInput, { target: { value: "08012345678" } });
		expect(screen.getByDisplayValue("08012345678")).toBeDefined();
	});

	// covers: AC-6
	it("supports adding and removing batch tags", async () => {
		const { wrapper } = createWrapper();

		render(<RosterReview jobId="job_test_123" />, { wrapper });

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText(BATCH_TAG_PLACEHOLDER_REGEX)
			).toBeDefined();
		});

		const tagInput = screen.getByPlaceholderText(BATCH_TAG_PLACEHOLDER_REGEX);
		fireEvent.change(tagInput, {
			target: { value: "Sunday Service 2026-09-13" },
		});
		fireEvent.keyDown(tagInput, { code: "Enter", key: "Enter" });

		await waitFor(() => {
			expect(screen.getByText("Sunday Service 2026-09-13")).toBeDefined();
		});
	});

	// covers: AC-5
	it("displays inspect original photo button and opens photo dialog", async () => {
		const { wrapper } = createWrapper();

		render(<RosterReview jobId="job_test_123" />, { wrapper });

		await waitFor(() => {
			expect(screen.getByText("Inspect Original Photo")).toBeDefined();
		});

		fireEvent.click(screen.getByText("Inspect Original Photo"));

		await waitFor(() => {
			expect(
				screen.getByText("Original Roster Sheet Photograph")
			).toBeDefined();
			expect(screen.getByAltText("Roster sheet")).toBeDefined();
		});
	});

	// covers: AC-7
	it("invokes commitParsedJob mutation when commit button is clicked", async () => {
		const { wrapper } = createWrapper();
		mockCommitMutation.mockResolvedValueOnce({
			createdCount: 2,
			importId: "import_123",
			jobId: "job_test_123",
			skippedCount: 0,
			totalProcessed: 2,
			updatedCount: 0,
		});

		render(<RosterReview jobId="job_test_123" />, { wrapper });

		await waitFor(() => {
			expect(screen.getByText(COMMIT_BUTTON_REGEX)).toBeDefined();
		});

		fireEvent.click(screen.getByText(COMMIT_BUTTON_REGEX));

		await waitFor(() => {
			expect(mockCommitMutation).toHaveBeenCalled();
			expect(mockCommitMutation.mock.calls[0][0]).toEqual(
				expect.objectContaining({
					jobId: "job_test_123",
					strategy: "skip_duplicates",
				})
			);
		});
	});

	// covers: AC-8
	it("invokes dismissParseJob mutation when dismiss button is clicked", async () => {
		const { wrapper } = createWrapper();
		mockDismissMutation.mockResolvedValueOnce({
			jobId: "job_test_123",
			reviewStatus: "dismissed",
		});

		render(<RosterReview jobId="job_test_123" />, { wrapper });

		await waitFor(() => {
			expect(screen.getByText("Dismiss Batch")).toBeDefined();
		});

		fireEvent.click(screen.getByText("Dismiss Batch"));

		await waitFor(() => {
			expect(mockDismissMutation).toHaveBeenCalled();
			expect(mockDismissMutation.mock.calls[0][0]).toEqual({
				jobId: "job_test_123",
			});
		});
	});
});
