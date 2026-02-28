"use client";

import { GlobeIcon } from "lucide-react";

import { motion } from "motion/react";
import React from "react";
import { ModeToggle } from "./mode-toggle";
import { AnimatedTabs } from "./tabs";

export default function AnimatedHeader() {
	const [scrollY, setScrollY] = React.useState(0);

	React.useEffect(() => {
		const handleScroll = () => {
			setScrollY(window.scrollY);
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const tabs = [
		{ label: "Home", value: "home", href: "/dashboard" },
		{ label: "Campaigns", value: "campaigns", href: "/campaigns" },
		{ label: "Contacts", value: "contacts", href: "/contacts" },
		{ label: "Messages", value: "messages", href: "/messages" },
	];

	return (
		<nav className="w-full">
			{/* Header with logo and GitHub button */}
			<header className="relative w-full bg-background">
				<motion.div
					animate={{
						scale: Math.max(0.8, 1 - scrollY * 0.006),
					}}
					className="fixed top-0 left-0 z-50 pt-5 pl-5"
					transition={{
						duration: 0.1,
						ease: "linear",
					}}
				>
					<GlobeIcon className="size-5" />
				</motion.div>

				<div className="flex items-center justify-between px-5 pt-3 pb-0 pl-14 font-mono">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">/</span>
						<p>Dashboard</p>
					</div>
					<div className="flex items-center justify-end gap-2">
						<ModeToggle />
					</div>
				</div>
			</header>

			{/* Sticky Navigation with animated tabs */}
			<div className="sticky top-0 overflow-x-hidden border-border border-b bg-background">
				<div className="flex items-center justify-center">
					<motion.div
						animate={{
							x: Math.min(scrollY * 0.5, 40), // Move 0.5px right per 1px scroll, max 40px
						}}
						className="flex flex-1 justify-center"
						transition={{
							duration: 0.05,
							ease: "linear",
						}}
					>
						<AnimatedTabs tabs={tabs} />
					</motion.div>
				</div>
			</div>
		</nav>
	);
}
