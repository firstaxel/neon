import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink, openAPI } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { prisma } from "#/db";
import { env } from "#/env";
import { sendMail } from "#/features/email/lib/sender";
import { MagicLinkEmail } from "@/emails/magic-link";
import { PasswordResetEmail } from "@/emails/password-reset";
import { VerificationEmail } from "@/emails/verify";

export const auth = betterAuth({
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
		},
	},

	advanced: {
		cookiePrefix: "Velocast",
		crossSubDomainCookies: { enabled: false },
	},

	appName: "Velocast",
	baseURL: process.env.BETTER_AUTH_URL,
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
		maxPasswordLength: 128,
		minPasswordLength: 8,
		requireEmailVerification: true,
		async sendResetPassword({ user, url }) {
			await sendMail({
				subject: "Reset your Velocast password",
				template: PasswordResetEmail({ name: user.name, url }),
				to: user.email,
			});
		},
	},

	emailVerification: {
		autoSignInAfterVerification: true,
		sendOnSignUp: true,
		async sendVerificationEmail({ user, url }) {
			await sendMail({
				subject: "Verify your Velocast email",
				template: VerificationEmail({ name: user.name, url }),
				to: user.email,
			});
		},
	},

	plugins: [
		magicLink({
			disableSignUp: true,
			expiresIn: 60 * 15,

			async sendMagicLink({ email, url }) {
				await sendMail({
					subject: "Your Velocast sign-in link",
					template: MagicLinkEmail({ url }),
					to: email,
				});
			},
		}),
		...(process.env.NODE_ENV === "development" ? [openAPI()] : []),
		tanstackStartCookies(),
	],

	rateLimit: {
		enabled: true,
		max: 20,
		storage: "memory",
		window: 60,
	},

	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5,
		},
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
	},

	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
