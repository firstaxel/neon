// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, requireSession } from "./auth";

const mockGetRequest = vi.fn();
const mockGetRequestHeaders = vi.fn();
const mockGetSessionCookie = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => mockGetRequest(),
	getRequestHeaders: () => mockGetRequestHeaders(),
}));

vi.mock("better-auth/cookies", () => ({
	getSessionCookie: (req: unknown, opts: unknown) =>
		mockGetSessionCookie(req, opts),
}));

vi.mock("#/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { auth } from "#/lib/auth";

describe("authMiddleware", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const runMiddleware = async (url: string, cookie: string | null = null) => {
		mockGetRequest.mockReturnValue(new Request(url));
		mockGetSessionCookie.mockReturnValue(cookie);

		const next = vi.fn(async ({ context }: { context: unknown }) => ({
			context,
			passed: true,
		}));

		const serverFn = (authMiddleware as any).options.server;
		return await serverFn({ next });
	};

	// covers: AC-6
	it("allows bypass paths through with unauthenticated context", async () => {
		const result = await runMiddleware(
			"http://localhost:3000/api/auth/sign-in"
		);

		expect(result.passed).toBe(true);
		expect(result.context.isAuthenticated).toBe(false);
		expect(result.context.sessionCookie).toBeNull();
	});

	// covers: AC-6
	it("redirects unauthenticated users on protected routes to /login with callbackURL", async () => {
		try {
			await runMiddleware("http://localhost:3000/dashboard");
			expect.unreachable("Should have thrown redirect Response");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(Response);
			const res = err as Response;
			expect(res.status).toBe(302);
			const location = res.headers.get("Location");
			expect(location).toBe(
				"http://localhost:3000/login?callbackURL=%2Fdashboard"
			);
			expect(res.headers.get("X-Frame-Options")).toBe("DENY");
			expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		}
	});

	// covers: AC-7
	it("redirects authenticated users on public auth routes to /dashboard", async () => {
		try {
			await runMiddleware(
				"http://localhost:3000/login",
				"valid_session_cookie"
			);
			expect.unreachable("Should have thrown redirect Response");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(Response);
			const res = err as Response;
			expect(res.status).toBe(302);
			expect(res.headers.get("Location")).toBe(
				"http://localhost:3000/dashboard"
			);
		}
	});

	// covers: AC-7
	it("redirects authenticated users on public auth routes to safe callbackURL", async () => {
		try {
			await runMiddleware(
				"http://localhost:3000/login?callbackURL=%2Fcontacts",
				"valid_session_cookie"
			);
			expect.unreachable("Should have thrown redirect Response");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(Response);
			const res = err as Response;
			expect(res.status).toBe(302);
			expect(res.headers.get("Location")).toBe(
				"http://localhost:3000/contacts"
			);
		}
	});

	// covers: AC-7
	it("rejects unsafe external callbackURL to prevent open redirect vulnerabilities", async () => {
		try {
			await runMiddleware(
				"http://localhost:3000/login?callbackURL=https%3A%2F%2Fattacker.com",
				"valid_session_cookie"
			);
			expect.unreachable("Should have thrown redirect Response");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(Response);
			const res = err as Response;
			expect(res.status).toBe(302);
			expect(res.headers.get("Location")).toBe(
				"http://localhost:3000/dashboard"
			);
		}
	});

	// covers: AC-6
	it("allows authenticated requests on protected routes to proceed with context", async () => {
		const result = await runMiddleware(
			"http://localhost:3000/dashboard",
			"valid_session_token"
		);

		expect(result.passed).toBe(true);
		expect(result.context.isAuthenticated).toBe(true);
		expect(result.context.sessionCookie).toBe("valid_session_token");
	});
});

describe("requireSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns session data when session is valid", async () => {
		mockGetRequestHeaders.mockReturnValue(new Headers());
		const mockSession = {
			user: { email: "user@velocast.ng", id: "usr_1" },
		};
		vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);

		const session = await requireSession();
		expect(session).toEqual(mockSession);
	});

	it("throws 302 redirect to /login when session is missing or invalid", async () => {
		mockGetRequestHeaders.mockReturnValue(new Headers());
		vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

		try {
			await requireSession();
			expect.unreachable("Should have thrown redirect Response");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(Response);
			const res = err as Response;
			expect(res.status).toBe(302);
			expect(res.headers.get("Location")).toBe("/login");
		}
	});
});
