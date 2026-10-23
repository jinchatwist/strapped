import { ThinkingLevel, Type, type GoogleGenAI } from "@google/genai";
import { flashModels, imageClient, imageModels } from "@/lib/gemini";

export const maxDuration = 30;

// A fast vision model finds the wrist in the photo. Set WRIST_MODEL to choose one.
function wristModels(ai: GoogleGenAI) {
  return process.env.WRIST_MODEL ? Promise.resolve([process.env.WRIST_MODEL]) : flashModels(ai, "text");
}

// Open /api/wrist in a browser to see which models the wrist check and the try-on picture use.
export async function GET() {
  const ai = imageClient();
  if (!ai) return Response.json({ ready: false, reason: "no Google key" });
  return Response.json({ ready: true, models: await wristModels(ai), imageModels: await imageModels(ai) });
}

const PROMPT = [
  "This photo shows a person's forearm and hand. Find where a wristwatch would sit: on the forearm just before the wrist bone, about one finger-width from the hand.",
  "At that spot, give the two points where a straight line across the arm meets the left and right edges of the skin (the arm's silhouette), so the distance between them is the arm's full visible width there.",
  "Points are [y, x] normalized to 0-1000. If no bare forearm or wrist is clearly visible, set found to false.",
].join(" ");

// Measures the wrist in the customer's own photo so the true-size patch fits their real wrist,
// not just where the camera outline expected it.
export async function POST(req: Request) {
  const ai = imageClient();
  let body: { data?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ found: false }, { status: 400 });
  }
  if (!ai || !body.data) return Response.json({ found: false });
  for (const model of await wristModels(ai)) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType: body.mediaType || "image/jpeg", data: body.data } }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: { type: Type.BOOLEAN },
              edgeA: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              edgeB: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
            required: ["found"],
          },
          // Finding two edges doesn't need long thinking, and the customer is waiting.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const out = JSON.parse(res.text || "{}");
      const ok = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && n >= 0 && n <= 1000);
      if (!out.found || !ok(out.edgeA) || !ok(out.edgeB)) return Response.json({ found: false, via: model });
      return Response.json({ found: true, a: out.edgeA, b: out.edgeB, via: model });
    } catch (error) {
      console.error(`Wrist check with ${model} failed`, error);
    }
  }
  return Response.json({ found: false });
}
