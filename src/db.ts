import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.js";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaPg({
	connectionString: import.meta.env.PROD
		? env.PROD_DATABASE_URL
		: env.DATABASE_URL,
});

declare global {
	var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
	globalThis.__prisma = prisma;
}

// Re-export Prisma types for use across the app
export type {
	Campaign,
	Contact,
	ContactType,
	JobStatus,
	Message,
	MessageChannel,
	MessageStatus,
	ParseJob,
	ParseJobStatus,
	Scenario,
} from "./generated/prisma/client.js";
