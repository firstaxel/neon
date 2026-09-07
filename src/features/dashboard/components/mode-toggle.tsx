import { Moon, Sun } from "lucide-react";
import React from "react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useTheme } from "#/providers/theme";

export function ModeToggle() {
	const { setTheme, userTheme } = useTheme();

	const handleSetLight = React.useCallback(() => {
		setTheme("light");
	}, [setTheme]);

	const handleSetDark = React.useCallback(() => {
		setTheme("dark");
	}, [setTheme]);

	const handleSetSystem = React.useCallback(() => {
		setTheme("system");
	}, [setTheme]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button aria-label="Toggle theme" size="icon" variant="outline">
						<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
						<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
						<span className="sr-only">Toggle theme</span>
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-32">
				<DropdownMenuItem
					className="flex items-center justify-between"
					onClick={handleSetLight}
				>
					Light
					{userTheme === "light" && (
						<span className="h-1.5 w-1.5 rounded-full bg-primary" />
					)}
				</DropdownMenuItem>
				<DropdownMenuItem
					className="flex items-center justify-between"
					onClick={handleSetDark}
				>
					Dark
					{userTheme === "dark" && (
						<span className="h-1.5 w-1.5 rounded-full bg-primary" />
					)}
				</DropdownMenuItem>
				<DropdownMenuItem
					className="flex items-center justify-between"
					onClick={handleSetSystem}
				>
					System
					{userTheme === "system" && (
						<span className="h-1.5 w-1.5 rounded-full bg-primary" />
					)}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
