import type { Part } from "@google/genai";
import { imageClient } from "@/lib/gemini";
import type { Watch } from "@/lib/watch";

export const maxDuration = 60;

type Img = { data: string; mediaType: string };
type TryOnRequest = { watch: Watch; wrist: Img; watchPhoto?: Img };

// Image model for the try-on preview. Override with GEMINI_IMAGE_MODEL if Google renames it.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

export async function POST(req: Request) {
  let body: TryOnRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "That request didn't look right." }, { status: 400 });
  }
  if (!body.watch || !body.wrist?.data) {
    return Response.json({ error: "Pick a watch and add a wrist photo first." }, { status: 400 });
  }
  const ai = imageClient();
  if (!ai) {
    return Response.json({ error: "Try-on preview isn't set up yet (needs GOOGLE_CLOUD_API_KEY)." }, { status: 503 });
  }

  const w = body.watch;
  const prompt = [
    `Edit the first photo so this person is wearing a ${w.brand} ${w.model} (reference ${w.reference}) on the wrist shown.`,
    `The watch: ${w.caseMm} mm case, ${w.lugMm} mm lug to lug, ${w.thicknessMm} mm thick, case color ${w.caseHex}, dial color ${w.dialHex}, ${w.strap}.`,
    body.watchPhoto ? "The second photo shows exactly what the watch looks like. Match its design, colors and details." : "Draw the watch as it really looks.",
    `Keep it at true scale for the wrist: a ${w.caseMm} mm watch on an average 17 cm wrist covers roughly two-thirds of the wrist's width.`,
    "Keep the hand, skin, sleeve, background, lighting and camera angle exactly the same. Add a natural contact shadow. Return only the edited photo.",
  ].join(" ");

  const parts: Part[] = [{ text: prompt }, { inlineData: { mimeType: body.wrist.mediaType, data: body.wrist.data } }];
  if (body.watchPhoto?.data) parts.push({ inlineData: { mimeType: body.watchPhoto.mediaType, data: body.watchPhoto.data } });

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["IMAGE"] },
    });
    const image = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!image?.data) {
      return Response.json({ error: "Couldn't make the try-on picture this time. Try a clearer wrist photo." }, { status: 422 });
    }
    return Response.json({ image: `data:${image.mimeType || "image/png"};base64,${image.data}` });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "The try-on preview failed. Try again in a moment." }, { status: 502 });
  }
}
