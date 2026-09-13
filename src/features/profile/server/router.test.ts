// @vitest-environment node
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOnboarding, getProfile } from "./router";

vi.mock("#/features/miscellaneous/seed-scenario-templates", () => ({
	seedScenarioTemplates: vi.fn().mockResolvedValue({ seeded: 10, skipped: 0 }),
}));

describe("Profile router - completeOnboarding", () => {
	const mockTx = {
		messageTemplate: {
			createMany: vi.fn(),
			findMany: vi.fn().mockResolvedValue([]),
		},
		senderNumber: {
			create: vi.fn().mockResolvedValue({ id: "sender_1" }),
			findFirst: vi.fn().mockResolvedValue(null),
			update: vi.fn(),
		},
		user: {
			update: vi
				.fn()
				.mockResolvedValue({ id: "user_123", name: "Pastor David" }),
		},
		userProfile: {
			upsert: vi.fn().mockResolvedValue({
				id: "profile_123",
				onboardingComplete: true,
				onboardingStep: 3,
				orgName: "Grace Sanctuary",
				orgSize: "51-200",
				orgType: "church",
				phone: "+2348011223344",
				role: "admin",
				timezone: "Africa/Lagos",
				userId: "user_123",
			}),
		},
		wallet: {
			upsert: vi.fn().mockResolvedValue({
				balanceKobo: 0,
				heldKobo: 0,
				id: "wallet_123",
				userId: "user_123",
			}),
		},
	};

	const mockDb = {
		$transaction: vi.fn(
			async (cb: (tx: typeof mockTx) => Promise<unknown>) => await cb(mockTx)
		),
		senderNumber: mockTx.senderNumber,
		user: {
			findUniqueOrThrow: vi.fn().mockResolvedValue({
				createdAt: new Date(),
				email: "pastor@church.ng",
				id: "user_123",
				image: null,
				name: "Pastor David",
			}),
		},
		userProfile: {
			findUnique: vi.fn().mockResolvedValue({
				onboardingComplete: true,
				onboardingStep: 3,
				orgName: "Grace Sanctuary",
				orgSize: "51-200",
				orgType: "church",
				phone: "+2348011223344",
				role: "admin",
				timezone: "Africa/Lagos",
			}),
		},
	};

	const mockContext = {
		db: mockDb as any,
		session: {
			user: {
				email: "pastor@church.ng",
				id: "user_123",
				name: "Pastor David",
			},
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("completes onboarding atomically, initializing wallet and templates", async () => {
		const result = await call(
			completeOnboarding,
			{
				complete: true,
				name: "Pastor David",
				orgName: "Grace Sanctuary",
				orgSize: "51-200",
				orgType: "church",
				phone: "+2348011223344",
				role: "admin",
				step: 3,
				timezone: "Africa/Lagos",
				usePlatformSender: true,
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(result.complete).toBe(true);
		expect(result.step).toBe(3);
		expect(mockDb.$transaction).toHaveBeenCalledOnce();
		expect(mockTx.user.update).toHaveBeenCalledWith({
			data: { name: "Pastor David" },
			where: { id: "user_123" },
		});
		expect(mockTx.wallet.upsert).toHaveBeenCalledWith({
			create: { balanceKobo: 0, heldKobo: 0, userId: "user_123" },
			update: {},
			where: { userId: "user_123" },
		});
	});

	it("creates an unverified sender number when custom SMS sender ID is provided", async () => {
		const result = await call(
			completeOnboarding,
			{
				complete: false,
				name: "Pastor David",
				orgName: "Grace Sanctuary",
				orgSize: "51-200",
				orgType: "church",
				phone: "+2348011223344",
				smsSenderId: "GraceSanct",
				step: 2,
				usePlatformSender: false,
			},
			{ context: mockContext }
		);

		expect(result.success).toBe(true);
		expect(mockTx.senderNumber.create).toHaveBeenCalledWith({
			data: {
				channel: "sms",
				isActive: false,
				label: "Primary SMS Sender ID",
				number: "GraceSanct",
				userId: "user_123",
			},
		});
		expect(mockTx.wallet.upsert).not.toHaveBeenCalled();
	});

	it("aborts when an inner database operation fails in transaction", async () => {
		mockDb.$transaction.mockRejectedValueOnce(
			new Error("Database write conflict")
		);

		await expect(
			call(
				completeOnboarding,
				{
					complete: true,
					name: "Pastor David",
					orgName: "Grace Sanctuary",
					orgSize: "51-200",
					orgType: "church",
					phone: "+2348011223344",
					step: 3,
					usePlatformSender: true,
				},
				{ context: mockContext }
			)
		).rejects.toThrow("Database write conflict");
	});

	it("fetches the user profile via getProfile", async () => {
		const result = await call(getProfile, undefined, { context: mockContext });

		expect(result.name).toBe("Pastor David");
		expect(result.email).toBe("pastor@church.ng");
		expect(result.onboardingComplete).toBe(true);
		expect(result.onboardingStep).toBe(3);
		expect(result.orgName).toBe("Grace Sanctuary");
	});
});
