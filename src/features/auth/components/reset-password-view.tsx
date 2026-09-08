import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useAppForm } from "#/hooks/form-hook";
import { authClient } from "#/lib/auth-client";
import { AuthBrand } from "./auth-brand";

export default function ResetPasswordView() {
	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as { token?: string };
	const token = search.token;
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const form = useAppForm({
		defaultValues: { confirm: "", password: "" },
		onSubmit: async ({ value }) => {
			if (!token) {
				toast.error(
					"Missing reset token — please use the link from your email"
				);
				return;
			}

			const { error } = await authClient.resetPassword({
				newPassword: value.password,
				token,
			});

			if (error) {
				toast.error(error.message ?? "Failed to reset password");
				return;
			}

			toast.success("Password reset successfully — you can now sign in");
			navigate({ to: "/login" });
		},
	});

	// Missing or invalid token recovery state
	if (!token) {
		return (
			<Card className="w-full rounded-4xl py-8 shadow-md">
				<CardContent>
					<div className="flex flex-col items-center space-y-6 text-center">
						<AuthBrand />
						<div className="space-y-2">
							<h1 className="font-semibold text-2xl text-foreground tracking-tight">
								Invalid or expired link
							</h1>
							<p className="text-muted-foreground text-sm">
								This password reset link is missing or has expired. Please
								request a fresh one.
							</p>
						</div>
						<Button
							className="w-full"
							nativeButton={false}
							render={<Link to="/forgot-password">Request new reset link</Link>}
							size="lg"
						/>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full rounded-4xl py-8 shadow-md">
			<CardContent>
				<div className="flex flex-col items-center space-y-6">
					<AuthBrand />

					<div className="space-y-1.5 text-center">
						<h1 className="font-semibold text-2xl text-foreground tracking-tight">
							Set new password
						</h1>
						<p className="text-muted-foreground text-sm">
							Choose a secure password with at least 8 characters
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
									<field.Field className="gap-1.5" id={field.name}>
										<label
											className="font-medium text-foreground text-xs"
											htmlFor={field.name}
										>
											New Password
										</label>
										<div className="relative">
											<Input
												aria-invalid={
													field.state.meta.isTouched &&
													field.state.meta.errors.length > 0
												}
												autoComplete="new-password"
												autoFocus
												className="pr-10"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="New password (min 8 chars)"
												type={showPassword ? "text" : "password"}
												value={field.state.value}
											/>
											<button
												aria-label={
													showPassword ? "Hide password" : "Show password"
												}
												className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
												onClick={() => setShowPassword((v) => !v)}
												type="button"
											>
												{showPassword ? (
													<EyeOff className="size-4" />
												) : (
													<Eye className="size-4" />
												)}
											</button>
										</div>
										<field.Error className="text-destructive text-xs" />
									</field.Field>
								)}
							</form.AppField>

							<form.AppField
								name="confirm"
								validators={{
									onBlur: ({ value, fieldApi }) => {
										if (!value) {
											return "Please confirm your password";
										}
										if (value !== fieldApi.form.getFieldValue("password")) {
											return "Passwords do not match";
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
											Confirm New Password
										</label>
										<div className="relative">
											<Input
												aria-invalid={
													field.state.meta.isTouched &&
													field.state.meta.errors.length > 0
												}
												autoComplete="new-password"
												className="pr-10"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Confirm new password"
												type={showConfirm ? "text" : "password"}
												value={field.state.value}
											/>
											<button
												aria-label={
													showConfirm ? "Hide password" : "Show password"
												}
												className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
												onClick={() => setShowConfirm((v) => !v)}
												type="button"
											>
												{showConfirm ? (
													<EyeOff className="size-4" />
												) : (
													<Eye className="size-4" />
												)}
											</button>
										</div>
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
											{isSubmitting ? "Updating password…" : "Update password"}
										</Button>
										<Button
											className="w-full text-muted-foreground text-xs hover:text-foreground"
											nativeButton={false}
											render={<Link to="/login">Cancel and sign in</Link>}
											size="sm"
											variant="ghost"
										/>
									</div>
								)}
							</form.Subscribe>
						</form>
					</form.AppForm>
				</div>
			</CardContent>
		</Card>
	);
}
