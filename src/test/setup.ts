import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
	cleanup();
});

// Provide fallback environment variables for server-side testing
const defaultTestEnv: Record<string, string> = {
	CLOUDFLARE_ACCESS_KEY_ID: "mock_cf_access_key",
	CLOUDFLARE_ACCOUNT_ID: "mock_cf_account",
	CLOUDFLARE_SECRET_ACCESS_KEY: "mock_cf_secret",
	DATABASE_URL: "postgresql://postgres:codeheart@localhost:5432/velocast?schema=public",
	EMAIL_FROM: "dev@velocast.local",
	GEMINI_API_KEY: "mock_gemini_key",
	GOOGLE_CLIENT_ID: "mock_google_id",
	GOOGLE_CLIENT_SECRET: "mock_google_secret",
	PAYSTACK_PUBLIC_KEY: "pk_test_mock",
	PAYSTACK_SECRET_KEY: "sk_test_mock",
	PROD_DATABASE_URL: "postgresql://postgres:codeheart@localhost:5432/velocast_prod?schema=public",
	SMTP_HOST: "smtp.example.com",
	SMTP_PASS: "mock_pass",
	SMTP_PORT: "587",
	SMTP_SECURE: "false",
	SMTP_USER: "mock_user",
	TERMII_API_KEY: "mock_termii_api",
	TERMII_SECRET_KEY: "mock_termii_secret",
};

for (const [key, value] of Object.entries(defaultTestEnv)) {
	if (!process.env[key]) {
		process.env[key] = value;
	}
}

if (typeof window !== "undefined") {
	Object.defineProperty(window, "matchMedia", {
		value: (query: string) => ({
			addEventListener: () => {},
			addListener: () => {},
			dispatchEvent: () => false,
			matches: false,
			media: query,
			onchange: null,
			removeEventListener: () => {},
			removeListener: () => {},
		}),
		writable: true,
	});
}
