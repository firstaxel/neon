/**
 * OnboardingWizard
 *
 * Exact same pattern as CampaignWizard:
 *   - useForm from @tanstack/react-form
 *   - form.Field for each controlled input
 *   - form.Subscribe selector={(s) => s.values} in the footer for reactive canProceed
 *   - Single Card with Separator + CardFooter
 *   - onComplete() callback prop — no routing inside this component
 *
 * Steps:
 *   0  Welcome        — greeting, what to expect
 *   1  Organisation   — orgType, orgName, orgSize, role, phone
 *   2  Top Up Wallet  — fund account before first campaign
 *   3  All Set        — confirm and finish
 */

import { useForm } from "@tanstack/react-form";
import {
	Building2,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Loader2,
	MessageSquare,
	Rocket,
	Send,
	Users,
	Wallet,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { useInitDeposit } from "#/features/billing/hooks/use-billing";
import {
	getOrgSizeLabel,
	getRoleMeta,
	ORG_TYPE_LABELS,
	type OrgType,
	type UserRole,
} from "#/features/miscellaneous/org";
import { useCompleteOnboarding } from "../hooks/use-profile";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgSize = "1-50" | "51-200" | "201-500" | "500+";

interface WizardValues {
	name: string;
	orgName: string;
	orgSize: OrgSize;
	orgType: OrgType;
	phone: string;
	role: UserRole;
	topUpAmount: number;
}

// ─── Step meta ────────────────────────────────────────────────────────────────

const STEPS = [
	{ label: "Welcome", icon: MessageSquare },
	{ label: "Organisation", icon: Building2 },
	{ label: "Wallet", icon: Wallet },
	{ label: "All Set", icon: Rocket },
] as const;

// ─── Step indicator — matches CampaignWizard's StepIndicator exactly ─────────

function StepIndicator({ current }: { current: number }) {
	return (
		<div className="flex items-center gap-1.5">
			{STEPS.map((step, i) => {
				const Icon = step.icon;
				const done = i < current;
				const active = i === current;
				return (
					<div className="flex items-center gap-1.5" key={step.label}>
						<div
							className={[
								"flex h-7 w-7 items-center justify-center rounded-full font-semibold text-xs transition-colors",
								done
									? "bg-primary text-primary-foreground"
									: active
										? "bg-primary/15 text-primary ring-1 ring-primary/40"
										: "bg-muted text-muted-foreground",
							].join(" ")}
						>
							{done ? (
								<CheckCircle2 className="h-3.5 w-3.5" />
							) : (
								<Icon className="h-3.5 w-3.5" />
							)}
						</div>
						<span
							className={`hidden font-medium text-xs sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}
						>
							{step.label}
						</span>
						{i < STEPS.length - 1 && (
							<div
								className={`h-px w-6 ${i < current ? "bg-primary" : "bg-border"}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ─── Tile — org type / role / size selector ───────────────────────────────────

function Tile<T extends string>({
	value,
	current,
	onClick,
	icon,
	label,
	sub,
}: {
	value: T;
	current: T;
	onClick: (v: T) => void;
	icon: string;
	label: string;
	sub?: string;
}) {
	const active = value === current;
	return (
		<button
			className={[
				"flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
				active
					? "border-primary bg-primary/5 ring-2 ring-primary/20"
					: "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
			].join(" ")}
			onClick={() => onClick(value)}
			type="button"
		>
			<span className="shrink-0 text-lg leading-none">{icon}</span>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm leading-tight">{label}</p>
				{sub && <p className="mt-0.5 text-muted-foreground text-xs">{sub}</p>}
			</div>
			{active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
		</button>
	);
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ name }: { name: string }) {
	const first = name.split(" ")[0];
	return (
		<div className="flex flex-col items-center gap-5 py-2 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
				<MessageSquare className="h-8 w-8 text-primary" />
			</div>

			<div className="space-y-2">
				<h2 className="font-semibold text-xl">
					{first ? `Welcome, ${first}! 👋` : "Welcome to Melow! 👋"}
				</h2>
				<p className="mx-auto max-w-sm text-muted-foreground text-sm leading-relaxed">
					Set up your account in a few steps and start reaching your contacts
					via WhatsApp and SMS.
				</p>
			</div>

			<div className="w-full max-w-xs space-y-2 text-left">
				{[
					{
						icon: <Building2 className="h-3.5 w-3.5" />,
						text: "Tell us about your organisation",
					},
					{
						icon: <Wallet className="h-3.5 w-3.5" />,
						text: "Add funds to send messages",
					},
					{
						icon: <Send className="h-3.5 w-3.5" />,
						text: "Launch your first campaign",
					},
				].map(({ icon, text }, i) => (
					<div
						className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2"
						key={i.toString()}
					>
						<span className="text-primary">{icon}</span>
						<span className="text-sm">{text}</span>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Step 1: Organisation ─────────────────────────────────────────────────────

function OrgStep({
	values,
	setField,
}: {
	values: WizardValues;
	setField: <K extends keyof WizardValues>(k: K, v: WizardValues[K]) => void;
}) {
	const roleMeta = getRoleMeta(values.orgType);
	const sizeMeta = getOrgSizeLabel(values.orgType);
	const orgTypes = Object.entries(ORG_TYPE_LABELS) as [
		OrgType,
		(typeof ORG_TYPE_LABELS)[OrgType],
	][];
	const roleKeys = Object.keys(roleMeta) as UserRole[];

	return (
		<div className="space-y-5">
			{/* Org type */}
			<div className="space-y-2">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Organisation type
				</p>
				<div className="grid grid-cols-2 gap-2">
					{orgTypes.map(([type, meta]) => (
						<Tile
							current={values.orgType}
							icon={meta.icon}
							key={type}
							label={meta.label}
							onClick={(v) => setField("orgType", v)}
							sub={meta.sub}
							value={type}
						/>
					))}
				</div>
			</div>

			{/* Name + phone */}
			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label className="font-medium text-muted-foreground text-xs">
						Your name
					</Label>
					<Input
						className="w-full rounded-xl border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
						onChange={(e) => setField("name", e.target.value)}
						placeholder="Your full name"
						value={values.name}
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="font-medium text-muted-foreground text-xs">
						Phone number
					</Label>
					<Input
						className="w-full rounded-xl border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
						onChange={(e) => setField("phone", e.target.value)}
						placeholder="+234 800 000 0000"
						value={values.phone}
					/>
				</div>
				<div className="col-span-2 space-y-1.5">
					<Label className="font-medium text-muted-foreground text-xs">
						Organisation name
					</Label>
					<Input
						className="w-full rounded-xl border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
						onChange={(e) => setField("orgName", e.target.value)}
						placeholder="Grace Assembly, Red Cross Lagos, ABC Academy…"
						value={values.orgName}
					/>
				</div>
			</div>

			{/* Role */}
			<div className="space-y-2">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Your role
				</p>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{roleKeys.map((r) => (
						<Tile
							current={values.role}
							icon={roleMeta[r].icon}
							key={r}
							label={roleMeta[r].label}
							onClick={(v) => setField("role", v)}
							value={r}
						/>
					))}
				</div>
			</div>

			{/* Org size */}
			<div className="space-y-2">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Organisation size
				</p>
				<div className="grid grid-cols-2 gap-2">
					{sizeMeta.map((s) => (
						<Tile
							current={values.orgSize}
							icon={s.icon}
							key={s.value}
							label={s.label}
							onClick={(v) => setField("orgSize", v)}
							value={s.value as OrgSize}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Step 2: Top Up Wallet ────────────────────────────────────────────────────

function WalletStep({
	values,
	setField,
}: {
	values: WizardValues;
	setField: <K extends keyof WizardValues>(k: K, v: WizardValues[K]) => void;
}) {
	const PRESETS = [2000, 5000, 10_000, 25_000];
	const whatsappCount = Math.floor((values.topUpAmount * 100) / 500);
	const smsCount = Math.floor((values.topUpAmount * 100) / 250);

	return (
		<div className="space-y-5">
			<p className="text-muted-foreground text-sm leading-relaxed">
				Add credits so you can send messages right away. You're charged per
				message — ₦5 per WhatsApp, ₦2.50 per SMS. Top up anytime from the
				Billing page.
			</p>

			{/* Rate cards */}
			<div className="grid grid-cols-2 gap-3">
				{[
					{
						label: "WhatsApp",
						rate: "₦5.00 / msg",
						badge: "border-[#25d36640] bg-[#0d2016] text-[#25d366]",
					},
					{
						label: "SMS",
						rate: "₦2.50 / msg",
						badge: "border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa]",
					},
				].map(({ label, rate, badge }) => (
					<div className={`rounded-xl border px-4 py-3 ${badge}`} key={label}>
						<p className="font-bold text-[10px] uppercase tracking-widest opacity-70">
							{label}
						</p>
						<p className="mt-1 font-semibold text-lg">{rate}</p>
					</div>
				))}
			</div>

			{/* Presets */}
			<div className="space-y-2">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Select amount
				</p>
				<div className="grid grid-cols-4 gap-2">
					{PRESETS.map((p) => (
						<button
							className={[
								"rounded-xl border py-2.5 font-semibold text-sm transition-all",
								values.topUpAmount === p
									? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
									: "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30",
							].join(" ")}
							key={p}
							onClick={() => setField("topUpAmount", p)}
							type="button"
						>
							₦{p.toLocaleString()}
						</button>
					))}
				</div>

				{values.topUpAmount > 0 && (
					<p className="text-muted-foreground text-xs">
						Covers ~{whatsappCount.toLocaleString()} WhatsApp or ~
						{smsCount.toLocaleString()} SMS messages
					</p>
				)}
			</div>
		</div>
	);
}

// ─── Step 3: All Set ──────────────────────────────────────────────────────────

function AllSetStep({ orgName }: { orgName: string }) {
	return (
		<div className="flex flex-col items-center gap-5 py-2 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/30">
				<Rocket className="h-8 w-8 text-emerald-500" />
			</div>

			<div className="space-y-2">
				<h2 className="font-semibold text-xl">You're all set! 🚀</h2>
				<p className="mx-auto max-w-sm text-muted-foreground text-sm leading-relaxed">
					{orgName
						? `${orgName} is ready to go. Upload a contact list and send your first campaign.`
						: "Your account is ready. Upload a contact list and send your first campaign."}
				</p>
			</div>

			<div className="w-full max-w-xs space-y-2 text-left">
				{[
					{
						icon: <Users className="h-3.5 w-3.5" />,
						text: "Upload a contact list image",
					},
					{
						icon: <MessageSquare className="h-3.5 w-3.5" />,
						text: "Create your first campaign",
					},
					{
						icon: <CheckCircle2 className="h-3.5 w-3.5" />,
						text: "Watch messages deliver live",
					},
				].map(({ icon, text }, i) => (
					<div
						className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2"
						key={i.toString()}
					>
						<span className="text-emerald-500">{icon}</span>
						<span className="text-sm">{text}</span>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── OnboardingWizard ─────────────────────────────────────────────────────────

interface OnboardingWizardProps {
	/** Pre-populated from the session — avoid a separate profile fetch */
	initialName?: string;
	/** Called when the user clicks "Go to dashboard" on the final step */
	onComplete: () => void;
}

export function OnboardingWizard({
	initialName = "",
	onComplete,
}: OnboardingWizardProps) {
	const [step, setStep] = useState(0);

	const { mutateAsync: completeStep, isPending: saving } =
		useCompleteOnboarding();
	const { mutateAsync: initDeposit, isPending: paying } = useInitDeposit();
	const isPending = saving || paying;

	const form = useForm({
		defaultValues: {
			name: initialName,
			orgType: "church",
			orgName: "",
			orgSize: "1-50",
			role: "staff",
			phone: "",
			topUpAmount: 5000,
		} as WizardValues,
		onSubmit: async ({ value }) => {
			await completeStep({
				step: 4,
				complete: true,
				name: value.name,
				orgType: value.orgType,
				orgName: value.orgName,
				orgSize: value.orgSize,
				role: value.role,
				phone: value.phone,
			});
			onComplete();
		},
	});

	// Save org data and advance to wallet step
	async function handleOrgNext() {
		const v = form.state.values;
		await completeStep({
			step: 2,
			name: v.name,
			orgType: v.orgType,
			orgName: v.orgName,
			orgSize: v.orgSize,
			role: v.role,
			phone: v.phone,
		});
		setStep(2);
	}

	// Redirect to Paystack and come back to step 3
	async function handleTopUp() {
		const v = form.state.values;
		const callbackUrl =
			typeof window !== "undefined"
				? `${window.location.origin}/billing/verify?return=/onboarding`
				: "/billing/verify?return=/onboarding";
		const result = await initDeposit({
			amountNaira: v.topUpAmount,
			callbackUrl,
		});
		window.location.href = result.checkoutUrl;
	}

	return (
		<Card className="mx-auto w-full max-w-2xl rounded-2xl">
			{/* Header — mirrors CampaignWizard's CardHeader */}
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">{STEPS[step].label}</CardTitle>
					<StepIndicator current={step} />
				</div>
			</CardHeader>

			<Separator />

			{/* Step content — form.Field / form.Subscribe exactly like CampaignWizard */}
			<CardContent className="pt-5">
				{/* Step 0 — Welcome */}
				{step === 0 && (
					<form.Field name="name">
						{(field) => <WelcomeStep name={field.state.value} />}
					</form.Field>
				)}

				{/* Step 1 — Organisation (uses Subscribe for full values) */}
				{step === 1 && (
					<form.Subscribe selector={(s) => s.values}>
						{(values) => (
							<OrgStep
								setField={(k, v) => form.setFieldValue(k, v as never)}
								values={values}
							/>
						)}
					</form.Subscribe>
				)}

				{/* Step 2 — Wallet (uses Subscribe for topUpAmount) */}
				{step === 2 && (
					<form.Subscribe selector={(s) => s.values}>
						{(values) => (
							<WalletStep
								setField={(k, v) => form.setFieldValue(k, v as never)}
								values={values}
							/>
						)}
					</form.Subscribe>
				)}

				{/* Step 3 — All Set */}
				{step === 3 && (
					<form.Field name="orgName">
						{(field) => <AllSetStep orgName={field.state.value} />}
					</form.Field>
				)}
			</CardContent>

			<Separator />

			{/* Footer — form.Subscribe for reactive canProceed, mirrors CampaignWizard footer exactly */}
			<form.Subscribe selector={(s) => s.values}>
				{(values) => {
					const canProceed =
						step === 0
							? true
							: step === 1
								? values.name.trim().length > 0 &&
									values.orgName.trim().length > 0
								: step === 2
									? values.topUpAmount >= 100
									: true;

					return (
						<CardFooter className="flex flex-col gap-3 pt-4">
							<div className="flex w-full justify-between gap-3">
								{/* Back */}
								<Button
									className="gap-1 rounded-xl"
									disabled={step === 0 || isPending}
									onClick={() => setStep((s) => s - 1)}
									variant="outline"
								>
									<ChevronLeft className="h-4 w-4" /> Back
								</Button>

								{/* Step 0 → 1 */}
								{step === 0 && (
									<Button
										className="gap-1 rounded-xl"
										onClick={() => setStep(1)}
									>
										Get started <ChevronRight className="h-4 w-4" />
									</Button>
								)}

								{/* Step 1 → 2: save org then advance */}
								{step === 1 && (
									<Button
										className="gap-1 rounded-xl"
										disabled={!canProceed || isPending}
										onClick={handleOrgNext}
									>
										{isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" /> Saving…
											</>
										) : (
											<>
												Continue <ChevronRight className="h-4 w-4" />
											</>
										)}
									</Button>
								)}

								{/* Step 2: top up (primary) + skip (secondary, rendered below) */}
								{step === 2 && (
									<Button
										className="flex-1 gap-2 rounded-xl"
										disabled={isPending}
										onClick={handleTopUp}
									>
										{isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />{" "}
												Redirecting…
											</>
										) : (
											<>
												<ExternalLink className="h-4 w-4" /> Top up ₦
												{values.topUpAmount.toLocaleString()} via Paystack
											</>
										)}
									</Button>
								)}

								{/* Step 3: submit → onComplete */}
								{step === 3 && (
									<Button
										className="gap-2 rounded-xl"
										disabled={isPending}
										onClick={() => form.handleSubmit()}
									>
										{isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" /> One moment…
											</>
										) : (
											<>
												Go to dashboard <Rocket className="h-4 w-4" />
											</>
										)}
									</Button>
								)}
							</div>

							{/* Wallet step skip link */}
							{step === 2 && (
								<button
									className="text-muted-foreground text-xs transition-colors hover:text-foreground"
									onClick={() => setStep(3)}
									type="button"
								>
									Skip for now — I'll top up from the Billing page
								</button>
							)}
						</CardFooter>
					);
				}}
			</form.Subscribe>
		</Card>
	);
}
