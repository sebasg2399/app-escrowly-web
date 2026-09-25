import { z } from "zod";

const milestoneInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  amount: z
    .number()
    .int("Amount must be an integer (cents)")
    .positive("Amount must be greater than 0"),
});

export const createContractSchema = z.object({
  body: z.object({
    sellerEmail: z.string().email("Invalid seller email"),
    milestones: z
      .array(milestoneInputSchema)
      .min(1, "At least one milestone is required"),
  }),
});

export type CreateContractInput = z.infer<typeof createContractSchema>["body"];