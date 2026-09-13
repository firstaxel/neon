import { z } from "zod";
import { invalidate, invalidateMany, withCache } from "#/lib/cache";
import { protectedProcedure } from "#/orpc";
import { normalizePhoneNumber } from "../utils/phone";

const ChannelSchema = z.enum(["whatsapp", "sms"]);
const ContactTypeSchema = z.enum([
	"new_contact",
	"returning",
	"contact",
	"prospect",
]);

/**
 * Resolves the workspace organization owner identifier.
 * If the current user belongs to an organization, returns the owner ID.
 * Otherwise, falls back to the current user ID.
 */
async function resolveOrgOwnerId(db: any, userId: string): Promise<string> {
	if (!db.orgMember?.findFirst) {
		return userId;
	}
	const membership = await db.orgMember.findFirst({
		select: { ownerId: true },
		where: { userId },
	});
	return membership?.ownerId ?? userId;
}

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
			tag: z.string().optional(),
			type: ContactTypeSchema.optional(),
		})
	)
	.handler(
		withCache("contacts.list", 30_000, async ({ input, context }) => {
			if (!context.session?.user.id) {
				throw new Error("Unauthorized");
			}
			const userId = context.session.user.id;
			const ownerId = await resolveOrgOwnerId(context.db, userId);

			const where: Record<string, any> = {
				uploadedBy: ownerId,
				...(input.parseJobId && { parseJobId: input.parseJobId }),
				...(input.channel && { channel: input.channel }),
				...(input.type && { type: input.type }),
				...(input.tag && { tags: { has: input.tag } }),
				...(input.search && {
					OR: [
						{ name: { contains: input.search, mode: "insensitive" as const } },
						{ phone: { contains: input.search, mode: "insensitive" as const } },
						{ email: { contains: input.search, mode: "insensitive" as const } },
					],
				}),
			};

			// Only run the full table duplicate scan when the caller explicitly requests it.
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
							where: { uploadedBy: ownerId },
						})
					: Promise.resolve([]),
			]);

			const duplicatePhoneSet = new Set(
				duplicatePhones.map((d: any) => d.phone)
			);

			return {
				contacts: contacts.map((c: any) => ({
					channel: c.channel as "whatsapp" | "sms",
					createdAt: c.createdAt.toISOString(),
					email: c.email,
					id: c.id,
					importBatchId: c.importBatchId,
					isDuplicate: duplicatePhoneSet.has(c.phone),
					metadata: c.metadata ?? null,
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
			if (!context.session?.user.id) {
				throw new Error("Unauthorized");
			}
			const userId = context.session.user.id;
			const ownerId = await resolveOrgOwnerId(context.db, userId);

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
				where: { id: input.id, uploadedBy: ownerId },
			});
			if (!c) {
				throw new Error(`Contact ${input.id} not found`);
			}

			return {
				channel: c.channel as "whatsapp" | "sms",
				createdAt: c.createdAt.toISOString(),
				email: c.email,
				id: c.id,
				importBatchId: c.importBatchId,
				metadata: c.metadata ?? null,
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
			tags: z.array(z.string()).optional(),
			type: ContactTypeSchema.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const { id, ...data } = input;
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const existing = await context.db.contact.findFirst({
			where: { id, uploadedBy: ownerId },
		});
		if (!existing) {
			throw new Error("Contact not found");
		}

		let phoneToUpdate = data.phone;
		if (data.phone) {
			const norm = normalizePhoneNumber(data.phone, "NG");
			phoneToUpdate = norm.success && norm.phone ? norm.phone : data.phone;

			if (phoneToUpdate !== existing.phone) {
				const conflict = await context.db.contact.findUnique({
					where: {
						uploadedBy_phone: {
							phone: phoneToUpdate,
							uploadedBy: ownerId,
						},
					},
				});
				if (conflict && conflict.id !== id) {
					throw new Error(
						`Phone ${phoneToUpdate} already belongs to contact "${conflict.name}". ` +
							"Merge them instead of editing."
					);
				}
			}
		}

		const updated = await context.db.contact.update({
			data: {
				...data,
				...(phoneToUpdate && { phone: phoneToUpdate }),
			},
			where: { id },
		});

		invalidateMany(ownerId, ["contacts.list", "contacts.get"]);
		return { id: updated.id, success: true };
	});

// ─── deleteContact ────────────────────────────────────────────────────────────

export const deleteContact = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const existing = await context.db.contact.findFirst({
			where: { id: input.id, uploadedBy: ownerId },
		});
		if (!existing) {
			throw new Error("Contact not found");
		}
		await context.db.contact.delete({ where: { id: input.id } });
		invalidateMany(ownerId, ["contacts.list", "contacts.get"]);
		return { success: true };
	});

// ─── deleteContacts (bulk) ────────────────────────────────────────────────────

export const deleteContacts = protectedProcedure
	.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const { count } = await context.db.contact.deleteMany({
			where: { id: { in: input.ids }, uploadedBy: ownerId },
		});
		invalidate(ownerId, "contacts.list");
		return { deleted: count, success: true };
	});

// ─── getDuplicates ────────────────────────────────────────────────────────────

export const getDuplicates = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id;
	const ownerId = await resolveOrgOwnerId(context.db, userId);

	const duplicatePhones = await context.db.contact.groupBy({
		_count: { id: true },
		by: ["phone"],
		having: { id: { _count: { gt: 1 } } },
		orderBy: { _count: { id: "desc" } },
		where: { uploadedBy: ownerId },
	});

	if (duplicatePhones.length === 0) {
		return { groups: [], totalDuplicates: 0 };
	}

	const contacts = await context.db.contact.findMany({
		include: {
			parseJob: { select: { createdAt: true, originalFilename: true } },
		},
		orderBy: { createdAt: "asc" },
		where: {
			phone: { in: duplicatePhones.map((d: any) => d.phone) },
			uploadedBy: ownerId,
		},
	});

	const groupMap = new Map<string, typeof contacts>();
	for (const c of contacts) {
		if (!groupMap.has(c.phone)) {
			groupMap.set(c.phone, []);
		}
		groupMap.get(c.phone)?.push(c);
	}

	const groups = [...groupMap.entries()].map(([phone, members]) => ({
		count: members.length,
		members: members.map((c: any) => ({
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
		totalDuplicates: contacts.length - duplicatePhones.length,
	};
});

// ─── mergeContacts ────────────────────────────────────────────────────────────

export const mergeContacts = protectedProcedure
	.input(
		z.object({
			loserIds: z.array(z.string().uuid()).min(1),
			overrides: z
				.object({
					channel: ChannelSchema.optional(),
					name: z.string().min(1).optional(),
					notes: z.string().optional().nullable(),
					type: ContactTypeSchema.optional(),
				})
				.optional(),
			winnerId: z.string().uuid(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const [winner, ...losers] = await Promise.all([
			context.db.contact.findFirst({
				where: { id: input.winnerId, uploadedBy: ownerId },
			}),
			...input.loserIds.map((id) =>
				context.db.contact.findFirst({ where: { id, uploadedBy: ownerId } })
			),
		]);

		if (!winner) {
			throw new Error("Winner contact not found");
		}
		const validLosers = losers.filter(Boolean) as NonNullable<typeof winner>[];
		if (validLosers.length === 0) {
			throw new Error("No valid contacts to merge");
		}

		const anyOptedOut = validLosers.some((l) => l.optedOut) || winner.optedOut;

		await context.db.$transaction([
			context.db.contact.update({
				data: {
					...input.overrides,
					optedOut: anyOptedOut,
					optedOutAt:
						anyOptedOut && !winner.optedOut ? new Date() : winner.optedOutAt,
				},
				where: { id: winner.id },
			}),
			context.db.contact.deleteMany({
				where: {
					id: { in: validLosers.map((l) => l.id) },
					uploadedBy: ownerId,
				},
			}),
		]);

		invalidateMany(ownerId, ["contacts.list", "contacts.get"]);

		return {
			deleted: validLosers.length,
			kept: winner.id,
			optedOut: anyOptedOut,
			success: true,
		};
	});

// ─── autoMergeDuplicates ──────────────────────────────────────────────────────

export const autoMergeDuplicates = protectedProcedure.handler(
	async ({ context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const duplicatePhones = await context.db.contact.groupBy({
			_count: { id: true },
			by: ["phone"],
			having: { id: { _count: { gt: 1 } } },
			where: { uploadedBy: ownerId },
		});

		if (duplicatePhones.length === 0) {
			return { contactsDeleted: 0, groupsResolved: 0, success: true };
		}

		let totalDeleted = 0;

		for (const { phone } of duplicatePhones) {
			// biome-ignore lint/performance/noAwaitInLoops: sequential deduplication to avoid deadlock across groups
			const group = await context.db.contact.findMany({
				orderBy: { createdAt: "desc" },
				where: { phone, uploadedBy: ownerId },
			});
			if (group.length < 2) {
				continue;
			}

			const [winner, ...losers] = group;
			const anyOptedOut = group.some((c: { optedOut: boolean }) => c.optedOut);

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
					where: {
						id: { in: losers.map((l: { id: string }) => l.id) },
						uploadedBy: ownerId,
					},
				}),
			]);

			totalDeleted += losers.length;
		}

		invalidate(ownerId, "contacts.list");
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
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const norm = normalizePhoneNumber(input.phone, "NG");
		const normalizedPhone =
			norm.success && norm.phone ? norm.phone : input.phone;

		// Check for duplicate phone for this owner
		const existing = await context.db.contact.findUnique({
			where: {
				uploadedBy_phone: {
					phone: normalizedPhone,
					uploadedBy: ownerId,
				},
			},
		});
		if (existing) {
			throw new Error(
				`A contact with phone ${normalizedPhone} already exists ("${existing.name}").`
			);
		}

		const contact = await context.db.contact.create({
			data: {
				channel: input.channel,
				email: input.email ?? null,
				name: input.name,
				notes: input.notes ?? null,
				parseJobId: null,
				phone: normalizedPhone,
				tags: input.tags ?? [],
				type: input.type,
				uploadedBy: ownerId,
			},
		});

		invalidate(ownerId, "contacts.list");
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

// ─── importContactsBatch ──────────────────────────────────────────────────────

const ImportBatchContactSchema = z.object({
	channel: ChannelSchema.optional(),
	email: z.string().optional().nullable(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
	name: z.string().min(1, "Name is required"),
	notes: z.string().optional().nullable(),
	phone: z.string().min(1, "Phone is required"),
	rawRow: z.string().optional().nullable(),
	rowNumber: z.number().int().optional(),
	tags: z.array(z.string()).optional(),
	type: ContactTypeSchema.optional(),
});

interface UpsertContactParams {
	batchId: string;
	channel: "whatsapp" | "sms";
	defaultTags: string[];
	email: string | null;
	metadata?: Record<string, unknown> | null;
	name: string;
	notes: string | null;
	ownerId: string;
	phone: string;
	rawRow: string | null;
	rowTags: string[];
	strategy: "skip_duplicates" | "overwrite" | "tags_only";
	type: "new_contact" | "returning" | "contact" | "prospect";
}

async function persistContactRow(
	// biome-ignore lint/suspicious/noExplicitAny: prisma database client
	db: any,
	params: UpsertContactParams
): Promise<"created" | "updated" | "skipped"> {
	const mergedTags = Array.from(
		new Set([...params.rowTags, ...params.defaultTags])
	);

	const existing = await db.contact.findUnique({
		where: {
			uploadedBy_phone: {
				phone: params.phone,
				uploadedBy: params.ownerId,
			},
		},
	});

	if (!existing) {
		await db.contact.create({
			data: {
				channel: params.channel,
				email: params.email,
				importBatchId: params.batchId,
				// biome-ignore lint/suspicious/noExplicitAny: prisma metadata input
				metadata: (params.metadata ?? undefined) as any,
				name: params.name,
				notes: params.notes,
				parseJobId: null,
				phone: params.phone,
				rawRow: params.rawRow,
				tags: mergedTags,
				type: params.type,
				uploadedBy: params.ownerId,
			},
		});
		return "created";
	}

	if (params.strategy === "skip_duplicates") {
		return "skipped";
	}

	if (params.strategy === "tags_only") {
		const combinedTags = Array.from(new Set([...existing.tags, ...mergedTags]));
		await db.contact.update({
			data: {
				importBatchId: params.batchId,
				tags: combinedTags,
			},
			where: { id: existing.id },
		});
		return "updated";
	}

	const updateData: Record<string, unknown> = {
		channel: params.channel,
		importBatchId: params.batchId,
		tags: Array.from(new Set([...existing.tags, ...mergedTags])),
		type: params.type,
	};
	if (params.name) {
		updateData.name = params.name;
	}
	if (params.email) {
		updateData.email = params.email;
	}
	if (params.notes) {
		updateData.notes = params.notes;
	}
	if (params.metadata) {
		updateData.metadata = {
			...(typeof existing.metadata === "object" && existing.metadata
				? (existing.metadata as Record<string, unknown>)
				: {}),
			...params.metadata,
		};
	}
	await db.contact.update({
		data: updateData,
		where: { id: existing.id },
	});
	return "updated";
}

async function getOrCreateBatch(
	// biome-ignore lint/suspicious/noExplicitAny: prisma database client
	db: any,
	input: {
		contactsCount: number;
		defaultTags: string[];
		filename: string;
		importBatchId?: string;
		isLastChunk: boolean;
		strategy: "skip_duplicates" | "overwrite" | "tags_only";
		totalRows?: number;
	},
	ownerId: string,
	userId: string
): Promise<{ batchId: string; initialErrors: unknown[] }> {
	if (input.importBatchId) {
		const existingBatch = await db.contactImport.findFirst({
			where: { id: input.importBatchId, ownerId },
		});
		if (!existingBatch) {
			throw new Error(`Import batch ${input.importBatchId} not found`);
		}
		return {
			batchId: input.importBatchId,
			initialErrors: Array.isArray(existingBatch.errors)
				? existingBatch.errors
				: [],
		};
	}

	const newBatch = await db.contactImport.create({
		data: {
			filename: input.filename,
			ownerId,
			status: input.isLastChunk ? "completed" : "in_progress",
			strategy: input.strategy,
			tagsApplied: input.defaultTags,
			totalRows: input.totalRows ?? input.contactsCount,
			uploadedBy: userId,
		},
	});
	return { batchId: newBatch.id, initialErrors: [] };
}

export const importContactsBatch = protectedProcedure
	.input(
		z.object({
			contacts: z.array(ImportBatchContactSchema).min(1).max(250),
			defaultChannel: ChannelSchema.default("whatsapp"),
			defaultTags: z.array(z.string()).default([]),
			defaultType: ContactTypeSchema.default("prospect"),
			filename: z.string().min(1),
			importBatchId: z.string().uuid().optional(),
			isLastChunk: z.boolean().default(false),
			strategy: z
				.enum(["skip_duplicates", "overwrite", "tags_only"])
				.default("skip_duplicates"),
			totalRows: z.number().int().min(1).optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		// Execute batch chunk ingestion atomically within an interactive transaction
		// biome-ignore lint/suspicious/noExplicitAny: prisma transaction client
		const result = await context.db.$transaction(async (tx: any) => {
			const { batchId, initialErrors } = await getOrCreateBatch(
				tx,
				{
					contactsCount: input.contacts.length,
					defaultTags: input.defaultTags,
					filename: input.filename,
					importBatchId: input.importBatchId,
					isLastChunk: input.isLastChunk,
					strategy: input.strategy,
					totalRows: input.totalRows,
				},
				ownerId,
				userId
			);

			let createdCount = 0;
			let updatedCount = 0;
			let skippedCount = 0;
			const chunkErrors: Array<{
				phone: string;
				reason: string;
				rowNumber: number;
			}> = [];

			const cleanDefaultTags = input.defaultTags
				.map((t) => t.trim())
				.filter(Boolean);

			let index = 0;
			for (const row of input.contacts) {
				index += 1;
				const effectiveRowNumber = row.rowNumber ?? index;
				const norm = normalizePhoneNumber(row.phone, "NG");
				if (!(norm.success && norm.phone)) {
					chunkErrors.push({
						phone: row.phone,
						reason: norm.error ?? "Invalid phone number format",
						rowNumber: effectiveRowNumber,
					});
					continue;
				}

				// biome-ignore lint/performance/noAwaitInLoops: sequential row ingestion inside transaction ensures isolation
				const outcome = await persistContactRow(tx, {
					batchId,
					channel: row.channel || input.defaultChannel,
					defaultTags: cleanDefaultTags,
					email: row.email?.trim().toLowerCase() || null,
					metadata: row.metadata,
					name: row.name.trim(),
					notes: row.notes?.trim() || null,
					ownerId,
					phone: norm.phone,
					rawRow: row.rawRow?.trim() || null,
					rowTags: (row.tags || []).map((t) => t.trim()).filter(Boolean),
					strategy: input.strategy,
					type: row.type || input.defaultType,
				});

				if (outcome === "created") {
					createdCount += 1;
				} else if (outcome === "updated") {
					updatedCount += 1;
				} else {
					skippedCount += 1;
				}
			}

			const combinedErrors = [...initialErrors, ...chunkErrors];

			await tx.contactImport.update({
				data: {
					createdCount: { increment: createdCount },
					errorCount: { increment: chunkErrors.length },
					// biome-ignore lint/suspicious/noExplicitAny: JSON serialization input
					errors:
						combinedErrors.length > 0 ? (combinedErrors as any) : undefined,
					skippedCount: { increment: skippedCount },
					status: input.isLastChunk ? "completed" : "in_progress",
					updatedCount: { increment: updatedCount },
				},
				where: { id: batchId },
			});

			return {
				created: createdCount,
				errors: chunkErrors,
				importBatchId: batchId,
				skipped: skippedCount,
				success: true,
				updated: updatedCount,
			};
		});

		invalidateMany(ownerId, ["contacts.list", "contacts.get"]);
		return result;
	});

// ─── listImports ──────────────────────────────────────────────────────────────

export const listImports = protectedProcedure
	.input(
		z.object({
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(50).default(10),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const [total, imports] = await Promise.all([
			context.db.contactImport.count({ where: { ownerId } }),
			context.db.contactImport.findMany({
				orderBy: { createdAt: "desc" },
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
				where: { ownerId },
			}),
		]);

		return {
			// biome-ignore lint/suspicious/noExplicitAny: database import record mapping
			imports: imports.map((imp: any) => ({
				createdAt: imp.createdAt.toISOString(),
				createdCount: imp.createdCount,
				errorCount: imp.errorCount,
				errors: imp.errors,
				filename: imp.filename,
				id: imp.id,
				skippedCount: imp.skippedCount,
				status: imp.status,
				strategy: imp.strategy,
				tagsApplied: imp.tagsApplied,
				totalRows: imp.totalRows,
				updatedCount: imp.updatedCount,
			})),
			pagination: {
				page: input.page,
				pageSize: input.pageSize,
				total,
				totalPages: Math.ceil(total / input.pageSize),
			},
		};
	});

// ─── getImportDetails ─────────────────────────────────────────────────────────

export const getImportDetails = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const imp = await context.db.contactImport.findFirst({
			where: { id: input.id, ownerId },
		});
		if (!imp) {
			throw new Error(`Import record ${input.id} not found`);
		}

		return {
			createdAt: imp.createdAt.toISOString(),
			createdCount: imp.createdCount,
			errorCount: imp.errorCount,
			errors: imp.errors,
			filename: imp.filename,
			id: imp.id,
			skippedCount: imp.skippedCount,
			status: imp.status,
			strategy: imp.strategy,
			tagsApplied: imp.tagsApplied,
			totalRows: imp.totalRows,
			updatedCount: imp.updatedCount,
		};
	});

// ─── listTags ─────────────────────────────────────────────────────────────────

async function fallbackListTags(
	// biome-ignore lint/suspicious/noExplicitAny: prisma database client
	db: any,
	ownerId: string,
	search?: string
): Promise<Array<{ count: number; tag: string }>> {
	const contacts = await db.contact.findMany({
		select: { tags: true },
		where: { uploadedBy: ownerId },
	});

	const tagCounts = new Map<string, number>();
	for (const c of contacts) {
		for (const tag of c.tags ?? []) {
			const trimmed = tag.trim();
			if (trimmed) {
				tagCounts.set(trimmed, (tagCounts.get(trimmed) ?? 0) + 1);
			}
		}
	}

	let list = Array.from(tagCounts.entries()).map(([tag, count]) => ({
		count,
		tag,
	}));

	if (search) {
		const query = search.toLowerCase();
		list = list.filter((item) => item.tag.toLowerCase().includes(query));
	}

	list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
	return list;
}

export const listTags = protectedProcedure
	.input(z.object({ search: z.string().optional() }).optional())
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		if (typeof context.db.$queryRaw === "function") {
			try {
				let rawRows: Array<{ count: number | bigint; tag: string }>;
				if (input?.search?.trim()) {
					const searchPattern = `%${input.search.trim().toLowerCase()}%`;
					rawRows = await context.db.$queryRaw`
						SELECT tag, COUNT(*)::int AS count
						FROM contacts, UNNEST(tags) AS tag
						WHERE uploaded_by = ${ownerId}
						  AND LOWER(tag) LIKE ${searchPattern}
						GROUP BY tag
						ORDER BY count DESC, tag ASC
					`;
				} else {
					rawRows = await context.db.$queryRaw`
						SELECT tag, COUNT(*)::int AS count
						FROM contacts, UNNEST(tags) AS tag
						WHERE uploaded_by = ${ownerId}
						GROUP BY tag
						ORDER BY count DESC, tag ASC
					`;
				}
				return {
					tags: rawRows.map((r) => ({
						count: Number(r.count),
						tag: String(r.tag),
					})),
				};
			} catch {
				const fallback = await fallbackListTags(
					context.db,
					ownerId,
					input?.search
				);
				return { tags: fallback };
			}
		}

		const list = await fallbackListTags(context.db, ownerId, input?.search);
		return { tags: list };
	});

// ─── batchTagContacts ─────────────────────────────────────────────────────────

export const batchTagContacts = protectedProcedure
	.input(
		z.object({
			addTags: z.array(z.string()).default([]),
			contactIds: z.array(z.string().uuid()).min(1).max(500),
			removeTags: z.array(z.string()).default([]),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const contacts = await context.db.contact.findMany({
			select: { id: true, tags: true },
			where: { id: { in: input.contactIds }, uploadedBy: ownerId },
		});

		const toAdd = input.addTags.map((t) => t.trim()).filter(Boolean);
		const toRemove = new Set(
			input.removeTags.map((t) => t.trim().toLowerCase())
		);

		await context.db.$transaction(
			// biome-ignore lint/suspicious/noExplicitAny: database contact record
			contacts.map((c: any) => {
				const tagSet = new Set(c.tags as string[]);
				for (const tag of toAdd) {
					tagSet.add(tag);
				}
				for (const rem of toRemove) {
					for (const existing of Array.from(tagSet)) {
						if (existing.toLowerCase() === rem) {
							tagSet.delete(existing);
						}
					}
				}
				return context.db.contact.update({
					data: { tags: Array.from(tagSet) },
					where: { id: c.id },
				});
			})
		);

		invalidate(ownerId, "contacts.list");
		return { success: true, updatedCount: contacts.length };
	});

// ─── exportContacts ───────────────────────────────────────────────────────────

export const exportContacts = protectedProcedure
	.input(
		z.object({
			activeOnly: z.boolean().default(false),
			campaignId: z.string().optional(),
			channel: ChannelSchema.optional(),
			format: z.enum(["csv", "xlsx"]).default("csv"),
			lastContactedFrom: z.string().optional(),
			lastContactedTo: z.string().optional(),
			search: z.string().optional(),
			tag: z.string().optional(),
			type: ContactTypeSchema.optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const ownerId = await resolveOrgOwnerId(context.db, userId);

		const where: Record<string, any> = {
			uploadedBy: ownerId,
			...(input.channel && { channel: input.channel }),
			...(input.type && { type: input.type }),
			...(input.tag && { tags: { has: input.tag } }),
			...(input.activeOnly && { optedOut: false }),
			...(input.search && {
				OR: [
					{ name: { contains: input.search, mode: "insensitive" } },
					{ phone: { contains: input.search, mode: "insensitive" } },
					{ email: { contains: input.search, mode: "insensitive" } },
				],
			}),
		};

		if (input.campaignId) {
			const messagePhones = await context.db.message.findMany({
				distinct: ["phone"],
				select: { phone: true },
				where: { campaignId: input.campaignId },
			});
			where.phone = { in: messagePhones.map((m: any) => m.phone) };
		}

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
				tags: true,
				type: true,
			},
			where,
		});

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
			Tags: c.tags.join(", "),
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

		const XLSX = await import("xlsx");
		const ws = XLSX.utils.json_to_sheet(rows);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Contacts");
		const buf = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
		return { content: buf, count: rows.length, format: "xlsx" as const };
	});
