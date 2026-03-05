import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		SERVER_URL: z.string().url().optional(),
		CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
		CLOUDFLARE_ACCESS_KEY_ID: z.string().min(1),
		CLOUDFLARE_SECRET_ACCESS_KEY: z.string().min(1),
		GEMINI_API_KEY: z.string().min(1),
		DATABASE_URL: z.string(),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		TERMII_API_KEY: z.string(),
		TERMII_SECRET_KEY: z.string(),
		PAYSTACK_SECRET_KEY: z.string(),
		PAYSTACK_PUBLIC_KEY: z.string(),
		SMTP_HOST: z.string(),
		SMTP_USER: z.string(),
		SMTP_PASS: z.string(),
		EMAIL_FROM: z.string(),
		SMTP_PORT: z.string(),
		SMTP_SECURE: z.string(),
		PROD_DATABASE_URL: z.string(),
	},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
		VITE_CLIENT_URL: z.url().min(1).optional(),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: process.env,

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});
