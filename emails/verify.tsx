import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

interface VerificationEmailProps {
	name?: string;
	url: string;
}

/**
 * Sent after a user registers with email + password.
 * Triggered by: auth.ts → emailVerification → sendVerificationEmail
 *
 * Preview at: npx email preview
 */
export function VerificationEmail({ url, name }: VerificationEmailProps) {
	const greeting = name ? `Welcome, ${name}!` : "Welcome to Neon!";

	return (
		<EmailLayout preview="Verify your Neon email address to get started">
			<Heading className="mt-0 mb-2 text-center font-semibold text-2xl text-[#09090b]">
				Verify your email
			</Heading>

			<Text className="mt-0 mb-6 text-center text-[#52525b] text-sm">
				{greeting} Please verify your email address to activate your account.
				This link expires in <strong>24 hours</strong>.
			</Text>

			<Section className="text-center">
				<Button
					className="inline-block rounded-xl bg-[#09090b] px-6 py-3 font-semibold text-sm text-white no-underline"
					href={url}
				>
					Verify email address
				</Button>
			</Section>

			<Text className="mt-6 mb-0 text-center text-[#a1a1aa] text-xs">
				If you didn't create a Neon account, you can safely ignore this email.
			</Text>

			<Text className="mt-3 mb-0 text-center text-[#a1a1aa] text-xs">
				Or copy and paste this URL into your browser:
			</Text>
			<Text className="mt-1 mb-0 break-all text-center text-[#71717a] text-xs">
				{url}
			</Text>
		</EmailLayout>
	);
}

VerificationEmail.PreviewProps = {
	url: "https://Neon.example.com/api/auth/verify-email?token=abc123",
	name: "Emeka",
} satisfies VerificationEmailProps;

export default VerificationEmail;
