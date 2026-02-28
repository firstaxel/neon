import { ORPCError, os } from "@orpc/server";
import type {
	RequestHeadersPluginContext,
	ResponseHeadersPluginContext,
} from "@orpc/server/plugins";
import type { Context } from "./context";

interface OrpcContext
	extends ResponseHeadersPluginContext,
		RequestHeadersPluginContext,
		Context {}

export const o = os.$context<OrpcContext>().errors({
	UNAUTHORIZED: {
		message: "You must be logged in to perform this action.",
		status: 401,
	},
	FORBIDDEN: {
		message: "You do not have permission to perform this action.",
		status: 403,
	},
	NOT_FOUND: {
		message: "The requested resource was not found.",
		status: 404,
	},
	INTERNAL_SERVER_ERROR: {
		message: "An internal server error occurred.",
		status: 500,
	},
	BAD_REQUEST: {
		message: "The request was invalid.",
		status: 400,
	},
	CONFLICT: {
		message: "The request conflicts with the current state of the resource.",
		status: 409,
	},
	UNPROCESSABLE_ENTITY: {
		message:
			"The request was well-formed but was unable to be followed due to semantic errors.",
		status: 422,
	},
	TOO_MANY_REQUESTS: {
		message: "Too many requests. Please try again later.",
		status: 429,
	},
	TIMEOUT: {
		message: "The request timed out. Please try again.",
		status: 408,
	},
});

export const publicProcedure = o;

const requireAuth = o.middleware(({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({
		context: {
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);
