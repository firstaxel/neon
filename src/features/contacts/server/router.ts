import { z } from "zod";
import { invalidate, invalidateMany, withCache } from "#/lib/cache";
import { protectedProcedure } from "#/orpc";

const ChannelSchema = z.enum(["whatsapp", "sms"]);
const ContactTypeSchema = z.enum([
	"new_contact",
	"returning",
	"contact",
	"prospect",
]);

// ─── listContacts ─────────────────────────────────────────────────────────────

export const listContacts = protectedProcedure
	.input(
		z.object({
			channel: ChannelSchema.optional(),
			/** When true, return only phone numbers that appear more than once for this user */
			duplicatesOnly: z.boolean().default(false),
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(100).default(20),
			parseJobId: z.string().uuid().optional(),
			search: z.string().optional(),
			type: ContactTypeSchema.optional(),
		})
	)
	.handler(
		withCache("contacts.list", 30_000, async ({ input, context }) => {
			const userId = context.session?.user.id;

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

			// Only run the full-table duplicate scan when the caller explicitly requests it.
			// This is an expensive groupBy over all contacts for the user — running it on
			// every page load would add ~50ms to every contacts request.
			const [total, contacts, duplicatePhones] = await Promise.all([
				context.db.contact.count({ where }),
				context.db.contact.findMany({
					include: {
						parseJob: {
							select: { createdAt: true, id: true, originalFilename: true },
						},
					},
					orderBy: { createdAt: "desc" },
					skip: (input.page - 1) * input.pageSize,
					take: input.pageSize,
					where,
				}),
				input.duplicatesOnly
					? context.db.contact.groupBy({
							_count: { id: true },
							by: ["phone"],
							having: { id: { _count: { gt: 1 } } },
							where: { uploadedBy: userId },
						})
					: Promise.resolve([]),
			]);

			const duplicatePhoneSet = new Set(duplicatePhones.map((d) => d.phone));

			return {
				contacts: contacts.map((c) => ({
					channel: c.channel as "whatsapp" | "sms",
					createdAt: c.createdAt.toISOString(),
					email: c.email,
					id: c.id,
					isDuplicate: duplicatePhoneSet.has(c.phone),
					name: c.name,
					notes: c.notes,
					optedOut: c.optedOut,
					parseJobId: c.parseJobId,
					phone: c.phone,
					rawRow: c.rawRow,
					sourceCreatedAt: c.parseJob?.createdAt?.toISOString() ?? null,
					sourceFilename: c.parseJob?.originalFilename ?? null,
					tags: c.tags,
					type: c.type as "new_contact" | "returning" | "contact" | "prospect",
				})),
				duplicateCount: duplicatePhoneSet.size,
				pagination: {
					page: input.page,
					pageSize: input.pageSize,
					total,
					totalPages: Math.ceil(total / input.pageSize),
				},
			};
		})
	);

// ─── getContact ───────────────────────────────────────────────────────────────

export const getContact = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(
		withCache("contacts.get", 30_000, async ({ input, context }) => {
			const c = await context.db.contact.findFirst({
				include: {
					parseJob: {
						select: {
							confidence: true,
							createdAt: true,
							id: true,
							originalFilename: true,
						},
					},
				},
				where: { id: input.id, uploadedBy: context.session?.user.id },
			});
			if (!c) {
				throw new Error(`Contact ${input.id} not found`);
			}

			return {
				channel: c.channel as "whatsapp" | "sms",
				createdAt: c.createdAt.toISOString(),
				email: c.email,
				id: c.id,
				name: c.name,
				notes: c.notes,
				optedOut: c.optedOut,
				parseJobId: c.parseJobId,
				phone: c.phone,
				rawRow: c.rawRow,
				sourceConfidence: c.parseJob?.confidence ?? null,
				sourceCreatedAt: c.parseJob?.createdAt?.toISOString() ?? null,
				sourceFilename: c.parseJob?.originalFilename ?? null,
				tags: c.tags,
				type: c.type as "new_contact" | "returning" | "contact" | "prospect",
			};
		})
	);

// ─── updateContact ────────────────────────────────────────────────────────────

export const updateContact = protectedProcedure
	.input(
		z.object({
			channel: ChannelSchema.optional(),
			email: z.string().email().optional().nullable(),
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			notes: z.string().optional().nullable(),
			phone: z.string().min(7).optional(),
			type: ContactTypeSchema.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const { id, ...data } = input;
		const userId = context.session.user.id;
		const existing = await context.db.contact.findFirst({
			where: { id, uploadedBy: userId },
		});
		if (!existing) {
			throw new Error("Contact not found");
		}

		// If phone is changing, check it won't conflict with another contact
		if (data.phone && data.phone !== existing.phone) {
			const conflict = await context.db.contact.findUnique({
				where: {
					uploadedBy_phone: {
						phone: data.phone,
						uploadedBy: context.session.user.id,
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
			data: { ...data },
			where: { id },
		});

		invalidateMany(userId, ["contacts.list", "contacts.get"]);
		return { id: updated.id, success: true };
	});

// ─── deleteContact ────────────────────────────────────────────────────────────

export const deleteContact = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const existing = await context.db.contact.findFirst({
			where: { id: input.id, uploadedBy: userId },
		});
		if (!existing) {
			throw new Error("Contact not found");
		}
		await context.db.contact.delete({ where: { id: input.id } });
		invalidateMany(userId, ["contacts.list", "contacts.get"]);
		return { success: true };
	});

// ─── deleteContacts (bulk) ────────────────────────────────────────────────────

export const deleteContacts = protectedProcedure
	.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const { count } = await context.db.contact.deleteMany({
			where: { id: { in: input.ids }, uploadedBy: userId },
		});
		invalidate(userId, "contacts.list");
		return { deleted: count, success: true };
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
		_count: { id: true },
		by: ["phone"],
		having: { id: { _count: { gt: 1 } } },
		orderBy: { _count: { id: "desc" } },
		where: { uploadedBy: userId },
	});

	if (duplicatePhones.length === 0) {
		return { groups: [], totalDuplicates: 0 };
	}

	// Fetch all contacts for those phones
	const contacts = await context.db.contact.findMany({
		include: {
			parseJob: { select: { createdAt: true, originalFilename: true } },
		},
		orderBy: { createdAt: "asc" },
		where: {
			phone: { in: duplicatePhones.map((d) => d.phone) },
			uploadedBy: userId,
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
		count: members.length,
		members: members.map((c) => ({
			channel: c.channel as "whatsapp" | "sms",
			createdAt: c.createdAt.toISOString(),
			email: c.email,
			id: c.id,
			name: c.name,
			notes: c.notes,
			optedOut: c.optedOut,
			phone: c.phone,
			sourceDate: c.parseJob?.createdAt?.toISOString() ?? null,
			sourceFilename: c.parseJob?.originalFilename ?? null,
			type: c.type,
		})),
		phone,
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
			/** All other contact ids in this duplicate group (will be deleted) */
			loserIds: z.array(z.string().uuid()).min(1),
			/** Optional overrides for the winner's fields */
			overrides: z
				.object({
					channel: ChannelSchema.optional(),
					name: z.string().min(1).optional(),
					notes: z.string().optional().nullable(),
					type: ContactTypeSchema.optional(),
				})
				.optional(),
			/** The contact whose row will be kept */
			winnerId: z.string().uuid(),
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
				data: {
					...input.overrides,
					optedOut: anyOptedOut,
					optedOutAt:
						anyOptedOut && !winner.optedOut ? new Date() : winner.optedOutAt,
				},
				where: { id: winner.id },
			}),
			// Delete all losers
			context.db.contact.deleteMany({
				where: { id: { in: validLosers.map((l) => l.id) }, uploadedBy: userId },
			}),
		]);

		return {
			deleted: validLosers.length,
			kept: winner.id,
			optedOut: anyOptedOut,
			success: true,
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
			_count: { id: true },
			by: ["phone"],
			having: { id: { _count: { gt: 1 } } },
			where: { uploadedBy: userId },
		});

		if (duplicatePhones.length === 0) {
			return { contactsDeleted: 0, groupsResolved: 0, success: true };
		}

		let totalDeleted = 0;

		for (const { phone } of duplicatePhones) {
			const group = await context.db.contact.findMany({
				orderBy: { createdAt: "desc" }, // newest first → [0] is the winner
				where: { phone, uploadedBy: userId },
			});
			if (group.length < 2) {
				continue;
			}

			const [winner, ...losers] = group;
			const anyOptedOut = group.some((c) => c.optedOut);

			await context.db.$transaction([
				context.db.contact.update({
					data: {
						optedOut: anyOptedOut,
						optedOutAt:
							anyOptedOut && !winner.optedOut ? new Date() : winner.optedOutAt,
					},
					where: { id: winner.id },
				}),
				context.db.contact.deleteMany({
					where: { id: { in: losers.map((l) => l.id) }, uploadedBy: userId },
				}),
			]);

			totalDeleted += losers.length;
		}

		invalidate(userId, "contacts.list");
		return {
			contactsDeleted: totalDeleted,
			groupsResolved: duplicatePhones.length,
			success: true,
		};
	}
);

// ─── createContact ────────────────────────────────────────────────────────────

export const createContact = protectedProcedure
	.input(
		z.object({
			channel: ChannelSchema,
			email: z.string().email("Invalid email").optional().nullable(),
			name: z.string().min(1, "Name is required"),
			notes: z.string().optional().nullable(),
			phone: z.string().min(7, "Phone is required"),
			tags: z.array(z.string()).default([]),
			type: ContactTypeSchema,
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// Check for duplicate phone for this user
		const existing = await context.db.contact.findUnique({
			where: {
				uploadedBy_phone: {
					phone: input.phone,
					uploadedBy: userId,
				},
			},
		});
		if (existing) {
			throw new Error(
				`A contact with phone ${input.phone} already exists ("${existing.name}").`
			);
		}

		const contact = await context.db.contact.create({
			data: {
				channel: input.channel,
				email: input.email ?? null,
				name: input.name,
				notes: input.notes ?? null,
				parseJobId: null,
				phone: input.phone,
				tags: input.tags ?? [],
				type: input.type,
				uploadedBy: userId,
			},
		});

		invalidate(userId, "contacts.list");
		return {
			channel: contact.channel as "whatsapp" | "sms",
			id: contact.id,
			name: contact.name,
			phone: contact.phone,
			tags: contact.tags,
			type: contact.type as
				| "new_contact"
				| "returning"
				| "contact"
				| "prospect",
		};
	});

// ─── exportContacts ───────────────────────────────────────────────────────────

export const exportContacts = protectedProcedure
	.input(
		z.object({
			/** If true, only export contacts that have not opted out */
			activeOnly: z.boolean().default(false),
			campaignId: z.string().optional(),
			channel: ChannelSchema.optional(),
			format: z.enum(["csv", "xlsx"]).default("csv"),
			/** ISO date string — contacts last messaged on/after this date */
			lastContactedFrom: z.string().optional(),
			/** ISO date string — contacts last messaged on/before this date */
			lastContactedTo: z.string().optional(),
			search: z.string().optional(),
			type: ContactTypeSchema.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// If user is a member, use owner's contacts
		const membership = await context.db.orgMember.findFirst({
			select: { ownerId: true },
			where: { userId },
		});
		const ownerId = membership?.ownerId ?? userId;

		// Build the Prisma where clause
		const where: Record<string, any> = {
			uploadedBy: ownerId,
			...(input.channel && { channel: input.channel }),
			...(input.type && { type: input.type }),
			...(input.activeOnly && { optedOut: false }),
			...(input.search && {
				OR: [
					{ name: { contains: input.search, mode: "insensitive" } },
					{ phone: { contains: input.search, mode: "insensitive" } },
					{ email: { contains: input.search, mode: "insensitive" } },
				],
			}),
		};

		// Filter by campaign: find contacts who received a message in that campaign
		if (input.campaignId) {
			const messagePhones = await context.db.message.findMany({
				distinct: ["phone"],
				select: { phone: true },
				where: { campaignId: input.campaignId },
			});
			where.phone = { in: messagePhones.map((m: any) => m.phone) };
		}

		// Filter by last contacted date (uses lastInboundAt or createdAt of latest message)
		if (input.lastContactedFrom || input.lastContactedTo) {
			where.lastInboundAt = {
				...(input.lastContactedFrom && {
					gte: new Date(input.lastContactedFrom),
				}),
				...(input.lastContactedTo && { lte: new Date(input.lastContactedTo) }),
			};
		}

		const contacts = await context.db.contact.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				channel: true,
				createdAt: true,
				email: true,
				lastInboundAt: true,
				name: true,
				notes: true,
				phone: true,
				type: true,
			},
			where,
		});

		// Build rows
		const rows = contacts.map((c: any) => ({
			"Added on": c.createdAt.toISOString().slice(0, 10),
			Channel: c.channel,
			Email: c.email ?? "",
			"Last replied": c.lastInboundAt
				? c.lastInboundAt.toISOString().slice(0, 10)
				: "",
			Name: c.name ?? "",
			Notes: c.notes ?? "",
			Phone: c.phone,
			Type: c.type ?? "",
		}));

		if (input.format === "csv") {
			if (rows.length === 0) {
				return { content: "", count: 0, format: "csv" };
			}
			const headers = Object.keys(rows[0]);
			const stringEscape = (v: string) =>
				v.includes(",") || v.includes('"') || v.includes("\n")
					? `"${v.replace(/"/g, '""')}"`
					: v;
			const csv = [
				headers.join(","),
				...rows.map((r) =>
					headers.map((h) => stringEscape(r[h as keyof typeof r])).join(",")
				),
			].join("\n");
			return { content: csv, count: rows.length, format: "csv" as const };
		}

		// XLSX — use the xlsx library (SheetJS)
		const XLSX = await import("xlsx");
		const ws = XLSX.utils.json_to_sheet(rows);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Contacts");
		// Return as base64 so it can be sent over JSON
		const buf = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
		return { content: buf, count: rows.length, format: "xlsx" as const };
	});
