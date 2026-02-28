import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";

/**
 * Nodemailer singleton transport.
 *
 * Reads SMTP config from environment variables.
 * Compatible with any SMTP provider: Gmail, Outlook, Mailgun, Postmark,
 * Amazon SES, Zoho, or a self-hosted server.
 *
 * Required env vars:
 *   SMTP_HOST        e.g. smtp.gmail.com
 *   SMTP_PORT        e.g. 587 (STARTTLS) or 465 (SSL)
 *   SMTP_USER        your SMTP username / email address
 *   SMTP_PASS        your SMTP password or app-specific password
 *   EMAIL_FROM       e.g. Neon <no-reply@yourdomain.com>
 *
 * Optional:
 *   SMTP_SECURE      "true" for port 465 SSL, omit for STARTTLS (port 587)
 */

declare global {
	// eslint-disable-next-line no-var
	var __nodemailerTransport: nodemailer.Transporter | undefined;
}

function createTransport(): nodemailer.Transporter {
	const host = process.env.SMTP_HOST;
	const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!(host && user && pass)) {
		throw new Error(
			"Missing SMTP config. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment."
		);
	}

	const transport = nodemailer.createTransport({
		host,
		port,
		secure: process.env.SMTP_SECURE === "true", // true = SSL/TLS, false = STARTTLS
		auth: { user, pass },
		// Sane production timeouts
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 30_000,
		// Pool connections for high-volume sending
		pool: true,
		maxConnections: 5,
		maxMessages: 100,
	});

	return transport;
}

// Singleton — reuse the same transport across requests in dev (HMR-safe)
export const transport = globalThis.__nodemailerTransport ?? createTransport();

if (process.env.NODE_ENV !== "production") {
	globalThis.__nodemailerTransport = transport;
}

// ─── sendMail ─────────────────────────────────────────────────────────────────

interface SendMailOptions {
	subject: string;
	/** Pass a React Email component — it will be rendered to HTML + plain text */
	template: ReactElement;
	to: string;
}

/**
 * Render a React Email component and send it via Nodemailer.
 *
 * Usage:
 *   await sendMail({
 *     to: "user@example.com",
 *     subject: "Your sign-in link",
 *     template: <MagicLinkEmail url={url} />,
 *   });
 */
export async function sendMail({ to, subject, template }: SendMailOptions) {
	const html = await render(template);
	const text = await render(template, { plainText: true });

	if (process.env.NODE_ENV === "development") {
		// Ethereal catch-all in dev — emails are captured, never delivered.
		// View sent messages at https://ethereal.email
		const testAccount = await nodemailer.createTestAccount();
		const devTransport = nodemailer.createTransport({
			host: "smtp.ethereal.email",
			port: 587,
			auth: {
				user: testAccount.user,
				pass: testAccount.pass,
			},
		});

		const info = await devTransport.sendMail({
			from: process.env.EMAIL_FROM ?? '"Neon Dev" <dev@Neon.local>',
			to,
			subject,
			html,
			text,
		});

		console.log(
			`\n📧 [DEV EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(info)}`
		);
		return info;
	}

	return transport.sendMail({
		from: process.env.EMAIL_FROM,
		to,
		subject,
		html,
		text,
	});
}
