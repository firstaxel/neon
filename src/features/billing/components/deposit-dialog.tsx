import {
	AlertCircle,
	Banknote,
	CheckCircle2,
	ExternalLink,
	HelpCircle,
	Loader2,
	MessageSquare,
	ShieldCheck,
	Smartphone,
} from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { useInitDeposit } from "#/features/billing/hooks/use-billing";
import { formatNaira, PRICING } from "#/features/billing/utils/format";
import { calculatePaystackFee } from "#/features/payment/paystack/fee";
import { cn } from "#/lib/utils";

export interface DepositDialogProps {
	defaultAmount?: number;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

const PRESET_AMOUNTS = [1000, 5000, 10_000, 25_000, 50_000, 100_000] as const;
const MIN_DEPOSIT_NAIRA = 500;
const MAX_DEPOSIT_NAIRA = 5_000_000;

function isPresetAmount(
	amount?: number
): amount is (typeof PRESET_AMOUNTS)[number] {
	return (
		typeof amount === "number" &&
		PRESET_AMOUNTS.includes(amount as (typeof PRESET_AMOUNTS)[number])
	);
}

function resolveInitialDeposit(defaultAmount?: number) {
	const isPreset = isPresetAmount(defaultAmount);
	return {
		custom: defaultAmount && !isPreset ? String(defaultAmount) : "",
		isCustom: Boolean(defaultAmount && !isPreset),
		preset: isPreset ? defaultAmount : 10_000,
	};
}

interface PresetButtonProps {
	active: boolean;
	onSelect: (preset: number) => void;
	preset: number;
}

const PresetButton = memo(function PresetButtonComponent({
	preset,
	active,
	onSelect,
}: PresetButtonProps) {
	const handleClick = useCallback(() => {
		onSelect(preset);
	}, [onSelect, preset]);

	return (
		<button
			className={cn(
				"flex flex-col items-center justify-center rounded-2xl border px-2 py-3.5 transition-all",
				active
					? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
					: "border-border/80 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
			)}
			onClick={handleClick}
			type="button"
		>
			<span className="font-bold font-mono text-sm">
				₦{preset.toLocaleString()}
			</span>
		</button>
	);
});

interface ModeSelectorProps {
	isCustomMode: boolean;
	onSelectCustom: () => void;
	onSelectPresets: () => void;
}

const ModeSelector = memo(function ModeSelectorComponent({
	isCustomMode,
	onSelectPresets,
	onSelectCustom,
}: ModeSelectorProps) {
	return (
		<div className="flex rounded-2xl bg-muted/60 p-1">
			<button
				className={cn(
					"flex-1 rounded-xl py-2 font-medium text-xs transition-all",
					isCustomMode
						? "text-muted-foreground hover:text-foreground"
						: "bg-background text-foreground shadow-xs"
				)}
				onClick={onSelectPresets}
				type="button"
			>
				Quick Presets
			</button>
			<button
				className={cn(
					"flex-1 rounded-xl py-2 font-medium text-xs transition-all",
					isCustomMode
						? "bg-background text-foreground shadow-xs"
						: "text-muted-foreground hover:text-foreground"
				)}
				onClick={onSelectCustom}
				type="button"
			>
				Custom Amount
			</button>
		</div>
	);
});

interface CustomInputSectionProps {
	amount: string;
	isValid: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CustomInputSection = memo(function CustomInputSectionComponent({
	amount,
	isValid,
	onChange,
}: CustomInputSectionProps) {
	const showError = Boolean(amount) && !isValid;

	return (
		<div className="space-y-2">
			<label
				className="font-medium text-muted-foreground text-xs"
				htmlFor="custom-deposit-input"
			>
				Deposit Amount (₦500 to ₦5,000,000)
			</label>
			<div className="relative">
				<span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-bold font-mono text-base text-muted-foreground">
					₦
				</span>
				<Input
					autoFocus
					className="h-12 rounded-2xl border-border bg-card/60 pl-9 font-bold font-mono text-base tracking-tight focus-visible:ring-primary"
					id="custom-deposit-input"
					max={MAX_DEPOSIT_NAIRA}
					min={MIN_DEPOSIT_NAIRA}
					onChange={onChange}
					placeholder="e.g. 15,000"
					step={100}
					type="number"
					value={amount}
				/>
			</div>
			{showError ? (
				<p className="flex items-center gap-1.5 text-[11px] text-destructive">
					<AlertCircle className="h-3 w-3" />
					Amount must be between ₦500 and ₦5,000,000
				</p>
			) : null}
		</div>
	);
});

interface FeeBreakdownCardProps {
	depositNaira: number;
	feeKobo: number;
	grossKobo: number;
}

const FeeBreakdownCard = memo(function FeeBreakdownCardComponent({
	depositNaira,
	feeKobo,
	grossKobo,
}: FeeBreakdownCardProps) {
	return (
		<div className="space-y-2.5 rounded-2xl border border-border/80 bg-muted/20 p-4">
			<div className="flex items-center justify-between text-xs">
				<span className="text-muted-foreground">Wallet Deposit</span>
				<span className="font-mono font-semibold text-foreground">
					₦{depositNaira.toLocaleString()}
				</span>
			</div>

			<div className="flex items-center justify-between text-xs">
				<span className="flex items-center gap-1 text-muted-foreground">
					<span>Paystack Processing Fee</span>
					<span
						className="cursor-help text-muted-foreground/60 hover:text-muted-foreground"
						title="1.5% gateway fee plus ₦100 for amounts over ₦2,500, capped at ₦2,000"
					>
						<HelpCircle className="h-3 w-3" />
					</span>
				</span>
				<span className="font-mono text-muted-foreground">
					+ {formatNaira(feeKobo)}
				</span>
			</div>

			<Separator className="bg-border/60" />

			<div className="flex items-center justify-between font-medium text-xs">
				<span className="font-semibold text-foreground">
					Total Checkout Charge
				</span>
				<span className="font-bold font-mono text-foreground text-sm">
					{formatNaira(grossKobo)}
				</span>
			</div>

			<div className="mt-1 rounded-xl bg-primary/10 px-3 py-2 text-[11px] text-primary">
				<span className="flex items-center gap-1.5 font-semibold">
					<CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
					100% of your ₦{depositNaira.toLocaleString()} deposit will be credited
					to your spendable wallet
				</span>
			</div>
		</div>
	);
});

interface CoverageEstimateCardsProps {
	smsEstimate: number;
	whatsappMarketingEstimate: number;
}

const CoverageEstimateCards = memo(function CoverageEstimateCardsComponent({
	whatsappMarketingEstimate,
	smsEstimate,
}: CoverageEstimateCardsProps) {
	return (
		<div className="grid grid-cols-2 gap-2.5">
			<div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
				<div className="flex items-center gap-1.5 font-medium text-[11px] text-primary">
					<MessageSquare className="h-3 w-3" />
					<span>WhatsApp Marketing</span>
				</div>
				<p className="mt-1.5 font-bold font-mono text-base text-foreground">
					~{whatsappMarketingEstimate.toLocaleString()}
				</p>
				<p className="text-[10px] text-muted-foreground">
					messages at ₦90.00 each
				</p>
			</div>

			<div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3">
				<div className="flex items-center gap-1.5 font-medium text-[11px] text-blue-400">
					<Smartphone className="h-3 w-3" />
					<span>SMS Broadcast</span>
				</div>
				<p className="mt-1.5 font-bold font-mono text-base text-foreground">
					~{smsEstimate.toLocaleString()}
				</p>
				<p className="text-[10px] text-muted-foreground">
					messages at ₦6.00 each
				</p>
			</div>
		</div>
	);
});

export function DepositDialog({
	open,
	onOpenChange,
	defaultAmount,
}: DepositDialogProps) {
	const initial = resolveInitialDeposit(defaultAmount);
	const [selectedPreset, setSelectedPreset] = useState<number | null>(
		initial.preset
	);
	const [customAmount, setCustomAmount] = useState<string>(initial.custom);
	const [isCustomMode, setIsCustomMode] = useState(initial.isCustom);

	const { mutateAsync: initDeposit, isPending, error } = useInitDeposit();

	useEffect(() => {
		if (defaultAmount) {
			const next = resolveInitialDeposit(defaultAmount);
			setSelectedPreset(next.preset);
			setIsCustomMode(next.isCustom);
			setCustomAmount(next.custom);
		}
	}, [defaultAmount]);

	const switchToPresets = useCallback(() => {
		setIsCustomMode(false);
	}, []);

	const switchToCustom = useCallback(() => {
		setIsCustomMode(true);
	}, []);

	const handleSelectPreset = useCallback((preset: number) => {
		setSelectedPreset(preset);
	}, []);

	const handleCustomChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setCustomAmount(e.target.value);
		},
		[]
	);

	const depositNaira = isCustomMode
		? Number.parseInt(customAmount, 10) || 0
		: (selectedPreset ?? 0);

	const isValidAmount =
		depositNaira >= MIN_DEPOSIT_NAIRA && depositNaira <= MAX_DEPOSIT_NAIRA;

	const netKobo = depositNaira * 100;
	const feeKobo = isValidAmount ? calculatePaystackFee(netKobo) : 0;
	const grossKobo = netKobo + feeKobo;

	const whatsappMarketingEstimate = isValidAmount
		? Math.floor(netKobo / PRICING.PER_MESSAGE.whatsapp_marketing)
		: 0;
	const smsEstimate = isValidAmount
		? Math.floor(netKobo / PRICING.PER_MESSAGE.sms)
		: 0;

	const handleInitiateDeposit = useCallback(async () => {
		if (!isValidAmount || isPending) {
			return;
		}

		try {
			const result = await initDeposit({
				amountNaira: depositNaira,
				callbackUrl: `${window.location.origin}/billing/verify`,
			});

			if (result.checkoutUrl) {
				window.location.href = result.checkoutUrl;
			}
		} catch {
			// Handled by mutation error state
		}
	}, [isValidAmount, isPending, initDeposit, depositNaira]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md gap-0 overflow-hidden rounded-3xl border-border p-0 shadow-2xl">
				<DialogHeader className="border-border border-b bg-muted/20 px-6 py-5">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
							<Banknote className="h-5 w-5" />
						</div>
						<div>
							<DialogTitle className="font-bold text-base tracking-tight">
								Top Up Messaging Wallet
							</DialogTitle>
							<DialogDescription className="mt-0.5 text-muted-foreground text-xs">
								Add spendable funds for WhatsApp and SMS broadcast campaigns
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-5 p-6">
					<ModeSelector
						isCustomMode={isCustomMode}
						onSelectCustom={switchToCustom}
						onSelectPresets={switchToPresets}
					/>

					{isCustomMode ? (
						<CustomInputSection
							amount={customAmount}
							isValid={isValidAmount}
							onChange={handleCustomChange}
						/>
					) : (
						<div className="grid grid-cols-3 gap-2.5">
							{PRESET_AMOUNTS.map((preset) => (
								<PresetButton
									active={selectedPreset === preset}
									key={preset}
									onSelect={handleSelectPreset}
									preset={preset}
								/>
							))}
						</div>
					)}

					{isValidAmount ? (
						<FeeBreakdownCard
							depositNaira={depositNaira}
							feeKobo={feeKobo}
							grossKobo={grossKobo}
						/>
					) : null}

					{isValidAmount ? (
						<CoverageEstimateCards
							smsEstimate={smsEstimate}
							whatsappMarketingEstimate={whatsappMarketingEstimate}
						/>
					) : null}

					{error ? (
						<div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>
								{error instanceof Error
									? error.message
									: "Could not initiate Paystack deposit. Please try again."}
							</span>
						</div>
					) : null}

					<Button
						className="h-12 w-full rounded-2xl font-bold text-sm tracking-wide"
						disabled={!isValidAmount || isPending}
						onClick={handleInitiateDeposit}
						size="lg"
					>
						{isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Connecting to Paystack...
							</>
						) : (
							<>
								<span>
									Proceed to Pay {isValidAmount ? formatNaira(grossKobo) : ""}
								</span>
								<ExternalLink className="ml-2 h-4 w-4" />
							</>
						)}
					</Button>

					<div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-muted-foreground">
						<ShieldCheck className="h-3.5 w-3.5 text-primary" />
						<span>Secured by Paystack. Cards, Bank Transfer, USSD</span>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
