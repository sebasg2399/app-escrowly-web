import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
    email: z.string().email("Invalid email address"),
    password: passwordSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string(),
  }),
});

export const refreshSchema = z.object({
  cookies: z.object({
    refresh: z.string(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
