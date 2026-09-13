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
import { loginSchema, magicLinkSchema } from "#/schema/auth";
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

// ─── Magic-link sign-in form ──────────────────────────────────────────────────

function MagicLinkForm({ callbackURL }: { callbackURL: string }) {
	const [sent, setSent] = useState(false);

	const form = useAppForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			const { error } = await authClient.signIn.magicLink({
				callbackURL: callbackURL ?? "/dashboard",
				email: value.email,
			});
			if (error) {
				toast.error(error.message ?? "Failed to send sign-in link");
				return;
			}
			setSent(true);
		},
		validators: {
			onBlur: magicLinkSchema,
		},
	});

	if (sent) {
		return (
			<div className="w-full rounded-3xl border border-border bg-muted/40 px-5 py-4 text-center">
				<p className="font-medium text-foreground text-sm">Check your inbox</p>
				<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
					We sent a sign-in link to{" "}
					<span className="font-medium text-foreground">
						{form.getFieldValue("email")}
					</span>
					. It expires in 15 minutes.
				</p>
			</div>
		);
	}

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
				<form.AppField
					name="email"
					validators={{
						onBlur: ({ value }) => {
							if (!value.trim()) {
								return "Email is required";
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
						<Button
							className="w-full"
							disabled={!canSubmit || isSubmitting}
							size="lg"
							type="submit"
						>
							{isSubmitting ? "Sending link…" : "Send sign-in link"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</form.AppForm>
	);
}

// ─── Password sign-in form ─────────────────────────────────────────────────────

function PasswordForm({ callbackURL }: { callbackURL: string }) {
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
	const [isResending, setIsResending] = useState(false);

	const handleResendUnverified = async () => {
		if (!unverifiedEmail) {
			return;
		}
		setIsResending(true);
		try {
			await authClient.sendVerificationEmail({
				callbackURL: "/onboarding",
				email: unverifiedEmail,
			});
			toast.success("Verification email sent! Check your inbox.");
		} catch {
			toast.error("Failed to resend verification email.");
		} finally {
			setIsResending(false);
		}
	};

	const form = useAppForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			const destination = callbackURL || "/dashboard";
			const { error } = await authClient.signIn.email({
				callbackURL: destination,
				email: value.email,
				password: value.password,
			});
			if (error) {
				const isUnverified =
					error.code === "EMAIL_NOT_VERIFIED" ||
					error.status === 403 ||
					error.message?.toLowerCase().includes("verif");
				if (isUnverified) {
					setUnverifiedEmail(value.email);
					toast.error("Please verify your email before logging in.");
					return;
				}
				toast.error(error.message ?? "Invalid email or password");
				return; // Early return to prevent unauthorized redirection!
			}
			navigate({ to: destination });
		},
		validators: {
			onBlur: loginSchema,
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
				{unverifiedEmail ? (
					<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 text-xs dark:text-amber-300">
						<p className="font-medium">Email not verified</p>
						<p className="mt-0.5 text-muted-foreground">
							Please verify your address before accessing the dashboard.
						</p>
						<button
							className="mt-2 font-medium text-primary underline underline-offset-2 hover:text-primary/80 disabled:opacity-50"
							disabled={isResending}
							onClick={handleResendUnverified}
							type="button"
						>
							{isResending ? "Sending…" : "Resend verification email"}
						</button>
					</div>
				) : null}
				{/* Email */}
				<form.AppField
					name="email"
					validators={{
						onBlur: ({ value }) => {
							if (!value.trim()) {
								return "Email is required";
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
							<div className="flex items-center justify-between">
								<label
									className="font-medium text-foreground text-xs"
									htmlFor={field.name}
								>
									Password
								</label>
								<Link
									className="text-muted-foreground text-xs hover:text-foreground hover:underline"
									to="/forgot-password"
								>
									Forgot password?
								</Link>
							</div>
							<div className="relative">
								<Input
									aria-invalid={
										field.state.meta.isTouched &&
										field.state.meta.errors.length > 0
									}
									autoComplete="current-password"
									className="pr-10"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="••••••••"
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
							{isSubmitting ? "Signing in…" : "Sign in"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</form.AppForm>
	);
}

// ─── View ──────────────────────────────────────────────────────────────────────

export default function LoginView({ callbackURL }: { callbackURL?: string }) {
	const [usePassword, setUsePassword] = useState(true);

	const handleGoogleSignIn = async () => {
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
							Welcome back
						</h1>
						<p className="text-muted-foreground text-sm">
							Don't have an account?{" "}
							<Link
								className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
								to="/register"
							>
								Sign up
							</Link>
						</p>
					</div>

					<div className="w-full space-y-4">
						<Button
							className="w-full gap-2.5"
							onClick={handleGoogleSignIn}
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

						{usePassword ? (
							<PasswordForm callbackURL={callbackURL ?? "/dashboard"} />
						) : (
							<MagicLinkForm callbackURL={callbackURL ?? "/dashboard"} />
						)}

						<Button
							className="w-full text-muted-foreground text-xs hover:text-foreground"
							onClick={() => setUsePassword((v) => !v)}
							type="button"
							variant="ghost"
						>
							{usePassword
								? "Prefer passwordless? Sign in with magic link"
								: "Sign in using password instead"}
						</Button>
					</div>

					<p className="w-11/12 text-balance text-center text-muted-foreground text-xs leading-relaxed">
						By continuing, you agree to Velocast's{" "}
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
