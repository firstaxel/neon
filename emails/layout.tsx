import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Img,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { env } from "#/env";

interface EmailLayoutProps {
	children: ReactNode;
	preview: string;
}

/**
 * Shared wrapper for all Velocast transactional emails.
 *
 * Provides consistent branding: logo, card container, footer.
 * Uses @react-email/components Tailwind support — classes are
 * inlined by the renderer so they work in all mail clients.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
	return (
		<Html dir="ltr" lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Tailwind>
				<Body className="bg-[#f4f4f5] font-sans">
					<Container className="mx-auto my-10 max-w-130">
						{/* ── Logo / header ── */}
						<Section className="mb-6 text-center">
							{/* Replace src with your hosted logo URL */}
							<Img
								alt="Velocast"
								className="mx-auto"
								height={44}
								src={`${env.VITE_CLIENT_URL}/logo.png`}
								width={36}
							/>
						</Section>

						{/* ── Card ── */}
						<Section className="rounded-2xl bg-white px-10 py-10 shadow-sm">
							{children}
						</Section>

						{/* ── Footer ── */}
						<Section className="mt-6 px-2 text-center">
							<Hr className="mb-4 border-[#e4e4e7]" />
							<Text className="m-0 text-[#71717a] text-xs">
								Velocast · You're receiving this because you have an account.
							</Text>
							<Text className="m-0 mt-1 text-[#71717a] text-xs">
								© {new Date().getFullYear()} Velocast. All rights reserved.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
