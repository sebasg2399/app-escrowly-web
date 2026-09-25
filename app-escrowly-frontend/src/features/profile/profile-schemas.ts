import { z } from "zod";

export const profileNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export type ProfileNameInput = z.infer<typeof profileNameSchema>;
