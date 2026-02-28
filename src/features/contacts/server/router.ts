import z from "zod";
import { createSuccessResponse } from "#/lib/orpc-utils";
import { o, protectedProcedure } from "#/orpc";

const ChannelSchema = z.enum(["whatsapp", "sms"]);
const ContactTypeSchema = z.enum([
	"first_timer",
	"returning",
	"member",
	"visitor",
]);

export const contactRouter = o.router({
	all: protectedProcedure.handler(async ({ context, errors }) => {
		const contacts = await context.db.contact.findMany({
			where: {
				uploadedBy: context.session.user.id,
			},
		});

		if (!contacts) {
			throw errors.NOT_FOUND({
				message: "No contacts found",
			});
		}

		return createSuccessResponse(contacts);
	}),
	listContacts: protectedProcedure
		.input(
			z.object({
				search: z.string().optional(),
				channel: ChannelSchema.optional(),
				type: ContactTypeSchema.optional(),
				parseJobId: z.string().uuid().optional(),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(20),
			})
		)
		.handler(async ({ input, context }) => {
			const where = {
				...(input.parseJobId && { parseJobId: input.parseJobId }),
				...(input.channel && { channel: input.channel }),
				...(input.type && { type: input.type }),
				...(input.search && {
					OR: [
						{
							name: { contains: input.search, mode: "insensitive" as const },
						},
						{
							phone: { contains: input.search, mode: "insensitive" as const },
						},
						{
							email: { contains: input.search, mode: "insensitive" as const },
						},
					],
				}),
			};

			const [total, contacts] = await Promise.all([
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
			]);

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
					createdAt: c.createdAt.toISOString(),
					parseJobId: c.parseJobId,
					sourceFilename: c.parseJob.originalFilename,
					sourceCreatedAt: c.parseJob.createdAt.toISOString(),
				})),
				pagination: {
					total,
					page: input.page,
					pageSize: input.pageSize,
					totalPages: Math.ceil(total / input.pageSize),
				},
			};
		}),

	get: protectedProcedure
		.input(z.object({ id: z.uuid() }))
		.handler(async ({ input, context }) => {
			const c = await context.db.contact.findUnique({
				where: { id: input.id },
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
				createdAt: c.createdAt.toISOString(),
				parseJobId: c.parseJobId,
				sourceFilename: c.parseJob.originalFilename,
				sourceCreatedAt: c.parseJob.createdAt.toISOString(),
				sourceConfidence: c.parseJob.confidence,
			};
		}),
});
