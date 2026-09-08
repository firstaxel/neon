import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import type { JSX, SVGProps } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { useAppForm } from "#/hooks/form-hook";
import { authClient } from "#/lib/auth-client";
import { registerSchema } from "#/schema/auth";
import { AuthBrand } from "./auth-brand";

// ─── Google Icon ─────────────────────────────────────────────────────────────

const GoogleIcon = (
	props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>
) => (
	<svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18" {...props}>
		<title>Google</title>
		<path
			d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			fill="#4285F4"
		/>
		<path
			d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			fill="#34A853"
		/>
		<path
			d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
			fill="#FBBC05"
		/>
		<path
			d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
			fill="#EA4335"
		/>
	</svg>
);

// ─── Registration Form ────────────────────────────────────────────────────────

function PasswordRegisterForm({ callbackURL }: { callbackURL: string }) {
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const form = useAppForm({
		defaultValues: {
			confirmPassword: "",
			email: "",
			name: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.signUp.email({
				callbackURL: callbackURL ?? "/dashboard",
				email: value.email,
				name: value.name,
				password: value.password,
			});
			if (error) {
				toast.error(error.message ?? "Failed to create account");
				return;
			}
			toast.success("Account created successfully!");
			navigate({ to: callbackURL ?? "/dashboard" });
		},
		validators: {
			onBlur: registerSchema,
		},
	});

	return (
		<form.AppForm>
			<form
				className="w-full space-y-4"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				{/* Full Name */}
				<form.AppField
					name="name"
					validators={{
						onBlur: ({ value }) => {
							if (!value.trim()) {
								return "Full name is required";
							}
							if (value.trim().length < 2) {
								return "Name must be at least 2 characters";
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
								Full Name
							</label>
							<Input
								aria-invalid={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
								}
								autoComplete="name"
								autoFocus
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Adewale Bello"
								type="text"
								value={field.state.value}
							/>
							<field.Error className="text-destructive text-xs" />
						</field.Field>
					)}
				</form.AppField>

				{/* Email Address */}
				<form.AppField
					name="email"
					validators={{
						onBlur: ({ value }) => {
							if (!value.trim()) {
								return "Email address is required";
							}
							if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
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
								Email Address
							</label>
							<Input
								aria-invalid={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
								}
								autoComplete="email"
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

				{/* Password */}
				<form.AppField
					name="password"
					validators={{
						onBlur: ({ value }) => {
							if (!value) {
								return "Password is required";
							}
							if (value.length < 8) {
								return "Password must be at least 8 characters";
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
								Password
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
									placeholder="Min. 8 characters"
									type={showPassword ? "text" : "password"}
									value={field.state.value}
								/>
								<button
									aria-label={showPassword ? "Hide password" : "Show password"}
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

				{/* Confirm Password */}
				<form.AppField
					name="confirmPassword"
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
								Confirm Password
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
									placeholder="Repeat password"
									type={showConfirmPassword ? "text" : "password"}
									value={field.state.value}
								/>
								<button
									aria-label={
										showConfirmPassword
											? "Hide confirmed password"
											: "Show confirmed password"
									}
									className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
									onClick={() => setShowConfirmPassword((v) => !v)}
									type="button"
								>
									{showConfirmPassword ? (
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
						<Button
							className="mt-2 w-full"
							disabled={!canSubmit || isSubmitting}
							size="lg"
							type="submit"
						>
							{isSubmitting ? "Creating account…" : "Create account"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</form.AppForm>
	);
}

// ─── View ──────────────────────────────────────────────────────────────────────

export default function RegisterView({
	callbackURL,
}: {
	callbackURL?: string;
}) {
	const handleGoogleSignUp = async () => {
		try {
			await authClient.signIn.social({
				callbackURL: callbackURL ?? "/dashboard",
				provider: "google",
			});
		} catch {
			toast.error("Failed to initiate Google sign-in. Please try again.");
		}
	};

	return (
		<Card className="w-full rounded-4xl py-8 shadow-md">
			<CardContent>
				<div className="flex flex-col items-center space-y-6">
					<AuthBrand />

					<div className="space-y-1.5 text-center">
						<h1 className="font-semibold text-2xl text-foreground tracking-tight">
							Create your account
						</h1>
						<p className="text-muted-foreground text-sm">
							Already registered?{" "}
							<Link
								className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
								to="/login"
							>
								Sign in
							</Link>
						</p>
					</div>

					<div className="w-full space-y-4">
						<Button
							className="w-full gap-2.5"
							onClick={handleGoogleSignUp}
							size="lg"
							type="button"
							variant="outline"
						>
							<GoogleIcon />
							Continue with Google
						</Button>

						<div className="flex items-center gap-4 py-1">
							<Separator className="flex-1" />
							<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
								OR
							</span>
							<Separator className="flex-1" />
						</div>

						<PasswordRegisterForm callbackURL={callbackURL ?? "/dashboard"} />
					</div>

					<p className="w-11/12 text-balance text-center text-muted-foreground text-xs leading-relaxed">
						By creating an account, you agree to Velocast's{" "}
						<Link className="underline hover:text-foreground" to="/">
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link className="underline hover:text-foreground" to="/">
							Privacy Policy
						</Link>
						.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
