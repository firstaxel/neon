/**
 * src/features/profile/server/router.ts
 *
 *   profile.get               — fetch current user's profile
 *   profile.update            — update name, org info, phone
 *   profile.completeOnboarding — advance onboarding step / mark done
 *   profile.updatePassword     — change password (email/password accounts)
 *   profile.reseedTemplates    — re-seed scenario templates for a new org type
 *   profile.getSenderNumbers   — list registered SMS sender IDs
 *   profile.submitSenderId     — register sender ID in DB + submit to Termii
 *   profile.deleteSenderNumber — remove a pending/rejected sender ID
 */

import { z } from "zod";
import { seedScenarioTemplates } from "#/features/miscellaneous/seed-scenario-templates";
import { auth } from "#/lib/auth";
import { invalidate, withCache } from "#/lib/cache";
import { protectedProcedure } from "#/orpc";

// ─── Shared org input ─────────────────────────────────────────────────────────

const OrgInput = z.object({
	name: z.string().min(1).max(100).optional(),
	orgType: z.string().min(1).max(60).optional(),
	orgName: z.string().min(1).max(100).optional(),
	orgSize: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
	role: z
		.enum(["admin", "pastor", "manager", "staff", "volunteer", "coordinator"])
		.optional(),
	phone: z.string().min(7).max(20).optional(),
	timezone: z.string().optional(),
	smsSenderId: z
		.string()
		.max(11)
		.regex(/^[a-zA-Z0-9]*$/)
		.optional(),
	usePlatformSender: z.boolean().optional(),
});

// ─── get ──────────────────────────────────────────────────────────────────────

export const getProfile = protectedProcedure.handler(
	withCache("profile.get", 60_000, async ({ context }) => {
		const [user, profile] = await Promise.all([
			context.db.user.findUniqueOrThrow({
				where: { id: context.session?.user.id },
				select: {
					id: true,
					name: true,
					email: true,
					image: true,
					createdAt: true,
				},
			}),
			context.db.userProfile.findUnique({
				where: { userId: context.session?.user.id },
			}),
		]);

		return {
			id: context.session?.user.id,
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
	})
);

// ─── update ───────────────────────────────────────────────────────────────────

export const updateProfile = protectedProcedure
	.input(OrgInput)
	.handler(async ({ input, context }) => {
		const {
			name,
			smsSenderId: _s,
			usePlatformSender: _u,
			...profileFields
		} = input;

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

		invalidate(context.session.user.id, "profile.get");
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
		const {
			step,
			complete,
			name,
			smsSenderId,
			usePlatformSender,
			...profileFields
		} = input;

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

		// Save sender ID when user explicitly chose "register my own" (usePlatformSender=false)
		if (
			smsSenderId &&
			smsSenderId.trim().length >= 3 &&
			usePlatformSender === false
		) {
			const cleanId = smsSenderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11);
			const existing = await context.db.senderNumber.findFirst({
				where: { userId: context.session.user.id, channel: "sms" },
			});
			if (existing) {
				await context.db.senderNumber.update({
					where: { id: existing.id },
					data: {
						number: cleanId,
						label: "Primary SMS Sender ID",
						isActive: false,
					},
				});
			} else {
				await context.db.senderNumber.create({
					data: {
						userId: context.session.user.id,
						number: cleanId,
						label: "Primary SMS Sender ID",
						channel: "sms",
						isActive: false,
					},
				});
			}
		}

		if (complete) {
			await seedScenarioTemplates(
				context.db,
				context.session.user.id,
				profileFields.orgType
			);
		}

		invalidate(context.session.user.id, "profile.get");
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

// ─── reseedTemplates ──────────────────────────────────────────────────────────

export const reseedTemplates = protectedProcedure
	.input(z.object({ orgType: z.string().min(1).max(60) }))
	.handler(async ({ input, context }) => {
		const result = await seedScenarioTemplates(
			context.db,
			context.session.user.id,
			input.orgType
		);
		return { success: true, ...result };
	});

// ─── getSenderNumbers ─────────────────────────────────────────────────────────

export const getSenderNumbers = protectedProcedure.handler(
	withCache("profile.getSenderNumbers", 60_000, async ({ context }) => {
		const senders = await context.db.senderNumber.findMany({
			where: { userId: context.session?.user.id, channel: "sms" },
			orderBy: { createdAt: "asc" },
		});
		return senders.map((s) => ({
			id: s.id,
			number: s.number,
			label: s.label,
			isActive: s.isActive,
			sentCount: s.sentCount,
			lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
			createdAt: s.createdAt.toISOString(),
		}));
	})
);

// ─── submitSenderId ───────────────────────────────────────────────────────────

export const submitSenderId = protectedProcedure
	.input(
		z.object({
			senderId: z
				.string()
				.min(3, "Must be at least 3 characters")
				.max(11, "Must be at most 11 characters")
				.regex(/^[a-zA-Z0-9]+$/, "Letters and numbers only, no spaces"),
			label: z.string().max(60).optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const { senderId, label } = input;

		// 1. Upsert DB record immediately (DB is source of truth regardless of Termii)
		const existing = await context.db.senderNumber.findFirst({
			where: { userId: context.session.user.id, channel: "sms" },
		});

		let dbRecord: { id: string };
		if (existing) {
			dbRecord = await context.db.senderNumber.update({
				where: { id: existing.id },
				data: {
					number: senderId,
					label: label ?? existing.label ?? "Primary SMS Sender ID",
					isActive: false,
				},
			});
		} else {
			dbRecord = await context.db.senderNumber.create({
				data: {
					userId: context.session.user.id,
					number: senderId,
					label: label ?? "Primary SMS Sender ID",
					channel: "sms",
					isActive: false,
				},
			});
		}

		// 2. Submit to Termii
		const termiiApiKey = process.env.TERMII_API_KEY;
		if (!termiiApiKey) {
			invalidate(context.session.user.id, "profile.getSenderNumbers");
			return {
				success: true,
				submitted: false,
				reason:
					"Sender ID saved. TERMII_API_KEY not configured — submit manually via Termii dashboard.",
				senderId,
				dbId: dbRecord.id,
			};
		}

		const profile = await context.db.userProfile.findUnique({
			where: { userId: context.session.user.id },
			select: { orgName: true },
		});
		const companyName = profile?.orgName ?? "MessageDesk User";

		try {
			const res = await fetch(
				"https://v3.api.termii.com/api/sender-id/request",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						api_key: termiiApiKey,
						sender_id: senderId,
						usecase:
							"Sending transactional and informational messages to our members and customers",
						company: companyName,
					}),
				}
			);

			const data = (await res.json()) as { code?: string; message?: string };

			if (!res.ok) {
				return {
					success: false,
					submitted: true,
					reason: data.message ?? `Termii returned ${res.status}`,
					senderId,
					dbId: dbRecord.id,
				};
			}

			return {
				success: true,
				submitted: true,
				reason:
					data.message ??
					"Submitted — Termii & NCC approval takes 2–5 business days.",
				senderId,
				dbId: dbRecord.id,
			};
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			return {
				success: false,
				submitted: false,
				reason: `Network error submitting to Termii: ${error}`,
				senderId,
				dbId: dbRecord.id,
			};
		}
	});

// ─── deleteSenderNumber ───────────────────────────────────────────────────────

export const deleteSenderNumber = protectedProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		const record = await context.db.senderNumber.findFirst({
			where: { id: input.id, userId: context.session.user.id },
		});
		if (!record) {
			throw new Error("Sender ID not found");
		}
		if (record.isActive) {
			throw new Error(
				"Cannot delete an active sender ID — contact support to deactivate it first"
			);
		}
		await context.db.senderNumber.delete({ where: { id: input.id } });
		invalidate(context.session.user.id, "profile.getSenderNumbers");
		return { success: true };
	});

// ─── deleteAccount ────────────────────────────────────────────────────────────
// Hard-deletes the user row. Prisma cascade removes all related data.
// Requires the user to type their email to confirm — extra guard against accidents.

export const deleteAccount = protectedProcedure
	.input(z.object({ confirmEmail: z.string().email() }))
	.handler(async ({ input, context }) => {
		const user = await context.db.user.findUniqueOrThrow({
			where: { id: context.session.user.id },
			select: { email: true },
		});

		if (input.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
			throw new Error("Email does not match — account not deleted");
		}

		// Cascade deletes all related data via Prisma schema onDelete: Cascade
		await context.db.user.delete({ where: { id: context.session.user.id } });

		return { success: true };
	});
