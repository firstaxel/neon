import { Link, useNavigate } from "@tanstack/react-router";
import type { JSX, SVGProps } from "react";
import { useState } from "react";
import z from "zod";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { useAppForm } from "#/hooks/form-hook";
import { authClient } from "#/lib/auth-client";
import { magicLinkSchema, registerSchema } from "#/schema/auth";

// ─── Icons ────────────────────────────────────────────────────────────────────

const Logo = (props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) => (
	<svg
		fill="currentColor"
		height="48"
		viewBox="0 0 40 48"
		width="40"
		{...props}
	>
		<title>Logo</title>
		<clipPath id="logo-clip-register">
			<path d="m0 0h40v48h-40z" />
		</clipPath>
		<g clipPath="url(#logo-clip-register)">
			<path d="m25.0887 5.05386-3.933-1.05386-3.3145 12.3696-2.9923-11.16736-3.9331 1.05386 3.233 12.0655-8.05262-8.0526-2.87919 2.8792 8.83271 8.8328-10.99975-2.9474-1.05385625 3.933 12.01860625 3.2204c-.1376-.5935-.2104-1.2119-.2104-1.8473 0-4.4976 3.646-8.1436 8.1437-8.1436 4.4976 0 8.1436 3.646 8.1436 8.1436 0 .6313-.0719 1.2459-.2078 1.8359l10.9227 2.9267 1.0538-3.933-12.0664-3.2332 11.0005-2.9476-1.0539-3.933-12.0659 3.233 8.0526-8.0526-2.8792-2.87916-8.7102 8.71026z" />
			<path d="m27.8723 26.2214c-.3372 1.4256-1.0491 2.7063-2.0259 3.7324l7.913 7.9131 2.8792-2.8792z" />
			<path d="m25.7665 30.0366c-.9886 1.0097-2.2379 1.7632-3.6389 2.1515l2.8794 10.746 3.933-1.0539z" />
			<path d="m21.9807 32.2274c-.65.1671-1.3313.2559-2.0334.2559-.7522 0-1.4806-.102-2.1721-.2929l-2.882 10.7558 3.933 1.0538z" />
			<path d="m17.6361 32.1507c-1.3796-.4076-2.6067-1.1707-3.5751-2.1833l-7.9325 7.9325 2.87919 2.8792z" />
			<path d="m13.9956 29.8973c-.9518-1.019-1.6451-2.2826-1.9751-3.6862l-10.95836 2.9363 1.05385 3.933z" />
		</g>
	</svg>
);

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

// ─── Shared field component ────────────────────────────────────────────────────

// ─── Magic-link registration form ─────────────────────────────────────────────

function MagicLinkRegisterForm({ callbackURL }: { callbackURL: string }) {
	const [sent, setSent] = useState(false);

	const form = useAppForm({
		defaultValues: { name: "", email: "" },
		validators: {
			onBlur: magicLinkSchema.extend({
				name: z.string().min(1),
			}),
		},
		onSubmit: async ({ value }) => {
			// Magic link: create account then send the link in one step
			const { error } = await authClient.signIn.magicLink({
				email: value.email,
				name: value.name,
				callbackURL: callbackURL ?? "/dashboard",
			});
			if (error) {
				throw new Error(error.message ?? "Failed to send link");
			}
			setSent(true);
		},
	});

	if (sent) {
		return (
			<div className="w-full rounded-xl border border-border bg-muted/40 px-5 py-4 text-center">
				<p className="font-medium text-foreground text-sm">Check your inbox</p>
				<p className="mt-1 text-muted-foreground text-xs">
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
					name="name"
					validators={{
						onBlur: ({ value }) => {
							if (!value.trim()) {
								return "Name is required";
							}
							if (value.trim().length < 2) {
								return "Name must be at least 2 characters";
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
								autoComplete="name"
								className="w-full rounded-xl"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Your name"
								type="text"
								value={field.state.value}
							/>
						</field.Field>
					)}
				</form.AppField>

				<form.AppField name="email">
					{(field) => (
						<field.Field id={field.name}>
							<Input
								aria-invalid={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
								}
								autoComplete="email"
								className="w-full rounded-xl"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Your email"
								type="email"
								value={field.state.value}
							/>
						</field.Field>
					)}
				</form.AppField>

				<form.Subscribe
					selector={(s) => [s.canSubmit, s.isSubmitting, s.errors] as const}
				>
					{([canSubmit, isSubmitting, errors]) => (
						<div className="flex flex-col gap-2">
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
								{isSubmitting ? "Sending…" : "Send me the magic link"}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
		</form.AppForm>
	);
}

// ─── Password registration form ────────────────────────────────────────────────

function PasswordRegisterForm({ callbackURL }: { callbackURL: string }) {
	const navigate = useNavigate();

	const form = useAppForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		validators: {
			onBlur: registerSchema,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.signUp.email({
				name: value.name,
				email: value.email,
				password: value.password,
				callbackURL: callbackURL ?? "/dashboard",
			});
			if (error) {
				throw new Error(error.message ?? "Failed to create account");
			}
			navigate({ to: callbackURL ?? "/dashboard" });
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
				<form.AppField name="name">
					{(field) => (
						<field.Field id={field.name}>
							<Input
								aria-invalid={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
								}
								autoComplete="name"
								className="w-full rounded-xl"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Your name"
								type="text"
								value={field.state.value}
							/>
						</field.Field>
					)}
				</form.AppField>

				<form.AppField name="email">
					{(field) => (
						<field.Field id={field.name}>
							<Input
								aria-invalid={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
								}
								autoComplete="email"
								className="w-full rounded-xl"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Your email"
								type="email"
								value={field.state.value}
							/>
						</field.Field>
					)}
				</form.AppField>

				<form.AppField name="password">
					{(field) => (
						<field.Field id={field.name}>
							<Input
								aria-invalid={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
								}
								autoComplete="new-password"
								autoFocus
								className="w-full rounded-xl"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Create a password"
								type="password"
								value={field.state.value}
							/>
						</field.Field>
					)}
				</form.AppField>

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
								placeholder="Confirm your password"
								type="password"
								value={field.state.value}
							/>
						</field.Field>
					)}
				</form.AppField>

				<form.Subscribe
					selector={(s) => [s.canSubmit, s.isSubmitting, s.errors] as const}
				>
					{([canSubmit, isSubmitting, errors]) => (
						<div className="flex flex-col gap-2">
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
								{isSubmitting ? "Creating account…" : "Create account"}
							</Button>
						</div>
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
	const [usePassword, setUsePassword] = useState(false);

	return (
		<div className="flex min-h-dvh items-center justify-center">
			<Card className="w-full max-w-sm rounded-4xl px-6 py-10 pt-14">
				<CardContent>
					<div className="flex flex-col items-center space-y-8">
						<Logo />

						<div className="space-y-2 text-center">
							<h1 className="text-balance font-semibold text-3xl text-foreground">
								Create an account
							</h1>
							<p className="text-pretty text-muted-foreground text-sm">
								Already have one?{" "}
								<Link className="text-foreground hover:underline" to="/login">
									Sign in
								</Link>
							</p>
						</div>

						<div className="w-full space-y-4">
							<Button
								className="w-full gap-2 rounded-xl"
								onClick={() =>
									authClient.signIn.social({
										provider: "google",
										callbackURL: callbackURL ?? "/dashboard	",
									})
								}
								size="lg"
								type="button"
								variant="outline"
							>
								<GoogleIcon />
								Continue with Google
							</Button>

							<div className="flex items-center gap-4 py-2">
								<Separator className="flex-1" />
								<span className="text-muted-foreground text-sm">OR</span>
								<Separator className="flex-1" />
							</div>

							{/* Swap form — each mode has its own isolated form instance */}
							{usePassword ? (
								<PasswordRegisterForm
									callbackURL={callbackURL ?? "/dashboard"}
								/>
							) : (
								<MagicLinkRegisterForm
									callbackURL={callbackURL ?? "/dashboard"}
								/>
							)}

							<Button
								className="w-full text-muted-foreground text-sm"
								onClick={() => setUsePassword((v) => !v)}
								type="button"
								variant="link"
							>
								{usePassword
									? "Sign up using magic link"
									: "Sign up using password"}
							</Button>
						</div>

						<p className="w-11/12 text-pretty text-center text-muted-foreground text-xs">
							You acknowledge that you read, and agree, to our{" "}
							<Link className="underline hover:text-foreground" to="/">
								Terms of Service
							</Link>{" "}
							and our{" "}
							<Link className="underline hover:text-foreground" to="/">
								Privacy Policy
							</Link>
							.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
