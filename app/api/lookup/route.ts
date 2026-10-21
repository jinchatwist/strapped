import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { WatchSchema, type Watch } from "@/lib/watch";
import { client, errorResponse, FALLBACK, MODEL } from "@/lib/claude";

export const maxDuration = 60;

const LookupSchema = z.object({
  found: z.boolean().describe("false if this isn't a real watch model you recognize"),
  watch: WatchSchema,
});

export async function POST(req: Request) {
  const { query } = (await req.json().catch(() => ({}))) as { query?: string };
  const q = query?.trim().slice(0, 120);
  if (!q) return Response.json({ error: "Type a watch name first." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Watch lookup needs an API key. Pick one from the list for now." }, { status: 503 });
  }

  try {
    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(LookupSchema) },
      system:
        "You are a watch reference database. Given a watch name or reference number, return the real specs of the closest matching current or well-known model. Use the manufacturer's published case size, lug-to-lug and thickness; estimate only when not published. If the text isn't a watch you recognize, set found to false.",
      messages: [{ role: "user", content: `Watch: ${q}` }],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) {
      return Response.json({ error: "Couldn't look that one up. Try the model name or reference number." }, { status: 422 });
    }
    if (!out.found) {
      return Response.json({ error: `Couldn't find a watch called "${q}". Try the brand and model.` }, { status: 404 });
    }
    const watch: Watch = { ...out.watch, id: `custom-${Date.now()}`, custom: true };
    return Response.json({ watch });
  } catch (error) {
    return errorResponse(error);
  }
}
