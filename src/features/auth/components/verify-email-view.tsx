import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useAppForm } from "#/hooks/form-hook";
import { authClient } from "#/lib/auth-client";
import { AuthBrand } from "./auth-brand";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface VerifyEmailViewProps {
	email?: string;
	error?: string;
}

const subscribeSelector = (s: { canSubmit: boolean; isSubmitting: boolean }) =>
	[s.canSubmit, s.isSubmitting] as const;

function EmailFieldInput({
	field,
}: {
	field: {
		name: string;
		state: {
			value: string;
			meta: {
				isTouched: boolean;
				errors: unknown[];
			};
		};
		handleBlur: () => void;
		handleChange: (val: string) => void;
	};
}) {
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			field.handleChange(e.target.value);
		},
		[field]
	);

	return (
		<Input
			aria-invalid={
				field.state.meta.isTouched && field.state.meta.errors.length > 0
			}
			autoComplete="email"
			autoFocus
			id={field.name}
			name={field.name}
			onBlur={field.handleBlur}
			onChange={handleChange}
			placeholder="leader@organization.org"
			type="email"
			value={field.state.value}
		/>
	);
}

export default function VerifyEmailView({
	email: initialEmail = "",
	error: initialError = "",
}: VerifyEmailViewProps) {
	const [targetEmail, setTargetEmail] = useState(initialEmail);
	const [isSending, setIsSending] = useState(false);
	const [resent, setResent] = useState(false);

	const handleResend = useCallback(async (emailToUse: string) => {
		if (!(emailToUse && emailRegex.test(emailToUse))) {
			toast.error("Please provide a valid email address");
			return;
		}

		setIsSending(true);
		try {
			const { error } = await authClient.sendVerificationEmail({
				callbackURL: "/onboarding",
				email: emailToUse,
			});

			if (error) {
				toast.error(error.message ?? "Failed to resend verification email");
				return;
			}

			setResent(true);
			toast.success("Verification link sent! Please check your inbox.");
		} catch {
			toast.error("Unable to resend verification email. Please try again.");
		} finally {
			setIsSending(false);
		}
	}, []);

	const handleResendClick = useCallback(() => {
		if (targetEmail) {
			handleResend(targetEmail);
		}
	}, [handleResend, targetEmail]);

	const form = useAppForm({
		defaultValues: { email: initialEmail },
		onSubmit: async ({ value }) => {
			setTargetEmail(value.email);
			await handleResend(value.email);
		},
	});

	const handleFormSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			form.handleSubmit();
		},
		[form]
	);

	const errorMessage =
		initialError === "invalid_token"
			? "The verification link is invalid or has expired. Please request a fresh one below."
			: initialError;

	return (
		<Card className="w-full rounded-4xl py-8 shadow-md">
			<CardContent>
				<div className="flex flex-col items-center space-y-6">
					<AuthBrand />

					<div className="space-y-1.5 text-center">
						<div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Mail className="size-6" />
						</div>
						<h1 className="font-semibold text-2xl text-foreground tracking-tight">
							Verify your email
						</h1>
						<p className="text-muted-foreground text-sm">
							Confirm your address to activate your Velocast broadcast workspace
						</p>
					</div>

					{initialError ? (
						<Alert className="w-full" variant="destructive">
							<AlertCircle className="size-4" />
							<AlertTitle>Verification error</AlertTitle>
							<AlertDescription className="text-xs">
								{errorMessage}
							</AlertDescription>
						</Alert>
					) : null}

					{targetEmail ? (
						<div className="w-full space-y-4">
							<div className="w-full rounded-3xl border border-border bg-muted/40 px-5 py-4 text-center">
								<p className="font-medium text-foreground text-sm">
									Verification link sent
								</p>
								<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
									We sent a confirmation link to{" "}
									<span className="font-medium text-foreground">
										{targetEmail}
									</span>
									. Click the link to complete account activation.
								</p>
							</div>

							{resent ? (
								<div className="flex items-center justify-center gap-2 text-emerald-600 text-xs dark:text-emerald-400">
									<CheckCircle2 className="size-4" />
									<span>A fresh link has been delivered to your inbox</span>
								</div>
							) : null}

							<div className="space-y-2 pt-2">
								<Button
									className="w-full"
									disabled={isSending}
									onClick={handleResendClick}
									size="lg"
									type="button"
									variant="outline"
								>
									{isSending ? "Sending link…" : "Resend verification email"}
								</Button>

								<Button
									className="w-full text-muted-foreground text-xs hover:text-foreground"
									nativeButton={false}
									render={<Link to="/login">Back to sign in</Link>}
									size="sm"
									variant="ghost"
								/>
							</div>
						</div>
					) : (
						<form.AppForm>
							<form
								className="w-full space-y-4"
								noValidate
								onSubmit={handleFormSubmit}
							>
								<form.AppField
									name="email"
									validators={{
										onBlur: ({ value }) => {
											if (!value) {
												return "Email is required";
											}
											if (!emailRegex.test(value)) {
												return "Please enter a valid email address";
											}
										},
									}}
								>
									{(field) => (
										<field.Field className="gap-1.5" id={field.name}>
											<label
												className="font-medium text-foreground text-xs"
												htmlFor={field.name}
											>
												Your Email Address
											</label>
											<EmailFieldInput field={field} />
											<field.Error className="text-destructive text-xs" />
										</field.Field>
									)}
								</form.AppField>

								<form.Subscribe selector={subscribeSelector}>
									{([canSubmit, isSubmitting]) => (
										<div className="space-y-3 pt-1">
											<Button
												className="w-full"
												disabled={!canSubmit || isSubmitting || isSending}
												size="lg"
												type="submit"
											>
												{isSubmitting || isSending
													? "Sending link…"
													: "Send verification link"}
											</Button>
											<Button
												className="w-full text-muted-foreground text-xs hover:text-foreground"
												nativeButton={false}
												render={<Link to="/login">Back to sign in</Link>}
												size="sm"
												variant="ghost"
											/>
										</div>
									)}
								</form.Subscribe>
							</form>
						</form.AppForm>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
