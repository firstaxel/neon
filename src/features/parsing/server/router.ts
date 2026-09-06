import { createSuccessResponse } from "#/lib/orpc-utils";
import { o, protectedProcedure } from "#/orpc";

const STATUS_PROGRESS_MAP: Record<string, number> = {
	done: 100,
	error: 0,
	parsing: 55,
	pending: 10,
};

export const parsingRouter = o.router({
	all: protectedProcedure.handler(async ({ context, errors }) => {
		const jobs = await context.db.parseJob.findMany({
			include: {
				contacts: { orderBy: { createdAt: "asc" } },
			},
			orderBy: { createdAt: "desc" },
			where: {
				parsedBy: context.session.user.id,
			},
		});
		const response = jobs.map((job) => ({
			confidence: job.confidence,
			contacts: job.status === "done" ? job.contacts : [],
			createdAt: job.createdAt.toISOString(),
			error: job.status === "error" ? job.errorMessage : undefined,
			fileSizeBytes: job.fileSizeBytes,
			jobId: job.id,
			originalFilename: job.originalFilename,
			progress: STATUS_PROGRESS_MAP[job.status] ?? 0,
			status: job.status as "pending" | "parsing" | "done" | "error",
			totalExtracted: job.status === "done" ? job.contacts.length : 0,
			warnings: job.warnings as string[],
		}));
		if (!response) {
			throw errors.NOT_FOUND({
				message: "No parsed found",
			});
		}

		return createSuccessResponse(response);
	}),
});
