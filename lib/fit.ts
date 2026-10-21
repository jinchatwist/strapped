import { z } from "zod";

export const FitResultSchema = z.object({
  score: z.number().describe("Overall fit score, integer 0-100"),
  verdict: z.string().describe("One short casual sentence, e.g. 'Looks great on you'"),
  size: z.object({
    rating: z.enum(["Too small", "Just right", "Too big"]),
    comment: z.string(),
  }),
  style: z.object({
    rating: z.enum(["Great match", "Works", "Clashes"]),
    comment: z.string(),
  }),
  tips: z.array(z.string()).describe("2-3 short tips"),
});

export type FitResult = z.infer<typeof FitResultSchema>;
