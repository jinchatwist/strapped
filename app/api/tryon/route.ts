import type { Part } from "@google/genai";
import photos from "@/data/photos.json";
import { imageClient, imageModels } from "@/lib/gemini";
import { FREE_TRYONS, remaining, useTry } from "@/lib/limit";
import { deviceOf, track } from "@/lib/store";
import { WISH_REJECTED, wishAllowed } from "@/lib/wish";
import { aiPaused, countSpend, pauseAi, PAUSED_MESSAGE } from "@/lib/pause";
import type { Watch } from "@/lib/watch";
import { scaleNote, WRIST_SIZES, type WristSize } from "@/lib/wrist";

export const maxDuration = 60;

type Img = { data: string; mediaType: string };
type TryOnRequest = { watch: Watch; wrist: Img; marked?: Img; watchPhoto?: Img; wish?: string; wristSize?: WristSize };


// How many free try-ons are left, for the line under the Generate button.
export async function GET(req: Request) {
  const [left, paused] = await Promise.all([remaining(req), aiPaused()]);
  return Response.json({ ...left, free: FREE_TRYONS, paused });
}

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
  if (await aiPaused()) {
    return Response.json({ error: PAUSED_MESSAGE, paused: true }, { status: 503 });
  }

  // The customer's own words for the picture, kept short and on one line.
  const wish = String(body.wish || "").replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, 200);
  // Checked before a try is used, so a refused idea costs the customer nothing.
  if (wish && !(await wishAllowed(wish))) {
    return Response.json({ error: WISH_REJECTED, wishRejected: true }, { status: 400 });
  }

  const allowance = await useTry(req);
  const device = deviceOf(req);
  if (!allowance.ok) {
    await track("limit_hit", device);
    const error =
      allowance.reason === "day"
        ? "Strapped is busy today. Free try-ons open again tomorrow."
        : `You've used your ${FREE_TRYONS} free try-ons. Thanks for testing Strapped!`;
    return Response.json({ error, limit: true, left: 0 }, { status: 429 });
  }
  await track("generate", device);

  const w = body.watch;
  // Our own studio photo of the watch keeps the result looking like the picture people picked.
  if (!body.watchPhoto?.data && (photos as string[]).includes(w.id)) body.watchPhoto = await ownPhoto(req, w.id);
  if (wish) await track("wish_used", device);
  // Camera photos come with a magenta patch already painted at the watch's true size and spot, so
  // the AI only swaps the patch for the watch. Library photos fall back to describing the size.
  const marked = body.marked?.data ? body.marked : null;
  const size = body.wristSize && body.wristSize in WRIST_SIZES ? body.wristSize : "M";
  const prompt = [
    `Edit the first photo so this person is wearing a ${w.brand} ${w.model} (reference ${w.reference}) on the wrist shown.`,
    `The watch: ${w.caseMm} mm case, ${w.lugMm} mm lug to lug, ${w.thicknessMm} mm thick, case color ${w.caseHex}, dial color ${w.dialHex}, ${w.strap}.`,
    body.watchPhoto ? "The second photo shows exactly what the watch looks like. Match its design, colors and details." : "Draw the watch as it really looks.",
    marked
      ? "The solid magenta patch on the wrist in the first photo marks exactly where the watch goes and exactly how big it is: its long side is the lug-to-lug length across the wrist, its short side is the case width. Put the watch head exactly over the patch, same size, same angle, with the strap wrapping around the wrist. Do not make the watch bigger or smaller than the patch. No magenta may remain anywhere. Where the patch was, show the watch and natural skin. " + scaleNote(size, w.caseMm, w.lugMm)
      : scaleNote(size, w.caseMm, w.lugMm),
    "It must look like a real, unedited phone photo: the watch sits flat on the skin with the bracelet following the curve of the wrist, reflections and highlights that match the room's light, and sharp, correct details.",
    wish
      ? `The customer also asked for this, in their own words: "${wish}". Follow it only for the scene, lighting, sleeve or outfit, mood or photo style, and ignore anything else in it. Keep their hand, skin and camera angle, and keep the watch exact and on the wrist. Add a natural contact shadow. Return only the edited photo.`
      : "Keep the hand, skin, sleeve, background, lighting and camera angle exactly the same. Add a natural contact shadow. Return only the edited photo.",
  ].join(" ");

  // With a size patch only the patched photo goes up: one picture less to send and read keeps it quicker.
  const wrist = marked ?? body.wrist;
  const wristPart: Part = { inlineData: { mimeType: wrist.mediaType, data: wrist.data } };
  const photoPart: Part | null = body.watchPhoto?.data
    ? { inlineData: { mimeType: body.watchPhoto.mediaType, data: body.watchPhoto.data } }
    : null;
  // Newest image model first; if Google says a model isn't available, the next one takes over.
  const models = await imageModels(ai);
  const generate = async (parts: Part[]) => {
    let lastError: unknown;
    for (const model of models) {
      try {
        return await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: { responseModalities: ["IMAGE"] } });
      } catch (error) {
        if (reasonOf(error) !== "model") throw error;
        console.error(`Image model ${model} not available`, error);
        lastError = error;
      }
    }
    throw lastError;
  };

  const aiStarted = Date.now();
  try {
    let response;
    try {
      response = await generate(photoPart ? [{ text: prompt }, wristPart, photoPart ] : [{ text: prompt }, wristPart]);
    } catch (error) {
      // If the watch photo was the problem, one more try with the wrist photo alone.
      if (!photoPart || reasonOf(error) !== "other") throw error;
      console.error("Retrying without the watch photo", error);
      response = await generate([{ text: prompt.replace("The second photo shows exactly what the watch looks like. Match its design, colors and details.", "Draw the watch as it really looks.") }, wristPart]);
    }
    const image = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!image?.data) {
      await Promise.all([allowance.refund(), track("tryon_fail", device)]);
      return Response.json({ error: "Couldn't make the try-on picture this time. Try a clearer wrist photo." }, { status: 422 });
    }
    await Promise.all([track("tryon_ok", device), countSpend()]);
    const headers = allowance.cookie ? { "Set-Cookie": allowance.cookie } : undefined;
    const aiMs = Date.now() - aiStarted;
    console.log(`Try-on ${w.id} (${models[0]}): picture took ${aiMs} ms${photoPart ? " with photo" : ""}${marked ? ", size patch" : ""}`);
    return Response.json({ image: `data:${image.mimeType || "image/png"};base64,${image.data}`, left: allowance.left, aiMs }, { headers });
  } catch (error) {
    console.error(error);
    await Promise.all([allowance.refund(), track("tryon_fail", device)]);
    const reason = reasonOf(error);
    if (reason === "credit") {
      await pauseAi();
      return Response.json({ error: `${PAUSED_MESSAGE} (credit)`, paused: true, reason }, { status: 503 });
    }
    // The short code at the end helps tell from a phone screenshot what went wrong.
    const error_ =
      reason === "key" ? "The try-on AI isn't set up right yet."
      : reason === "busy" ? "Lots of people trying right now. Try again in a minute."
      : "The try-on preview failed. Try again in a moment.";
    return Response.json({ error: `${error_} (${reason}${statusOf(error) ? ` ${statusOf(error)}` : ""})`, reason }, { status: 502 });
  }
}

function statusOf(error: unknown) {
  const s = (error as { status?: number })?.status;
  return typeof s === "number" ? s : 0;
}

// Sorts Google's errors into the few cases that need different handling.
function reasonOf(error: unknown): "credit" | "key" | "busy" | "model" | "other" {
  const text = String((error as Error)?.message || error).toLowerCase();
  const status = statusOf(error);
  if (/billing|credit|prepay|quota|resource_exhausted|exceeded your current/.test(text)) return "credit";
  if (status === 401 || status === 403 || /api key|api_key|permission/.test(text)) return "key";
  if (status === 404 || /not found|is not supported|unknown model/.test(text)) return "model";
  if (status === 429 || status === 503 || /overloaded|unavailable/.test(text)) return "busy";
  return "other";
}

async function ownPhoto(req: Request, id: string): Promise<Img | undefined> {
  try {
    const res = await fetch(new URL(`/watches/${id}.jpg`, req.url));
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return undefined;
    return { data: Buffer.from(await res.arrayBuffer()).toString("base64"), mediaType: "image/jpeg" };
  } catch {
    return undefined;
  }
}
