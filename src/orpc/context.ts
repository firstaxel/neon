import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { prisma } from "#/db";
import { auth } from "#/lib/auth";

const getUserAgent = (headers: Headers) => {
	const userAgent = headers.get("user-agent");

	if (userAgent) {
		return userAgent;
	}

	return "Unknown";
};

export async function createContext() {
	const h = await getRequestHeaders();
	const session = await auth.api.getSession({
		headers: await getRequestHeaders(),
	});

	return {
		session,
		db: prisma,
		headers: h,
		ip: getRequestIP(),
		requestID: crypto.randomUUID(),
		userAgent: getUserAgent(h),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
