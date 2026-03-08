/**
 * src/orpc/profile.router.ts
 *
 * User profile + onboarding procedures:
 *   profile.get               — fetch current user's profile
 *   profile.update            — update name, org info, phone
 *   profile.completeOnboarding — advance onboarding step / mark done
 *   profile.updatePassword     — change password (email/password accounts)
 */

import { z } from "zod";
import { seedScenarioTemplates } from "#/features/miscellaneous/seed-scenario-templates";
import { auth } from "#/lib/auth";
import { protectedProcedure } from "#/orpc";

// ─── Shared org input ─────────────────────────────────────────────────────────

const OrgInput = z.object({
	name: z.string().min(1).max(100).optional(),
	orgType: z.string().min(1).max(60).optional(), // free-form: church, ngo, school, business, etc.
	orgName: z.string().min(1).max(100).optional(),
	orgSize: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
	role: z
		.enum(["admin", "pastor", "manager", "staff", "volunteer", "coordinator"])
		.optional(),
	phone: z.string().min(7).max(20).optional(),
	senderId: z.string().min(3).max(11).optional(),
	usePlatformSender: z.boolean().optional(),
	timezone: z.string().optional(),
});

// ─── get ──────────────────────────────────────────────────────────────────────

export const getProfile = protectedProcedure.handler(async ({ context }) => {
	const [user, profile] = await Promise.all([
		context.db.user.findUniqueOrThrow({
			where: { id: context.session.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				createdAt: true,
			},
		}),
		context.db.userProfile.findUnique({
			where: { userId: context.session.user.id },
		}),
	]);

	return {
		id: context.session.user.id,
		name: user.name,
		email: user.email,
		image: user.image,
		createdAt: user.createdAt.toISOString(),
		orgType: profile?.orgType ?? null,
		orgName: profile?.orgName ?? null,
		orgSize: profile?.orgSize ?? null,
		role: profile?.role ?? "staff",
		phone: profile?.phone ?? null,
		timezone: profile?.timezone ?? "Africa/Lagos",
		onboardingComplete: profile?.onboardingComplete ?? false,
		onboardingStep: profile?.onboardingStep ?? 0,
	};
});

// ─── update ───────────────────────────────────────────────────────────────────

export const updateProfile = protectedProcedure
	.input(OrgInput)
	.handler(async ({ input, context }) => {
		const { name, ...profileFields } = input;

		if (name) {
			await context.db.user.update({
				where: { id: context.session.user.id },
				data: { name },
			});
		}

		const profile = await context.db.userProfile.upsert({
			where: { userId: context.session.user.id },
			create: { userId: context.session.user.id, ...profileFields },
			update: profileFields,
		});

		return { success: true, name: name ?? context.session.user.name, profile };
	});

// ─── completeOnboarding ───────────────────────────────────────────────────────

export const completeOnboarding = protectedProcedure
	.input(
		OrgInput.extend({
			step: z.number().int().min(0).max(10),
			complete: z.boolean().default(false),
		})
	)
	.handler(async ({ input, context }) => {
		const { step, complete, name, ...profileFields } = input;

		if (name) {
			await context.db.user.update({
				where: { id: context.session.user.id },
				data: { name },
			});
		}

		const profile = await context.db.userProfile.upsert({
			where: { userId: context.session.user.id },
			create: {
				userId: context.session.user.id,
				onboardingStep: step,
				onboardingComplete: complete,
				...profileFields,
			},
			update: {
				onboardingStep: step,
				onboardingComplete: complete,
				...profileFields,
			},
		});

		// Seed the user's personal scenario templates on first completion
		if (complete) {
			await seedScenarioTemplates(
				context.db,
				context.session.user.id,
				profileFields.orgType
			);
		}

		return { success: true, step, complete, profile };
	});

// ─── updatePassword ───────────────────────────────────────────────────────────

export const updatePassword = protectedProcedure
	.input(
		z.object({
			currentPassword: z.string().min(1),
			newPassword: z.string().min(8).max(128),
		})
	)
	.handler(async ({ input, context }) => {
		const response = await auth.api.changePassword({
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: false,
			},
			headers: new Headers({ "x-user-id": context.session.user.id }),
		});

		if (!response) {
			throw new Error("Current password is incorrect");
		}
		return { success: true };
	});
