import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

interface MagicLinkEmailProps {
	/** Recipient's name — used to personalise the greeting if available */
	name?: string;
	url: string;
}

/**
 * Sent when a user requests a magic sign-in link.
 * Triggered by: auth.ts → magicLink plugin → sendMagicLink
 *
 * Preview at: npx email preview
 */
export function MagicLinkEmail({ url, name }: MagicLinkEmailProps) {
	const greeting = name ? `Hi ${name},` : "Hi there,";

	return (
		<EmailLayout preview="Your Neon sign-in link — expires in 15 minutes">
			<Heading className="mt-0 mb-2 text-center font-semibold text-2xl text-[#09090b]">
				Sign in to Neon
			</Heading>

			<Text className="mt-0 mb-6 text-center text-[#52525b] text-sm">
				{greeting} click the button below to sign in. This link expires in{" "}
				<strong>15 minutes</strong> and can only be used once.
			</Text>

			<Section className="text-center">
				<Button
					className="inline-block rounded-xl bg-[#09090b] px-6 py-3 font-semibold text-sm text-white no-underline"
					href={url}
				>
					Sign in to Neon
				</Button>
			</Section>

			<Text className="mt-6 mb-0 text-center text-[#a1a1aa] text-xs">
				If you didn't request this email, you can safely ignore it. Someone may
				have entered your email by mistake.
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

// Default props for React Email's preview server
MagicLinkEmail.PreviewProps = {
	url: "https://Neon.example.com/api/auth/magic-link/verify?token=abc123",
	name: "Adaeze",
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;
