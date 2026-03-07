import { Button, Heading, Section, Text } from "@react-email/components";
import { env } from "#/env";
import { EmailLayout } from "./layout";

interface LowBalanceEmailProps {
	campaignId: string;
	name: string;
	remainingBalanceKobo: number;
}

function formatNaira(kobo: number) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		minimumFractionDigits: 2,
	}).format(kobo / 100);
}

export function LowBalanceEmail({
	name,
	campaignId,
	remainingBalanceKobo,
}: LowBalanceEmailProps) {
	const appUrl = env.VITE_CLIENT_URL ?? "https:// neon.app";
	return (
		<EmailLayout preview="Your  neon campaign was paused — wallet balance too low">
			<Heading className="mt-0 mb-2 text-center font-semibold text-2xl text-[#09090b]">
				Campaign Paused
			</Heading>
			<Text className="mt-0 mb-4 text-center text-[#52525b] text-sm">
				Hi {name}, your campaign was paused because your wallet balance ran out
				mid-send.
			</Text>
			<Section
				style={{
					background: "#f9fafb",
					borderRadius: 12,
					padding: "16px 20px",
					marginBottom: 20,
					border: "1px solid #e5e7eb",
				}}
			>
				<Text className="m-0 text-[#374151] text-sm">
					<strong>Remaining balance:</strong>{" "}
					<span
						style={{
							color: remainingBalanceKobo < 100 ? "#ef4444" : "#6b7280",
						}}
					>
						{formatNaira(remainingBalanceKobo)}
					</span>
				</Text>
				<Text className="mt-2 mb-0 text-[#9ca3af] text-xs">
					Campaign ID: {campaignId}
				</Text>
			</Section>
			<Text className="mt-0 mb-6 text-center text-[#52525b] text-sm">
				Top up your wallet and re-send the campaign to reach the remaining
				contacts.
			</Text>
			<Section className="text-center">
				<Button
					className="inline-block rounded-xl bg-[#09090b] px-6 py-3 font-semibold text-sm text-white no-underline"
					href={`${appUrl}/billing`}
				>
					Top up wallet
				</Button>
			</Section>
			<Text className="mt-6 mb-0 text-center text-[#a1a1aa] text-xs">
				Messages already sent before the pause were still delivered.
			</Text>
		</EmailLayout>
	);
}

LowBalanceEmail.PreviewProps = {
	name: "Chukwuemeka",
	campaignId: "abc-123-def",
	remainingBalanceKobo: 45,
} satisfies LowBalanceEmailProps;

export default LowBalanceEmail;
