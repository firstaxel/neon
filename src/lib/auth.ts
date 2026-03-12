import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink, openAPI } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { MagicLinkEmail } from "emails/magic-link";
import { PasswordResetEmail } from "emails/password-reset";
import { VerificationEmail } from "emails/verify";
import { prisma } from "#/db";
import { env } from "#/env";
import { sendMail } from "#/features/email/lib/sender";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),

	appName: "Velocast",
	baseURL: process.env.BETTER_AUTH_URL,

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		requireEmailVerification: true,
		async sendResetPassword({ user, url }) {
			await sendMail({
				to: user.email,
				subject: "Reset your Velocast password",
				template: PasswordResetEmail({ url, name: user.name }),
			});
		},
	},

	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		async sendVerificationEmail({ user, url }) {
			await sendMail({
				to: user.email,
				subject: "Verify your Velocast email",
				template: VerificationEmail({ url, name: user.name }),
			});
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5,
		},
	},

	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},

	plugins: [
		magicLink({
			expiresIn: 60 * 15,

			async sendMagicLink({ email, url }) {
				await sendMail({
					to: email,
					subject: "Your Velocast sign-in link",
					template: MagicLinkEmail({ url }),
				});
			},
			disableSignUp: true,
		}),
		...(process.env.NODE_ENV === "development" ? [openAPI()] : []),
		tanstackStartCookies(),
	],

	advanced: {
		cookiePrefix: "Velocast",
		crossSubDomainCookies: { enabled: false },
	},

	rateLimit: {
		enabled: true,
		window: 60,
		max: 20,
		storage: "memory",
	},

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
		},
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
