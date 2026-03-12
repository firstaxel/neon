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
				input.duplicatesOnly
					? context.db.contact.groupBy({
							by: ["phone"],
							where: { uploadedBy: userId },
							_count: { id: true },
							having: { id: { _count: { gt: 1 } } },
						})
					: Promise.resolve([]),
			]);

			const duplicatePhoneSet = new Set(duplicatePhones.map((d) => d.phone));

			return {
				contacts: contacts.map((c) => ({
					id: c.id,
					name: c.name,
					phone: c.phone,
					channel: c.channel as "whatsapp" | "sms",
					type: c.type as "new_contact" | "returning" | "contact" | "prospect",
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
		})
	);

// ─── getContact ───────────────────────────────────────────────────────────────

export const getContact = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(
		withCache("contacts.get", 30_000, async ({ input, context }) => {
			const c = await context.db.contact.findFirst({
				where: { id: input.id, uploadedBy: context.session?.user.id },
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
				type: c.type as "new_contact" | "returning" | "contact" | "prospect",
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
		})
	);

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

		invalidateMany(userId, ["contacts.list", "contacts.get"]);
		return { success: true, id: updated.id };
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

		invalidate(userId, "contacts.list");
		return {
			success: true,
			groupsResolved: duplicatePhones.length,
			contactsDeleted: totalDeleted,
		};
	}
);

// ─── createContact ────────────────────────────────────────────────────────────

export const createContact = protectedProcedure
	.input(
		z.object({
			name: z.string().min(1, "Name is required"),
			phone: z.string().min(7, "Phone is required"),
			channel: ChannelSchema,
			type: ContactTypeSchema,
			email: z.string().email("Invalid email").optional().nullable(),
			notes: z.string().optional().nullable(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// Check for duplicate phone for this user
		const existing = await context.db.contact.findUnique({
			where: {
				uploadedBy_phone: {
					uploadedBy: userId,
					phone: input.phone,
				},
			},
		});
		if (existing) {
			throw new Error(
				`A contact with phone ${input.phone} already exists ("${existing.name}").`
			);
		}

		// Manual contacts need a parse job to satisfy the FK constraint.
		// We upsert a single "manual-{userId}" parse job so all manual contacts
		// share one row rather than creating a new job per contact.
		const parseJobId = `manual-${userId}`;
		await context.db.parseJob.upsert({
			where: { id: parseJobId },
			create: {
				id: parseJobId,
				parsedBy: userId,
				status: "done",
				originalFilename: "Manual entry",
				confidence: 1,
				mimeType: "text/plain",
				r2Bucket: "manual",
				r2Key: "manual",
			},
			update: {},
		});

		const contact = await context.db.contact.create({
			data: {
				uploadedBy: userId,
				parseJobId,
				name: input.name,
				phone: input.phone,
				channel: input.channel,
				type: input.type,
				email: input.email ?? null,
				notes: input.notes ?? null,
			},
		});

		invalidate(userId, "contacts.list");
		return {
			id: contact.id,
			name: contact.name,
			phone: contact.phone,
			channel: contact.channel as "whatsapp" | "sms",
			type: contact.type as "new_contact" | "returning" | "contact" | "prospect",
		};
	});

// ─── exportContacts ───────────────────────────────────────────────────────────

export const exportContacts = protectedProcedure
	.input(
		z.object({
			format: z.enum(["csv", "xlsx"]).default("csv"),
			channel: ChannelSchema.optional(),
			type: ContactTypeSchema.optional(),
			search: z.string().optional(),
			campaignId: z.string().optional(),
			/** ISO date string — contacts last messaged on/after this date */
			lastContactedFrom: z.string().optional(),
			/** ISO date string — contacts last messaged on/before this date */
			lastContactedTo: z.string().optional(),
			/** If true, only export contacts that have not opted out */
			activeOnly: z.boolean().default(false),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;

		// If user is a member, use owner's contacts
		const membership = await context.db.orgMember.findFirst({
			where: { userId },
			select: { ownerId: true },
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
				where: { campaignId: input.campaignId },
				select: { phone: true },
				distinct: ["phone"],
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
			where,
			orderBy: { createdAt: "desc" },
			select: {
				name: true,
				phone: true,
				email: true,
				channel: true,
				type: true,
				notes: true,
				createdAt: true,
				lastInboundAt: true,
			},
		});

		// Build rows
		const rows = contacts.map((c: any) => ({
			Name: c.name ?? "",
			Phone: c.phone,
			Email: c.email ?? "",
			Channel: c.channel,
			Type: c.type ?? "",
			Notes: c.notes ?? "",
			"Added on": c.createdAt.toISOString().slice(0, 10),
			"Last replied": c.lastInboundAt
				? c.lastInboundAt.toISOString().slice(0, 10)
				: "",
		}));

		if (input.format === "csv") {
			if (rows.length === 0) {
				return { format: "csv", content: "", count: 0 };
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
			return { format: "csv" as const, content: csv, count: rows.length };
		}

		// XLSX — use the xlsx library (SheetJS)
		const XLSX = await import("xlsx");
		const ws = XLSX.utils.json_to_sheet(rows);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Contacts");
		// Return as base64 so it can be sent over JSON
		const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
		return { format: "xlsx" as const, content: buf, count: rows.length };
	});
