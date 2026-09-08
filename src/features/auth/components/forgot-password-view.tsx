import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useAppForm } from "#/hooks/form-hook";
import { authClient } from "#/lib/auth-client";
import { AuthBrand } from "./auth-brand";

const forgotPasswordRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordView() {
	const [sent, setSent] = useState(false);
	const [sentEmail, setSentEmail] = useState("");

	const form = useAppForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			try {
				await authClient.requestPasswordReset({
					email: value.email,
					redirectTo: "/reset-password",
				});
			} catch {
				// Avoid leaking user registration status while handling network/runtime errors gracefully
				toast.error("Unable to process request right now. Please try again.");
			}
			setSentEmail(value.email);
			setSent(true);
		},
	});

	return (
		<Card className="w-full rounded-4xl py-8 shadow-md">
			<CardContent>
				<div className="flex flex-col items-center space-y-6">
					<AuthBrand />

					<div className="space-y-1.5 text-center">
						<h1 className="font-semibold text-2xl text-foreground tracking-tight">
							Reset your password
						</h1>
						<p className="text-muted-foreground text-sm">
							{sent
								? "Check your inbox for the link"
								: "Enter your account email to receive a recovery link"}
						</p>
					</div>

					{sent ? (
						<div className="w-full space-y-4">
							<div className="w-full rounded-3xl border border-border bg-muted/40 px-5 py-4 text-center">
								<p className="font-medium text-foreground text-sm">
									Reset link sent
								</p>
								<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
									We sent instructions to{" "}
									<span className="font-medium text-foreground">
										{sentEmail}
									</span>
									. The link expires in 15 minutes.
								</p>
							</div>
							<Button
								className="w-full"
								nativeButton={false}
								render={<Link to="/login">Return to sign in</Link>}
								size="lg"
								variant="outline"
							/>
						</div>
					) : (
						<form.AppForm>
							<form
								className="w-full space-y-4"
								noValidate
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
							>
								<form.AppField
									name="email"
									validators={{
										onBlur: ({ value }) => {
											if (!value) {
												return "Email is required";
											}
											if (!forgotPasswordRegex.test(value)) {
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
												Account Email
											</label>
											<Input
												aria-invalid={
													field.state.meta.isTouched &&
													field.state.meta.errors.length > 0
												}
												autoComplete="email"
												autoFocus
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="leader@organization.org"
												type="email"
												value={field.state.value}
											/>
											<field.Error className="text-destructive text-xs" />
										</field.Field>
									)}
								</form.AppField>

								<form.Subscribe
									selector={(s) => [s.canSubmit, s.isSubmitting] as const}
								>
									{([canSubmit, isSubmitting]) => (
										<div className="space-y-3 pt-1">
											<Button
												className="w-full"
												disabled={!canSubmit || isSubmitting}
												size="lg"
												type="submit"
											>
												{isSubmitting ? "Sending link…" : "Send reset link"}
											</Button>
											<Button
												className="w-full text-muted-foreground text-xs hover:text-foreground"
												nativeButton={false}
												render={
													<Link to="/login">
														Remember your password? Sign in
													</Link>
												}
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
