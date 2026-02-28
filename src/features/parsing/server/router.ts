import { createSuccessResponse } from "#/lib/orpc-utils";
import { o, protectedProcedure } from "#/orpc";

const STATUS_PROGRESS_MAP: Record<string, number> = {
	pending: 10,
	parsing: 55,
	done: 100,
	error: 0,
};

export const parsingRouter = o.router({
	all: protectedProcedure.handler(async ({ context, errors }) => {
		const jobs = await context.db.parseJob.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				contacts: { orderBy: { createdAt: "asc" } },
			},
		});
		const response = jobs.map((job) => ({
			jobId: job.id,
			status: job.status as "pending" | "parsing" | "done" | "error",
			progress: STATUS_PROGRESS_MAP[job.status] ?? 0,
			originalFilename: job.originalFilename,
			fileSizeBytes: job.fileSizeBytes,
			confidence: job.confidence,
			warnings: job.warnings as string[],
			contacts: job.status === "done" ? job.contacts : [],
			totalExtracted: job.status === "done" ? job.contacts.length : 0,
			error: job.status === "error" ? job.errorMessage : undefined,
			createdAt: job.createdAt.toISOString(),
		}));
		if (!response) {
			throw errors.NOT_FOUND({
				message: "No parsed found",
			});
		}

		return createSuccessResponse(response);
	}),
});
