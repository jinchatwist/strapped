import { z } from "zod";

export const FitResultSchema = z.object({
  works: z
    .array(z.string())
    .describe("1-3 specific things about this watch that suit this person, each naming the feature and why, under 15 words"),
  doesnt: z
    .array(z.string())
    .describe("0-3 specific things that don't suit them, each naming the feature and why, under 15 words. Empty if nothing"),
});

export type FitResult = z.infer<typeof FitResultSchema>;
