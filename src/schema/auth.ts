import z from "zod";

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

export const registerSchema = z.object({
	confirmPassword: z.string().min(8),
	email: z.string().email(),
	name: z.string().min(1),
	password: z.string().min(8),
});

export const magicLinkSchema = z.object({
	email: z.string().email(),
});

export const passwordResetSchema = z.object({
	email: z.string().email(),
});
