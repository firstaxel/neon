/**
 * src/features/auth/components/reset-password-view.tsx
 *
 * Password reset page — receives the ?token= from Better Auth's reset email
 * and calls authClient.resetPassword to set a new password.
 */

import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { JSX, SVGProps } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useAppForm } from "#/hooks/form-hook";
import { authClient } from "#/lib/auth-client";

const Logo = (props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) => (
	<svg
		fill="currentColor"
		height="48"
		viewBox="0 0 40 48"
		width="40"
		{...props}
	>
		<title>Logo</title>
		<clipPath id="a-rp">
			<path d="m0 0h40v48h-40z" />
		</clipPath>
		<g clipPath="url(#a-rp)">
			<path d="m25.0887 5.05386-3.933-1.05386-3.3145 12.3696-2.9923-11.16736-3.9331 1.05386 3.233 12.0655-8.05262-8.0526-2.87919 2.8792 8.83271 8.8328-10.99975-2.9474-1.05385625 3.933 12.01860625 3.2204c-.1376-.5935-.2104-1.2119-.2104-1.8473 0-4.4976 3.646-8.1436 8.1437-8.1436 4.4976 0 8.1436 3.646 8.1436 8.1436 0 .6313-.0719 1.2459-.2078 1.8359l10.9227 2.9267 1.0538-3.933-12.0664-3.2332 11.0005-2.9476-1.0539-3.933-12.0659 3.233 8.0526-8.0526-2.8792-2.87916-8.7102 8.71026z" />
			<path d="m27.8723 26.2214c-.3372 1.4256-1.0491 2.7063-2.0259 3.7324l7.913 7.9131 2.8792-2.8792z" />
			<path d="m25.7665 30.0366c-.9886 1.0097-2.2379 1.7632-3.6389 2.1515l2.8794 10.746 3.933-1.0539z" />
			<path d="m21.9807 32.2274c-.65.1671-1.3313.2559-2.0334.2559-.7522 0-1.4806-.102-2.1721-.2929l-2.882 10.7558 3.933 1.0538z" />
			<path d="m17.6361 32.1507c-1.3796-.4076-2.6067-1.1707-3.5751-2.1833l-7.9325 7.9325 2.87919 2.8792z" />
			<path d="m13.9956 29.8973c-.9518-1.019-1.6451-2.2826-1.9751-3.6862l-10.95836 2.9363 1.05385 3.933z" />
		</g>
	</svg>
);

export default function ResetPasswordView() {
	const navigate = useNavigate();
	// Better Auth appends ?token= to the reset URL
	const search = useSearch({ strict: false }) as { token?: string };
	const token = search.token;
	const [showPassword, setShowPassword] = useState(false);

	const form = useAppForm({
		defaultValues: { password: "", confirm: "" },
		onSubmit: async ({ value }) => {
			if (!token) {
				throw new Error(
					"Missing reset token — please use the link from your email"
				);
			}

			const { error } = await authClient.resetPassword({
				newPassword: value.password,
				token,
			});

			if (error) {
				throw new Error(error.message ?? "Failed to reset password");
			}

			toast.success("Password reset — you can now sign in");
			navigate({ to: "/login" });
		},
	});

	// No token — show helpful message
	if (!token) {
		return (
			<div className="flex min-h-dvh items-center justify-center">
				<Card className="w-full max-w-sm rounded-4xl px-6 py-10 pt-14">
					<CardContent>
						<div className="flex flex-col items-center space-y-8 text-center">
							<Logo />
							<div className="space-y-2">
								<h1 className="font-semibold text-3xl text-foreground">
									Invalid link
								</h1>
								<p className="text-muted-foreground text-sm">
									This password reset link is missing or has expired. Request a
									new one.
								</p>
							</div>
							<Button
								className="w-full rounded-xl"
								render={
									<Link to="/forgot-password">Request a new reset link</Link>
								}
								size="lg"
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-dvh items-center justify-center">
			<Card className="w-full max-w-sm rounded-4xl px-6 py-10 pt-14">
				<CardContent>
					<div className="flex flex-col items-center space-y-8">
						<Logo />

						<div className="space-y-2 text-center">
							<h1 className="font-semibold text-3xl text-foreground">
								Set new password
							</h1>
							<p className="text-muted-foreground text-sm">
								Choose a password you haven't used before
							</p>
						</div>

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
									name="password"
									validators={{
										onBlur: ({ value }) => {
											if (!value) {
												return "Password is required";
											}
											if (value.length < 8) {
												return "Must be at least 8 characters";
											}
										},
									}}
								>
									{(field) => (
										<field.Field id={field.name}>
											<div className="relative">
												<Input
													aria-invalid={
														field.state.meta.isTouched &&
														field.state.meta.errors.length > 0
													}
													autoComplete="new-password"
													autoFocus
													className="w-full rounded-xl pr-10"
													id={field.name}
													name={field.name}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="New password (min 8 chars)"
													type={showPassword ? "text" : "password"}
													value={field.state.value}
												/>
												<button
													className="absolute inset-y-0 right-3 flex items-center text-muted-foreground"
													onClick={() => setShowPassword((v) => !v)}
													type="button"
												>
													{showPassword ? (
														<svg
															className="h-4 w-4"
															fill="none"
															stroke="currentColor"
															strokeWidth={1.5}
															viewBox="0 0 24 24"
														>
															<title>Hide password</title>
															<path
																d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													) : (
														<svg
															className="h-4 w-4"
															fill="none"
															stroke="currentColor"
															strokeWidth={1.5}
															viewBox="0 0 24 24"
														>
															<title>Show password</title>

															<path
																d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
															<path
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													)}
												</button>
											</div>
											<field.Error />
										</field.Field>
									)}
								</form.AppField>

								<form.AppField
									name="confirm"
									validators={{
										onBlur: ({ value, fieldApi }) => {
											const pw = fieldApi.form.getFieldValue("password");
											if (!value) {
												return "Please confirm your password";
											}
											if (value !== pw) {
												return "Passwords do not match";
											}
										},
									}}
								>
									{(field) => (
										<field.Field id={field.name}>
											<Input
												aria-invalid={
													field.state.meta.isTouched &&
													field.state.meta.errors.length > 0
												}
												autoComplete="new-password"
												className="w-full rounded-xl"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Confirm new password"
												type="password"
												value={field.state.value}
											/>
											<field.Error />
										</field.Field>
									)}
								</form.AppField>

								<form.Subscribe
									selector={(s) =>
										[s.canSubmit, s.isSubmitting, s.errors] as const
									}
								>
									{([canSubmit, isSubmitting, errors]) => (
										<div className="space-y-2">
											{errors.length > 0 && (
												<p
													className="text-center text-destructive text-xs"
													role="alert"
												>
													{String(errors[0])}
												</p>
											)}
											<Button
												className="w-full rounded-xl"
												disabled={!canSubmit || isSubmitting}
												size="lg"
												type="submit"
											>
												{isSubmitting ? "Resetting…" : "Reset password"}
											</Button>
										</div>
									)}
								</form.Subscribe>
							</form>
						</form.AppForm>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
