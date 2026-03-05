/**
 * /billing/verify
 *
 * Paystack redirects here after payment.
 * ?reference=xxx         — Paystack reference (required)
 * ?type=subscription     — optional, shows subscription copy
 */

import { Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	Loader2,
	Sparkles,
	Wallet,
	XCircle,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";
import { cn } from "#/lib/utils";
import { useVerifyDeposit } from "../hooks/use-billing";

type State = "loading" | "success" | "error";
type PayType = "deposit" | "subscription";

function VerifyContent({
	reference,
	payType,
}: {
	reference: string;
	payType: PayType;
}) {
	const router = useRouter();

	const [state, setState] = useState<State>("loading");
	const [headline, setHeadline] = useState("");
	const [detail, setDetail] = useState("");
	const [amount, setAmount] = useState<string | null>(null);

	const { mutate } = useVerifyDeposit();

	useEffect(() => {
		if (!reference) {
			setState("error");
			setHeadline("No reference found");
			setDetail(
				"This page was opened without a payment reference. Please return to billing and try again."
			);
			return;
		}

		mutate(
			{ reference },
			{
				onSuccess: (data) => {
					try {
						setState("success");

						if (payType === "subscription") {
							setHeadline("Plan activated!");
							setDetail(
								"Your subscription is now live. Your monthly message allowance is ready to use."
							);
						} else if (data.alreadyProcessed) {
							setHeadline("Already credited");
							setDetail(
								"This payment was already processed. Your wallet balance is up to date."
							);
						} else {
							const n = ((data.amountKobo ?? 0) / 100).toLocaleString();
							setHeadline("Payment confirmed!");
							setDetail("Your wallet has been topped up successfully.");
							setAmount(`\u20a6${n}`);
						}

						setTimeout(
							() =>
								router.navigate({
									to: "/billing",
								}),
							3500
						);
					} catch (err: unknown) {
						setState("error");
						setHeadline("Verification failed");
						const msg = err instanceof Error ? err.message : "";
						setDetail(
							msg ||
								"We couldn't verify this payment. If funds were deducted, please contact support with your reference number."
						);
					}
				},
			}
		);
	}, [reference, router, payType, mutate]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
			{/* Subtle dot grid background */}
			<div
				className="pointer-events-none fixed inset-0 opacity-[0.03]"
				style={{
					backgroundImage:
						"radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 0)",
					backgroundSize: "24px 24px",
				}}
			/>

			<div className="relative z-10 w-full max-w-sm animate-fade-up">
				{/* Logo mark */}
				<div className="mb-10 flex items-center justify-center gap-2.5">
					<div
						className={cn(
							"flex h-9 w-9 items-center justify-center rounded-xl border",
							"border-primary/25 bg-primary/10"
						)}
					>
						{payType === "subscription" ? (
							<Sparkles className="h-4 w-4 text-primary" />
						) : (
							<Wallet className="h-4 w-4 text-primary" />
						)}
					</div>
					<span className="font-bold font-display text-foreground text-lg tracking-tight">
						MessageDesk
					</span>
				</div>

				<Card className="overflow-hidden">
					{/* Icon area */}
					<div
						className={cn(
							"flex flex-col items-center gap-4 px-8 pt-10 pb-8",
							state === "success" && "bg-primary/3",
							state === "error" && "bg-destructive/3"
						)}
					>
						{/* Status icon */}
						<div
							className={cn(
								"flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-500",
								state === "loading" && "border-border bg-muted/30",
								state === "success" && "border-primary/30 bg-primary/10",
								state === "error" && "border-destructive/30 bg-destructive/10"
							)}
						>
							{state === "loading" && (
								<Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
							)}
							{state === "success" && (
								<CheckCircle2 className="h-7 w-7 text-primary" />
							)}
							{state === "error" && (
								<XCircle className="h-7 w-7 text-destructive" />
							)}
						</div>

						{/* Headline */}
						<div className="text-center">
							<h1 className="font-bold font-display text-foreground text-xl tracking-tight">
								{state === "loading" ? "Verifying payment…" : headline}
							</h1>

							{/* Amount badge — success deposit only */}
							{state === "success" && amount && (
								<div className="mt-2 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
									<span className="font-bold font-mono text-primary text-xl">
										{amount}
									</span>
								</div>
							)}

							<p className="mt-2 max-w-xs text-muted-foreground text-sm leading-relaxed">
								{state === "loading"
									? "Please wait while we confirm your payment with Paystack…"
									: detail}
							</p>
						</div>
					</div>

					<Separator />

					{/* Footer action */}
					<div className="px-6 py-5">
						{state === "loading" && (
							<p className="text-center text-muted-foreground/60 text-xs">
								This usually takes just a moment
							</p>
						)}

						{state === "success" && (
							<div className="flex flex-col items-center gap-2">
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<Loader2 className="h-3 w-3 animate-spin" />
									Redirecting to billing…
								</div>
								<Link
									className="text-muted-foreground/60 text-xs underline underline-offset-2"
									to="/billing"
								>
									Go now
								</Link>
							</div>
						)}

						{state === "error" && (
							<div className="flex flex-col gap-3">
								<Button
									className="w-full rounded-xl font-bold"
									render={
										<Link to="/billing">
											<Wallet className="h-4 w-4" /> Go to Billing
										</Link>
									}
								/>
								<p className="text-center text-[11px] text-muted-foreground/60">
									Still having issues?{" "}
									<a
										className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
										href="mailto:support@messagedesk.app"
									>
										Contact support
									</a>
									{reference && (
										<span>
											{" · "}ref:{" "}
											<code className="font-mono text-[10px]">
												{reference.slice(0, 18)}…
											</code>
										</span>
									)}
								</p>
							</div>
						)}
					</div>
				</Card>

				{/* Back link — only while loading */}
				{state === "loading" && (
					<div className="mt-5 flex justify-center">
						<Link
							className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
							to="/billing"
						>
							<ArrowLeft className="h-3.5 w-3.5" /> Cancel and go back
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}

export default function BillingVerifyPage({
	params,
}: {
	params: { reference: string; payType: PayType };
}) {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center bg-background">
					<Loader2 className="h-7 w-7 animate-spin text-primary" />
				</div>
			}
		>
			<VerifyContent {...params} />
		</Suspense>
	);
}
