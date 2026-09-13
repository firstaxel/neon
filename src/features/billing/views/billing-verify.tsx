/**
 * src/features/billing/views/billing-verify.tsx
 *
 * Paystack redirects here after deposit payment.
 * ?reference=xxx: Paystack deposit reference (required)
 */

import { Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	Loader2,
	Wallet,
	XCircle,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";
import { useVerifyDeposit } from "#/features/billing/hooks/use-billing";
import { cn } from "#/lib/utils";

type State = "loading" | "success" | "error";

function VerifyContent({ reference }: { reference: string }) {
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

		let redirectTimer: ReturnType<typeof setTimeout> | undefined;

		mutate(
			{ reference },
			{
				onError: (err: unknown) => {
					setState("error");
					setHeadline("Verification failed");
					const msg = err instanceof Error ? err.message : "";
					setDetail(
						msg ||
							"We could not verify this payment. If funds were deducted, please contact support with your reference."
					);
				},
				onSuccess: (data) => {
					try {
						setState("success");

						const formattedAmount =
							data.newBalanceFormatted && data.amountKobo
								? `₦${((data.amountKobo ?? 0) / 100).toLocaleString()}`
								: null;

						if (data.alreadyProcessed) {
							setHeadline("Already credited");
							setDetail(
								"This payment was already processed. Your wallet balance is up to date."
							);
							setAmount(formattedAmount);
						} else {
							setHeadline("Payment confirmed");
							setDetail("Your wallet has been topped up successfully.");
							setAmount(formattedAmount);
						}

						redirectTimer = setTimeout(() => {
							router.navigate({ to: "/billing" });
						}, 3000);
					} catch (err: unknown) {
						setState("error");
						setHeadline("Verification failed");
						const msg = err instanceof Error ? err.message : "";
						setDetail(
							msg ||
								"We could not verify this payment. If funds were deducted, please contact support with your reference."
						);
					}
				},
			}
		);

		return () => {
			if (redirectTimer) {
				clearTimeout(redirectTimer);
			}
		};
	}, [reference, router, mutate]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
			{/* Dot pattern background */}
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
						<Wallet className="h-4 w-4 text-primary" />
					</div>
					<span className="font-bold font-display text-foreground text-lg tracking-tight">
						Velocast
					</span>
				</div>

				<Card className="overflow-hidden">
					{/* Status icon area */}
					<div
						className={cn(
							"flex flex-col items-center gap-4 px-8 pt-10 pb-8",
							state === "success" && "bg-primary/3",
							state === "error" && "bg-destructive/3"
						)}
					>
						<div
							className={cn(
								"flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-500",
								state === "loading" && "border-border bg-muted/30",
								state === "success" && "border-primary/30 bg-primary/10",
								state === "error" && "border-destructive/30 bg-destructive/10"
							)}
						>
							{state === "loading" ? (
								<Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
							) : null}
							{state === "success" ? (
								<CheckCircle2 className="h-7 w-7 text-primary" />
							) : null}
							{state === "error" ? (
								<XCircle className="h-7 w-7 text-destructive" />
							) : null}
						</div>

						{/* Headline */}
						<div className="text-center">
							<h1 className="font-bold font-display text-foreground text-xl tracking-tight">
								{state === "loading" ? "Verifying payment..." : headline || ""}
							</h1>

							{/* Amount badge */}
							{state === "success" && amount ? (
								<div className="mt-2 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
									<span className="font-bold font-mono text-primary text-xl">
										{amount}
									</span>
								</div>
							) : null}

							<p className="mt-2 max-w-xs text-muted-foreground text-sm leading-relaxed">
								{state === "loading"
									? "Please wait while we confirm your payment with Paystack..."
									: detail || ""}
							</p>
						</div>
					</div>

					<Separator />

					{/* Footer action */}
					<div className="px-6 py-5">
						{state === "loading" ? (
							<p className="text-center text-muted-foreground/60 text-xs">
								This usually takes just a moment
							</p>
						) : null}

						{state === "success" ? (
							<div className="flex flex-col items-center gap-2">
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<Loader2 className="h-3 w-3 animate-spin" />
									Redirecting to billing...
								</div>
								<Link
									className="text-muted-foreground/60 text-xs underline underline-offset-2"
									to="/billing"
								>
									Go now
								</Link>
							</div>
						) : null}

						{state === "error" ? (
							<div className="flex flex-col gap-3">
								<Button
									className="w-full rounded-xl font-bold"
									nativeButton={false}
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
										href="mailto:support@velocast.app"
									>
										Contact support
									</a>
									{reference ? (
										<span>
											{" "}
											ref:{" "}
											<code className="font-mono text-[10px]">
												{reference.slice(0, 18)}...
											</code>
										</span>
									) : null}
								</p>
							</div>
						) : null}
					</div>
				</Card>

				{/* Back link */}
				{state === "loading" ? (
					<div className="mt-5 flex justify-center">
						<Link
							className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
							to="/billing"
						>
							<ArrowLeft className="h-3.5 w-3.5" /> Cancel and return to billing
						</Link>
					</div>
				) : null}
			</div>
		</div>
	);
}

export function BillingVerifyView({ reference }: { reference?: string }) {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center bg-background">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<VerifyContent reference={reference ?? ""} />
		</Suspense>
	);
}
