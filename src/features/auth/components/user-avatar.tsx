import { cn } from "#/lib/utils";

interface UserAvatarProps {
	image?: string | null;
	name: string;
	/** Show a small green online dot */
	online?: boolean;
	size?: number;
}

function initials(name: string) {
	if (!(name && name.trim())) {
		return "VC";
	}
	const parts = name.trim().split(" ");
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return (parts[0][0] + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

/** Deterministic colour from name — cycles through a set of accents */
function avatarColor(name: string): {
	bgClass: string;
	fgClass: string;
	borderClass: string;
} {
	const PALETTES = [
		{
			bgClass: "bg-emerald-500/15 dark:bg-emerald-950/60",
			borderClass: "border-emerald-500/30 dark:border-emerald-500/40",
			fgClass: "text-emerald-700 dark:text-emerald-400",
		},
		{
			bgClass: "bg-blue-500/15 dark:bg-blue-950/60",
			borderClass: "border-blue-500/30 dark:border-blue-500/40",
			fgClass: "text-blue-700 dark:text-blue-400",
		},
		{
			bgClass: "bg-purple-500/15 dark:bg-purple-950/60",
			borderClass: "border-purple-500/30 dark:border-purple-500/40",
			fgClass: "text-purple-700 dark:text-purple-400",
		},
		{
			bgClass: "bg-amber-500/15 dark:bg-amber-950/60",
			borderClass: "border-amber-500/30 dark:border-amber-500/40",
			fgClass: "text-amber-700 dark:text-amber-400",
		},
		{
			bgClass: "bg-pink-500/15 dark:bg-pink-950/60",
			borderClass: "border-pink-500/30 dark:border-pink-500/40",
			fgClass: "text-pink-700 dark:text-pink-400",
		},
		{
			bgClass: "bg-teal-500/15 dark:bg-teal-950/60",
			borderClass: "border-teal-500/30 dark:border-teal-500/40",
			fgClass: "text-teal-700 dark:text-teal-400",
		},
	];
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		// biome-ignore lint/suspicious/noBitwiseOperators: <need for the avatar palette>
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function UserAvatar({
	name,
	image,
	size = 36,
	online,
}: UserAvatarProps) {
	const { bgClass, fgClass, borderClass } = avatarColor(name);
	const fontSize = Math.round(size * 0.36);

	return (
		<div aria-label={name} className="relative inline-flex shrink-0" role="img">
			{image ? (
				<img
					alt={name}
					className="block rounded-full object-cover"
					height={size}
					src={image}
					style={{ height: size, width: size }}
					width={size}
				/>
			) : (
				<div
					className={cn(
						"flex shrink-0 items-center justify-center rounded-full border",
						bgClass,
						borderClass
					)}
					style={{
						height: size,
						width: size,
					}}
				>
					<span
						className={cn("select-none font-bold leading-none", fgClass)}
						style={{
							fontSize,
						}}
					>
						{initials(name)}
					</span>
				</div>
			)}

			{online && (
				<span
					className="absolute right-0.5 bottom-0.5 rounded-full border-2 border-background bg-emerald-500"
					style={{
						height: Math.max(8, size * 0.24),
						width: Math.max(8, size * 0.24),
					}}
				/>
			)}
		</div>
	);
}
