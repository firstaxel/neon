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
function avatarColor(name: string): { bg: string; fg: string } {
	const PALETTES = [
		{ bg: "#0d2016", fg: "#25d366" }, // green
		{ bg: "#0d1a2e", fg: "#60a5fa" }, // blue
		{ bg: "#1a0d2e", fg: "#a78bfa" }, // purple
		{ bg: "#1a1200", fg: "#f59e0b" }, // amber
		{ bg: "#2e0d1a", fg: "#f472b6" }, // pink
		{ bg: "#0d1a1a", fg: "#2dd4bf" }, // teal
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
	const { bg, fg } = avatarColor(name);
	const fontSize = Math.round(size * 0.36);

	return (
		<div
			aria-label={name}
			role="img"
			style={{ display: "inline-flex", flexShrink: 0, position: "relative" }}
		>
			{image ? (
				<img
					alt={name}
					height={size}
					src={image}
					style={{
						borderRadius: "50%",
						display: "block",
						height: size,
						objectFit: "cover",
						width: size,
					}}
					width={size}
				/>
			) : (
				<div
					style={{
						alignItems: "center",
						background: bg,
						border: `1px solid ${fg}40`,
						borderRadius: "50%",
						display: "flex",
						flexShrink: 0,
						height: size,
						justifyContent: "center",
						width: size,
					}}
				>
					<span
						style={{
							color: fg,
							fontFamily: "var(--font-sans, inherit)",
							fontSize,
							fontWeight: 700,
							lineHeight: 1,
							userSelect: "none",
						}}
					>
						{initials(name)}
					</span>
				</div>
			)}

			{online && (
				<span
					style={{
						background: "#25d366",
						border: "2px solid var(--card, #18181b)",
						borderRadius: "50%",
						bottom: 1,
						height: Math.max(8, size * 0.24),
						position: "absolute",
						right: 1,
						width: Math.max(8, size * 0.24),
					}}
				/>
			)}
		</div>
	);
}
