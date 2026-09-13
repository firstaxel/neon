import { Link } from "@tanstack/react-router";

export function AuthBrand({
	subtitle = "Church & NGO Messaging Console",
}: {
	subtitle?: string;
}) {
	return (
		<Link
			className="group flex flex-col items-center gap-3 rounded-2xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			to="/"
		>
			<div className="flex size-12 items-center justify-center rounded-2xl bg-[#25d366] text-white shadow-[#25d366]/20 shadow-md transition-transform group-hover:scale-105">
				<svg
					className="size-6"
					fill="none"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Velocast</title>
					<path
						d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.03-1.3A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
						fill="white"
					/>
					<path
						d="M8 11h8M8 14.5h5"
						stroke="rgba(37,211,102,0.85)"
						strokeLinecap="round"
						strokeWidth="1.7"
					/>
				</svg>
			</div>
			<div>
				<span className="font-bold text-2xl text-foreground tracking-tight">
					Velocast
				</span>
				{subtitle && (
					<p className="mt-0.5 font-medium text-muted-foreground text-xs">
						{subtitle}
					</p>
				)}
			</div>
		</Link>
	);
}
