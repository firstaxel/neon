import { ORPCError, os } from "@orpc/server";
import type {
	RequestHeadersHandlerPluginContext,
	ResponseHeadersHandlerPluginContext,
} from "@orpc/server/plugins";
import type { Context } from "./context";

interface OrpcContext
	extends ResponseHeadersHandlerPluginContext,
		RequestHeadersHandlerPluginContext,
		Context {}

export const o = os.$context<OrpcContext>().errors({
	BAD_REQUEST: {
		message: "The request was invalid.",
	},
	CONFLICT: {
		message: "The request conflicts with the current state of the resource.",
	},
	FORBIDDEN: {
		message: "You do not have permission to perform this action.",
	},
	INTERNAL_SERVER_ERROR: {
		message: "An internal server error occurred.",
	},
	NOT_FOUND: {
		message: "The requested resource was not found.",
	},
	TIMEOUT: {
		message: "The request timed out. Please try again.",
	},
	TOO_MANY_REQUESTS: {
		message: "Too many requests. Please try again later.",
	},
	UNAUTHORIZED: {
		message: "You must be logged in to perform this action.",
	},
	UNPROCESSABLE_ENTITY: {
		message:
			"The request was well-formed but was unable to be followed due to semantic errors.",
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
