import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "./prisma/schema.prisma",
	migrations: {
		path: "./prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: import.meta.env.PROD ? env("PROD_DATABASE_URL") : env("DATABASE_URL"),
	},
});
