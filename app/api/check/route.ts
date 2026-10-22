import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { FitResultSchema, type FitResult } from "@/lib/fit";
import type { Watch } from "@/lib/watch";
import { client, errorResponse, FALLBACK, MODEL } from "@/lib/claude";

export const maxDuration = 60;

type Img = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
type CheckRequest = { watch: Watch; wrist: Img; outfit?: Img; wristCm?: number };

const SYSTEM = `You're a friendly watch stylist. Someone wants to know if a specific watch suits them. You get the watch's specs, a photo of their wrist, and maybe a photo of how they usually dress.

Point out exactly what works and what doesn't. Every point names one concrete thing (case size or lug-to-lug against their wrist width, thickness, dial or case color against their skin tone, strap against their outfit, overall vibe) and what you see that makes it work or not. No scores, no generic advice.
Size guide: lugs should not hang past the edges of the wrist (use the wrist measurement if given). Around 15 cm wrists usually suit 34-38 mm, 17 cm suits 38-42 mm, 19 cm+ suits 42 mm+.
If the wrist photo doesn't show a wrist, leave works empty and put one point in doesnt asking for a clear photo of their bare wrist.

Write like a friend texting: casual, short, honest. US English.`;

const DEMO: FitResult = {
  works: ["Demo: the 40 mm case sits inside your wrist, so it won't look oversized.", "The clean dial goes with a casual, everyday look."],
  doesnt: ["Demo: a steel bracelet can look a bit dressy with a hoodie."],
};

export async function POST(req: Request) {
  let body: CheckRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "That request didn't look right. Try again." }, { status: 400 });
  }
  if (!body.watch || !body.wrist?.data) {
    return Response.json({ error: "Pick a watch and add a wrist photo first." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ result: DEMO, demo: true });

  const w = body.watch;
  const specs = `${w.brand} ${w.model} (ref ${w.reference}). Case ${w.caseMm} mm, lug-to-lug ${w.lugMm} mm, ${w.thicknessMm} mm thick. Strap: ${w.strap}. Style: ${w.styles.join(", ")}. Around $${w.priceUsd}.`;

  const content: BetaContentBlockParam[] = [
    { type: "text", text: `The watch: ${specs}` },
    { type: "text", text: "My wrist:" },
    { type: "image", source: { type: "base64", media_type: body.wrist.mediaType, data: body.wrist.data } },
  ];
  if (body.outfit?.data) {
    content.push(
      { type: "text", text: "How I usually dress:" },
      { type: "image", source: { type: "base64", media_type: body.outfit.mediaType, data: body.outfit.data } },
    );
  }
  content.push({
    type: "text",
    text: `Does this watch suit me?${body.wristCm ? ` My wrist is ${body.wristCm} cm around.` : ""}`,
  });

  try {
    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(FitResultSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't check that one. Try a different wrist photo." }, { status: 422 });
    }
    return Response.json({ result: response.parsed_output, demo: false });
  } catch (error) {
    return errorResponse(error);
  }
}
