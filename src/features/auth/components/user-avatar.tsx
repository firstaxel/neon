interface UserAvatarProps {
	image?: string | null;
	name: string;
	/** Show a small green online dot */
	online?: boolean;
	size?: number;
}

function initials(name: string) {
	const parts = name.trim().split(" ");
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return (parts[0][0] + parts.at(-1)?.[0]).toUpperCase();
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
			style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
		>
			{image ? (
				<img
					alt={name}
					height={size}
					src={image}
					style={{
						width: size,
						height: size,
						borderRadius: "50%",
						objectFit: "cover",
						display: "block",
					}}
					width={size}
				/>
			) : (
				<div
					style={{
						width: size,
						height: size,
						borderRadius: "50%",
						background: bg,
						border: `1px solid ${fg}40`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<span
						style={{
							fontFamily: "'Space Grotesk', sans-serif",
							fontWeight: 700,
							fontSize,
							color: fg,
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
						position: "absolute",
						bottom: 1,
						right: 1,
						width: Math.max(8, size * 0.24),
						height: Math.max(8, size * 0.24),
						borderRadius: "50%",
						background: "#25d366",
						border: "2px solid #080c14",
					}}
				/>
			)}
		</div>
	);
}
