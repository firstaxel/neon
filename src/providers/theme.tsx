import { ScriptOnce } from "@tanstack/react-router";
import { createClientOnlyFn, createIsomorphicFn } from "@tanstack/react-start";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { z } from "zod";

const UserThemeSchema = z.enum(["light", "dark", "system"]).catch("system");
const AppThemeSchema = z.enum(["light", "dark"]).catch("dark");

export type UserTheme = z.infer<typeof UserThemeSchema>;
export type AppTheme = z.infer<typeof AppThemeSchema>;

const themeStorageKey = "ui-theme";
const UI_THEME_COOKIE_REGEX = /(?:^|;\s*)ui-theme=([^;]*)/;

const getStoredUserTheme = createIsomorphicFn()
	.server((): UserTheme => "system")
	.client((): UserTheme => {
		const stored = localStorage.getItem(themeStorageKey);
		if (stored) {
			return UserThemeSchema.parse(stored);
		}
		const match = document.cookie.match(UI_THEME_COOKIE_REGEX);
		const cookieValue = match ? decodeURIComponent(match[1]) : "system";
		return UserThemeSchema.parse(cookieValue);
	});

const setStoredTheme = createClientOnlyFn((theme: UserTheme) => {
	const validatedTheme = UserThemeSchema.parse(theme);
	localStorage.setItem(themeStorageKey, validatedTheme);
	// biome-ignore lint/suspicious/noDocumentCookie: client cookie persistence for zero flash SSR theme
	document.cookie = `${themeStorageKey}=${encodeURIComponent(validatedTheme)}; path=/; max-age=31536000; SameSite=Lax`;
});

const getSystemTheme = createIsomorphicFn()
	.server((): AppTheme => "light")
	.client(
		(): AppTheme =>
			window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
	);

const handleThemeChange = createClientOnlyFn((userTheme: UserTheme) => {
	const validatedTheme = UserThemeSchema.parse(userTheme);

	const root = document.documentElement;
	root.classList.remove("light", "dark", "system");

	if (validatedTheme === "system") {
		const systemTheme = getSystemTheme();
		root.classList.add(systemTheme, "system");
	} else {
		root.classList.add(validatedTheme);
	}
});

const setupPreferredListener = createClientOnlyFn(() => {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handler = () => handleThemeChange("system");
	mediaQuery.addEventListener("change", handler);
	return () => mediaQuery.removeEventListener("change", handler);
});

export const themeScript = (() => {
	function themeFn() {
		try {
			let stored = localStorage.getItem("ui-theme");
			if (!stored) {
				// biome-ignore lint/performance/useTopLevelRegex: self-contained serialized script function
				const match = document.cookie.match(/(?:^|;\s*)ui-theme=([^;]*)/);
				stored = match ? decodeURIComponent(match[1]) : "system";
			}
			const valid = ["light", "dark", "system"].includes(stored)
				? stored
				: "system";
			const isDark =
				valid === "dark" ||
				(valid === "system" &&
					window.matchMedia("(prefers-color-scheme: dark)").matches);
			const root = document.documentElement;
			root.classList.remove("light", "dark", "system");
			if (isDark) {
				root.classList.add("dark");
			} else {
				root.classList.add("light");
			}
			if (valid === "system") {
				root.classList.add("system");
			}
		} catch {
			const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			document.documentElement.classList.add(
				isDark ? "dark" : "light",
				"system"
			);
		}
	}
	return `(${themeFn.toString()})();`;
})();

interface ThemeContextProps {
	appTheme: AppTheme;
	setTheme: (theme: UserTheme) => void;
	userTheme: UserTheme;
}
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

interface ThemeProviderProps {
	children: ReactNode;
}
export function ThemeProvider({ children }: ThemeProviderProps) {
	const [userTheme, setUserTheme] = useState<UserTheme>(getStoredUserTheme);

	useEffect(() => {
		if (userTheme !== "system") {
			return;
		}
		return setupPreferredListener();
	}, [userTheme]);

	const appTheme = userTheme === "system" ? getSystemTheme() : userTheme;

	const setTheme = (newUserTheme: UserTheme) => {
		const validatedTheme = UserThemeSchema.parse(newUserTheme);
		setUserTheme(validatedTheme);
		setStoredTheme(validatedTheme);
		handleThemeChange(validatedTheme);
	};

	return (
		<ThemeContext value={{ appTheme, setTheme, userTheme }}>
			<ScriptOnce>{themeScript}</ScriptOnce>

			{children}
		</ThemeContext>
	);
}

export const useTheme = () => {
	const context = use(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};
