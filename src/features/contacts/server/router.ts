import { z } from "zod";
import { protectedProcedure } from "#/orpc";

const ChannelSchema = z.enum(["whatsapp", "sms"]);
const ContactTypeSchema = z.enum([
	"first_timer",
	"returning",
	"member",
	"visitor",
]);

// ─── listContacts ─────────────────────────────────────────────────────────────

export const listContacts = protectedProcedure
	.input(
		z.object({
			search: z.string().optional(),
			channel: ChannelSchema.optional(),
			type: ContactTypeSchema.optional(),
			parseJobId: z.string().uuid().optional(),
			/** When true, return only phone numbers that appear more than once for this user */
			duplicatesOnly: z.boolean().default(false),
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(100).default(20),
		})
	)
	.handler(async ({ input, context }) => {
		try {
			const userId = context.session.user.id;

			const where = {
				uploadedBy: userId,
				...(input.parseJobId && { parseJobId: input.parseJobId }),
				...(input.channel && { channel: input.channel }),
				...(input.type && { type: input.type }),
				...(input.search && {
					OR: [
						{ name: { contains: input.search, mode: "insensitive" as const } },
						{ phone: { contains: input.search, mode: "insensitive" as const } },
						{ email: { contains: input.search, mode: "insensitive" as const } },
					],
				}),
			};

			const [total, contacts, duplicatePhones] = await Promise.all([
				context.db.contact.count({ where }),
				context.db.contact.findMany({
					where,
					orderBy: { createdAt: "desc" },
					skip: (input.page - 1) * input.pageSize,
					take: input.pageSize,
					include: {
						parseJob: {
							select: { id: true, originalFilename: true, createdAt: true },
						},
					},
				}),
				// Count how many phones appear more than once for this user
				// (after the unique constraint migration, this should always be 0 for new data,
				//  but we still query it to surface pre-migration duplicates)
				context.db.contact.groupBy({
					by: ["phone"],
					where: { uploadedBy: userId },
					_count: { id: true },
					having: { id: { _count: { gt: 1 } } },
				}),
			]);

			const duplicatePhoneSet = new Set(duplicatePhones.map((d) => d.phone));

			return {
				contacts: contacts.map((c) => ({
					id: c.id,
					name: c.name,
					phone: c.phone,
					channel: c.channel as "whatsapp" | "sms",
					type: c.type as "first_timer" | "returning" | "member" | "visitor",
					email: c.email,
					notes: c.notes,
					rawRow: c.rawRow,
					optedOut: c.optedOut,
					createdAt: c.createdAt.toISOString(),
					parseJobId: c.parseJobId,
					sourceFilename: c.parseJob.originalFilename,
					sourceCreatedAt: c.parseJob.createdAt.toISOString(),
					isDuplicate: duplicatePhoneSet.has(c.phone),
				})),
				pagination: {
					total,
					page: input.page,
					pageSize: input.pageSize,
					totalPages: Math.ceil(total / input.pageSize),
				},
				duplicateCount: duplicatePhoneSet.size,
			};
		} catch (error) {
			console.log(error);
		}
	});

// ─── getContact ───────────────────────────────────────────────────────────────

export const getContact = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const c = await context.db.contact.findFirst({
			where: { id: input.id, uploadedBy: context.session.user.id },
			include: {
				parseJob: {
					select: {
						id: true,
						originalFilename: true,
						createdAt: true,
						confidence: true,
					},
				},
			},
		});
		if (!c) {
			throw new Error(`Contact ${input.id} not found`);
		}

		return {
			id: c.id,
			name: c.name,
			phone: c.phone,
			channel: c.channel as "whatsapp" | "sms",
			type: c.type as "first_timer" | "returning" | "member" | "visitor",
			email: c.email,
			notes: c.notes,
			rawRow: c.rawRow,
			optedOut: c.optedOut,
			createdAt: c.createdAt.toISOString(),
			parseJobId: c.parseJobId,
			sourceFilename: c.parseJob.originalFilename,
			sourceCreatedAt: c.parseJob.createdAt.toISOString(),
			sourceConfidence: c.parseJob.confidence,
		};
	});

// ─── updateContact ────────────────────────────────────────────────────────────

export const updateContact = protectedProcedure
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			phone: z.string().min(7).optional(),
			channel: ChannelSchema.optional(),
			type: ContactTypeSchema.optional(),
			email: z.string().email().optional().nullable(),
			notes: z.string().optional().nullable(),
		})
	)
	.handler(async ({ input, context }) => {
		const { id, ...data } = input;
		const existing = await context.db.contact.findFirst({
			where: { id, uploadedBy: context.session.user.id },
		});
		if (!existing) {
			throw new Error("Contact not found");
		}

		// If phone is changing, check it won't conflict with another contact
		if (data.phone && data.phone !== existing.phone) {
			const conflict = await context.db.contact.findUnique({
				where: {
					uploadedBy_phone: {
						uploadedBy: context.session.user.id,
						phone: data.phone,
					},
				},
			});
			if (conflict && conflict.id !== id) {
				throw new Error(
					`Phone ${data.phone} already belongs to contact "${conflict.name}". ` +
						"Merge them instead of editing."
				);
			}
		}

		const updated = await context.db.contact.update({
			where: { id },
			data: { ...data },
		});

		return { success: true, id: updated.id };
	});

// ─── deleteContact ────────────────────────────────────────────────────────────

export const deleteContact = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const existing = await context.db.contact.findFirst({
			where: { id: input.id, uploadedBy: context.session.user.id },
		});
		if (!existing) {
			throw new Error("Contact not found");
		}
		await context.db.contact.delete({ where: { id: input.id } });
		return { success: true };
	});

// ─── deleteContacts (bulk) ────────────────────────────────────────────────────

export const deleteContacts = protectedProcedure
	.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
	.handler(async ({ input, context }) => {
		const { count } = await context.db.contact.deleteMany({
			where: { id: { in: input.ids }, uploadedBy: context.session.user.id },
		});
		return { success: true, deleted: count };
	});

// ─── getDuplicates ────────────────────────────────────────────────────────────

/**
 * Returns all duplicate groups for this user — phones that appear more than once.
 * Each group contains all Contact rows sharing that phone number.
 *
 * After the @@unique([userId, phone]) migration, new imports will never produce
 * duplicates (upsert merges them). This endpoint surfaces pre-migration duplicates
 * so the user can resolve them manually.
 */
export const getDuplicates = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id;

	// Find phones that appear more than once
	const duplicatePhones = await context.db.contact.groupBy({
		by: ["phone"],
		where: { uploadedBy: userId },
		_count: { id: true },
		having: { id: { _count: { gt: 1 } } },
		orderBy: { _count: { id: "desc" } },
	});

	if (duplicatePhones.length === 0) {
		return { groups: [], totalDuplicates: 0 };
	}

	// Fetch all contacts for those phones
	const contacts = await context.db.contact.findMany({
		where: {
			uploadedBy: userId,
			phone: { in: duplicatePhones.map((d) => d.phone) },
		},
		orderBy: { createdAt: "asc" },
		include: {
			parseJob: { select: { originalFilename: true, createdAt: true } },
		},
	});

	// Group by phone
	const groupMap = new Map<string, typeof contacts>();
	for (const c of contacts) {
		if (!groupMap.has(c.phone)) {
			groupMap.set(c.phone, []);
		}
		groupMap.get(c.phone)?.push(c);
	}

	const groups = [...groupMap.entries()].map(([phone, members]) => ({
		phone,
		count: members.length,
		members: members.map((c) => ({
			id: c.id,
			name: c.name,
			phone: c.phone,
			channel: c.channel as "whatsapp" | "sms",
			type: c.type,
			email: c.email,
			notes: c.notes,
			optedOut: c.optedOut,
			createdAt: c.createdAt.toISOString(),
			sourceFilename: c.parseJob.originalFilename,
			sourceDate: c.parseJob.createdAt.toISOString(),
		})),
	}));

	return {
		groups,
		totalDuplicates: contacts.length - duplicatePhones.length, // excess rows
	};
});

// ─── mergeContacts ────────────────────────────────────────────────────────────

/**
 * Merge duplicate contacts sharing the same phone number.
 *
 * The caller picks which contact to KEEP (winnerId). All other contacts
 * in the group are deleted. The winner's name/type/notes can optionally
 * be overridden in the same call.
 *
 * After merge, the winner retains the most conservative optedOut status
 * (if any of the duplicates was opted out, the merged record is opted out).
 */
export const mergeContacts = protectedProcedure
	.input(
		z.object({
			/** The contact whose row will be kept */
			winnerId: z.string().uuid(),
			/** All other contact ids in this duplicate group (will be deleted) */
			loserIds: z.array(z.string().uuid()).min(1),
			/** Optional overrides for the winner's fields */
			overrides: z
				.object({
					name: z.string().min(1).optional(),
					type: ContactTypeSchema.optional(),
					channel: ChannelSchema.optional(),
					notes: z.string().optional().nullable(),
				})
				.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// Load winner + losers, all scoped to this user
		const [winner, ...losers] = await Promise.all([
			context.db.contact.findFirst({
				where: { id: input.winnerId, uploadedBy: userId },
			}),
			...input.loserIds.map((id) =>
				context.db.contact.findFirst({ where: { id, uploadedBy: userId } })
			),
		]);

		if (!winner) {
			throw new Error("Winner contact not found");
		}
		const validLosers = losers.filter(Boolean) as NonNullable<typeof winner>[];
		if (validLosers.length === 0) {
			throw new Error("No valid contacts to merge");
		}

		// Conservative opt-out: if any duplicate was opted out, the merged contact is too
		const anyOptedOut = validLosers.some((l) => l.optedOut) || winner.optedOut;

		await context.db.$transaction([
			// Update winner with overrides + opt-out resolution
			context.db.contact.update({
				where: { id: winner.id },
				data: {
					...input.overrides,
					optedOut: anyOptedOut,
					optedOutAt:
						anyOptedOut && !winner.optedOut ? new Date() : winner.optedOutAt,
				},
			}),
			// Delete all losers
			context.db.contact.deleteMany({
				where: { id: { in: validLosers.map((l) => l.id) }, uploadedBy: userId },
			}),
		]);

		return {
			success: true,
			kept: winner.id,
			deleted: validLosers.length,
			optedOut: anyOptedOut,
		};
	});

// ─── autoMergeDuplicates ──────────────────────────────────────────────────────

/**
 * One-click: automatically merge all duplicate groups for this user.
 *
 * Strategy for each group:
 *   - Winner = the most recently created contact (most up-to-date import)
 *   - Losers = all others deleted
 *   - optedOut is propagated conservatively (any opted-out wins)
 *
 * Returns count of groups resolved and contacts deleted.
 */
export const autoMergeDuplicates = protectedProcedure.handler(
	async ({ context }) => {
		const userId = context.session.user.id;

		const duplicatePhones = await context.db.contact.groupBy({
			by: ["phone"],
			where: { uploadedBy: userId },
			_count: { id: true },
			having: { id: { _count: { gt: 1 } } },
		});

		if (duplicatePhones.length === 0) {
			return { success: true, groupsResolved: 0, contactsDeleted: 0 };
		}

		let totalDeleted = 0;

		for (const { phone } of duplicatePhones) {
			const group = await context.db.contact.findMany({
				where: { uploadedBy: userId, phone },
				orderBy: { createdAt: "desc" }, // newest first → [0] is the winner
			});
			if (group.length < 2) {
				continue;
			}

			const [winner, ...losers] = group;
			const anyOptedOut = group.some((c) => c.optedOut);

			await context.db.$transaction([
				context.db.contact.update({
					where: { id: winner.id },
					data: {
						optedOut: anyOptedOut,
						optedOutAt:
							anyOptedOut && !winner.optedOut ? new Date() : winner.optedOutAt,
					},
				}),
				context.db.contact.deleteMany({
					where: { id: { in: losers.map((l) => l.id) }, uploadedBy: userId },
				}),
			]);

			totalDeleted += losers.length;
		}

		return {
			success: true,
			groupsResolved: duplicatePhones.length,
			contactsDeleted: totalDeleted,
		};
	}
);
