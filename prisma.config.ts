import { defineConfig, env } from "prisma/config";
import "dotenv/config";

export default defineConfig({
	datasource: {
		url: import.meta.env.PROD ? env("PROD_DATABASE_URL") : env("DATABASE_URL"),
	},
	migrations: {
		path: "./prisma/migrations",

		seed: "tsx prisma/seed.ts",
	},
	schema: "./prisma/schema.prisma",
});
