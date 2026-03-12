import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

interface PasswordResetEmailProps {
	name?: string;
	url: string;
}

/**
 * Sent when a user requests a password reset.
 * Triggered by: auth.ts → emailAndPassword → sendResetPassword
 *
 * Preview at: npx email preview
 */
export function PasswordResetEmail({ url, name }: PasswordResetEmailProps) {
	const greeting = name ? `Hi ${name},` : "Hi there,";

	return (
		<EmailLayout preview="Reset your Velocast password — link expires in 1 hour">
			<Heading className="mt-0 mb-2 text-center font-semibold text-2xl text-[#09090b]">
				Reset your password
			</Heading>

			<Text className="mt-0 mb-6 text-center text-[#52525b] text-sm">
				{greeting} we received a request to reset the password for your Velocast
				account. Click the button below to choose a new password. This link
				expires in <strong>1 hour</strong>.
			</Text>

			<Section className="text-center">
				<Button
					className="inline-block rounded-xl bg-[#09090b] px-6 py-3 font-semibold text-sm text-white no-underline"
					href={url}
				>
					Reset my password
				</Button>
			</Section>

			<Section className="mt-6 rounded-xl bg-[#fafafa] px-5 py-4">
				<Text className="m-0 text-[#71717a] text-xs">
					<strong>Didn't request this?</strong> Your password has not been
					changed. You can safely ignore this email. If you're worried someone
					else requested this, consider signing in and changing your password.
				</Text>
			</Section>

			<Text className="mt-4 mb-0 text-center text-[#a1a1aa] text-xs">
				Or copy and paste this URL into your browser:
			</Text>
			<Text className="mt-1 mb-0 break-all text-center text-[#71717a] text-xs">
				{url}
			</Text>
		</EmailLayout>
	);
}

PasswordResetEmail.PreviewProps = {
	url: "https://Velocast.example.com/api/auth/reset-password?token=abc123",
	name: "Ngozi",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
