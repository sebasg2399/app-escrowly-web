import { z } from "zod";
import { dollarsToCents } from "../../lib/money";

/**
 * Schemas for the contracts feature.
 *
 * `milestoneAmountSchema` accepts a DOLLAR string (user input) and converts to
 * integer cents inside `.transform()`. Validation runs BEFORE the transform so
 * a non-numeric value yields a clear "Amount is required" message instead of
 * a silent NaN.
 */
const milestoneAmountSchema = z
  .string()
  .min(1, "Amount is required")
  .refine((s) => Number.isFinite(dollarsToCents(s)) && dollarsToCents(s) > 0, {
    message: "Amount must be greater than $0.00",
  })
  .transform((s) => dollarsToCents(s));

const milestoneTitleSchema = z.string().min(1, "Title is required").max(200, "Title is too long");

const milestoneInputSchema = z.object({
  title: milestoneTitleSchema,
  amount: milestoneAmountSchema,
});

export const createContractInputSchema = z.object({
  sellerEmail: z.string().email("Enter a valid email address"),
  milestones: z.array(milestoneInputSchema).min(1, "Add at least one milestone"),
});

export type CreateContractInput = z.input<typeof createContractInputSchema>;
export type CreateContractPayload = z.output<typeof createContractInputSchema>;

/**
 * Per-row schema for repeatable milestone rows. The array wrapper enforces
 * "at least 1 milestone" on submit.
 */
export const milestoneRowSchema = milestoneInputSchema;
export type MilestoneRow = z.input<typeof milestoneRowSchema>;
