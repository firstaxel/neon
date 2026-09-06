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
	orgName: z.string().min(1).max(100).optional(),
	orgSize: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
	orgType: z.string().min(1).max(60).optional(),
	phone: z.string().min(7).max(20).optional(),
	role: z
		.enum(["admin", "leader", "manager", "staff", "volunteer", "coordinator"])
		.optional(),
	smsSenderId: z
		.string()
		.max(11)
		.regex(/^[a-zA-Z0-9]*$/)
		.optional(),
	timezone: z.string().optional(),
	usePlatformSender: z.boolean().optional(),
});

// ─── get ──────────────────────────────────────────────────────────────────────

export const getProfile = protectedProcedure.handler(
	withCache("profile.get", 60_000, async ({ context }) => {
		const [user, profile] = await Promise.all([
			context.db.user.findUniqueOrThrow({
				select: {
					createdAt: true,
					email: true,
					id: true,
					image: true,
					name: true,
				},
				where: { id: context.session?.user.id },
			}),
			context.db.userProfile.findUnique({
				where: { userId: context.session?.user.id },
			}),
		]);

		return {
			createdAt: user.createdAt.toISOString(),
			email: user.email,
			id: context.session?.user.id,
			image: user.image,
			name: user.name,
			onboardingComplete: profile?.onboardingComplete ?? false,
			onboardingStep: profile?.onboardingStep ?? 0,
			orgName: profile?.orgName ?? null,
			orgSize: profile?.orgSize ?? null,
			orgType: profile?.orgType ?? null,
			phone: profile?.phone ?? null,
			role: profile?.role ?? "staff",
			timezone: profile?.timezone ?? "Africa/Lagos",
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
				data: { name },
				where: { id: context.session.user.id },
			});
		}

		const profile = await context.db.userProfile.upsert({
			create: { userId: context.session.user.id, ...profileFields },
			update: profileFields,
			where: { userId: context.session.user.id },
		});

		invalidate(context.session.user.id, "profile.get");
		return { name: name ?? context.session.user.name, profile, success: true };
	});

// ─── completeOnboarding ───────────────────────────────────────────────────────

export const completeOnboarding = protectedProcedure
	.input(
		OrgInput.extend({
			complete: z.boolean().default(false),
			step: z.number().int().min(0).max(10),
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
				data: { name },
				where: { id: context.session.user.id },
			});
		}

		const profile = await context.db.userProfile.upsert({
			create: {
				onboardingComplete: complete,
				onboardingStep: step,
				userId: context.session.user.id,
				...profileFields,
			},
			update: {
				onboardingComplete: complete,
				onboardingStep: step,
				...profileFields,
			},
			where: { userId: context.session.user.id },
		});

		// Save sender ID when user explicitly chose "register my own" (usePlatformSender=false)
		if (
			smsSenderId &&
			smsSenderId.trim().length >= 3 &&
			usePlatformSender === false
		) {
			const cleanId = smsSenderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11);
			const existing = await context.db.senderNumber.findFirst({
				where: { channel: "sms", userId: context.session.user.id },
			});
			if (existing) {
				await context.db.senderNumber.update({
					data: {
						isActive: false,
						label: "Primary SMS Sender ID",
						number: cleanId,
					},
					where: { id: existing.id },
				});
			} else {
				await context.db.senderNumber.create({
					data: {
						channel: "sms",
						isActive: false,
						label: "Primary SMS Sender ID",
						number: cleanId,
						userId: context.session.user.id,
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
		return { complete, profile, step, success: true };
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
			orderBy: { createdAt: "asc" },
			where: { channel: "sms", userId: context.session?.user.id },
		});
		return senders.map((s) => ({
			createdAt: s.createdAt.toISOString(),
			id: s.id,
			isActive: s.isActive,
			label: s.label,
			lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
			number: s.number,
			sentCount: s.sentCount,
		}));
	})
);

// ─── submitSenderId ───────────────────────────────────────────────────────────

export const submitSenderId = protectedProcedure
	.input(
		z.object({
			label: z.string().max(60).optional(),
			senderId: z
				.string()
				.min(3, "Must be at least 3 characters")
				.max(11, "Must be at most 11 characters")
				.regex(/^[a-zA-Z0-9]+$/, "Letters and numbers only, no spaces"),
		})
	)
	.handler(async ({ input, context }) => {
		const { senderId, label } = input;

		// 1. Upsert DB record immediately (DB is source of truth regardless of Termii)
		const existing = await context.db.senderNumber.findFirst({
			where: { channel: "sms", userId: context.session.user.id },
		});

		let dbRecord: { id: string };
		if (existing) {
			dbRecord = await context.db.senderNumber.update({
				data: {
					isActive: false,
					label: label ?? existing.label ?? "Primary SMS Sender ID",
					number: senderId,
				},
				where: { id: existing.id },
			});
		} else {
			dbRecord = await context.db.senderNumber.create({
				data: {
					channel: "sms",
					isActive: false,
					label: label ?? "Primary SMS Sender ID",
					number: senderId,
					userId: context.session.user.id,
				},
			});
		}

		// 2. Submit to Termii
		const termiiApiKey = process.env.TERMII_API_KEY;
		if (!termiiApiKey) {
			invalidate(context.session.user.id, "profile.getSenderNumbers");
			return {
				dbId: dbRecord.id,
				reason:
					"Sender ID saved. TERMII_API_KEY not configured — submit manually via Termii dashboard.",
				senderId,
				submitted: false,
				success: true,
			};
		}

		const profile = await context.db.userProfile.findUnique({
			select: { orgName: true },
			where: { userId: context.session.user.id },
		});
		const companyName = profile?.orgName ?? "Velocast User";

		try {
			const res = await fetch(
				"https://v3.api.termii.com/api/sender-id/request",
				{
					body: JSON.stringify({
						api_key: termiiApiKey,
						company: companyName,
						sender_id: senderId,
						usecase:
							"Sending transactional and informational messages to our members and customers",
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				}
			);

			const data = (await res.json()) as { code?: string; message?: string };

			if (!res.ok) {
				return {
					dbId: dbRecord.id,
					reason: data.message ?? `Termii returned ${res.status}`,
					senderId,
					submitted: true,
					success: false,
				};
			}

			return {
				dbId: dbRecord.id,
				reason:
					data.message ??
					"Submitted — Termii & NCC approval takes 2–5 business days.",
				senderId,
				submitted: true,
				success: true,
			};
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			return {
				dbId: dbRecord.id,
				reason: `Network error submitting to Termii: ${error}`,
				senderId,
				submitted: false,
				success: false,
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
			select: { email: true },
			where: { id: context.session.user.id },
		});

		if (input.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
			throw new Error("Email does not match — account not deleted");
		}

		// Cascade deletes all related data via Prisma schema onDelete: Cascade
		await context.db.user.delete({ where: { id: context.session.user.id } });

		return { success: true };
	});
