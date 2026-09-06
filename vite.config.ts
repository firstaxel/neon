import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite"; // Import the nitro plugin
import { defineConfig } from "vite";

const config = defineConfig({
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
		nitro(),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		allowedHosts: ["logical-eagerly-humpback.ngrok-free.app"],
	},
});

export default config;
