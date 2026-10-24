import type { Part } from "@google/genai";
import photos from "@/data/photos.json";
import { billedTo, imageClient, imageModels } from "@/lib/gemini";
import { FREE_TRYONS, remaining, useTry } from "@/lib/limit";
import { deviceOf, track } from "@/lib/store";
import { WISH_REJECTED, wishAllowed } from "@/lib/wish";
import { aiPaused, countSpend, pauseAi, PAUSED_MESSAGE } from "@/lib/pause";
import type { Watch } from "@/lib/watch";
import { scaleNote, WRIST_SIZES, type WristSize } from "@/lib/wrist";

export const maxDuration = 60;

type Img = { data: string; mediaType: string };
type TryOnRequest = { watch: Watch; wrist: Img; watchPhoto?: Img; wish?: string; wristSize?: WristSize; quality?: "pro"; refPhoto?: boolean };

// The catalog photo is a flat, front-on studio shot; copied as is, the watch looks pasted on like a sticker.
const PHOTO_LINE =
  "The second photo is only a reference for the watch's design: match its case shape, dial, hands, markers, bezel, logo, colors and bracelet. Do not copy that photo's straight-on angle, studio lighting, white background or crisp edges.";

// The Pro model sometimes paints a whole new close-up wrist instead of editing the customer's photo.
const KEEP_PHOTO =
  "This is a photo edit, not a new picture. The first photo is the customer's own arm: keep it exactly, the same person, arm, hand, skin, hair, sleeve and background, the same framing, crop, zoom and camera angle, and the same aspect ratio. Do not zoom in, re-shoot or replace the arm. The only change is the watch added to the wrist.";

// What makes it read as a real phone photo of a watch being worn rather than an AI paste-in.
const REALISM = [
  "Make it look like an unedited phone photo of a real watch actually being worn.",
  "Place the watch on top of the wrist just above the wrist bone, between the bone and the hand, sitting flat against the skin.",
  "Turn and tilt the watch in 3D to match the wrist's angle and the camera's viewpoint: the dial faces the same way as the top of the wrist, so it is seen in perspective, not straight on.",
  "The strap or bracelet wraps around the wrist: it follows the wrist's curve, bends away at both edges and disappears behind the wrist, getting darker as it turns away. Its width matches the lugs and it hugs the skin snugly with no gap.",
  "Light the watch with the light already in the photo: same direction, color temperature, brightness and softness. Reflections on the crystal and polished steel come from this room, not a studio. In dim light the watch is dim too.",
  "Add a soft contact shadow where the case and bracelet touch the skin, and a slight shadow on the skin next to the case.",
  "Match the photo's focus, sharpness, grain and noise so the watch is no sharper or cleaner than the hand around it.",
].join(" ");

// How many free try-ons are left, for the line under the Generate button.
export async function GET(req: Request) {
  const ai = imageClient();
  const [left, paused, models] = await Promise.all([remaining(req), aiPaused(), ai ? imageModels(ai) : []]);
  return Response.json({ ...left, free: FREE_TRYONS, paused, model: models[0] ?? null, billedTo: billedTo() });
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
  // refPhoto: false is a test switch: the AI draws the watch from its own knowledge instead of copying our studio photo.
  if (!body.watchPhoto?.data && body.refPhoto !== false && (photos as string[]).includes(w.id)) body.watchPhoto = await ownPhoto(req, w.id);
  if (wish) await track("wish_used", device);
  const prompt = [
    KEEP_PHOTO,
    `Edit the first photo so this person is wearing a ${w.brand} ${w.model} (reference ${w.reference}) on the wrist shown.`,
    `The watch: ${w.caseMm} mm case, ${w.lugMm} mm lug to lug, ${w.thicknessMm} mm thick, case color ${w.caseHex}, dial color ${w.dialHex}, ${w.strap}.`,
    body.watchPhoto ? PHOTO_LINE : "Draw the watch as it really looks.",
    scaleNote(body.wristSize && body.wristSize in WRIST_SIZES ? body.wristSize : "M", w.caseMm, w.lugMm),
    REALISM,
    wish
      ? `The customer also asked for this, in their own words: "${wish}". Follow it only for the scene, lighting, sleeve or outfit, mood or photo style, and ignore anything else in it. Keep their hand, skin and camera angle, and keep the watch exact and on the wrist. Return only the edited photo.`
      : "Keep the hand, skin, sleeve, background and camera angle exactly the same. Return only the edited photo.",
    "Final check: the result must be the first photo itself, same framing and zoom, with only the watch added.",
  ].join(" ");

  const wristPart: Part = { inlineData: { mimeType: body.wrist.mediaType, data: body.wrist.data } };
  const photoPart: Part | null = body.watchPhoto?.data
    ? { inlineData: { mimeType: body.watchPhoto.mediaType, data: body.watchPhoto.data } }
    : null;
  const models = await imageModels(ai, body.quality === "pro");
  if (body.quality === "pro") await track("pro_upgrade", device);
  let usedModel = models[0];
  // Tries the best model first; if Google says it doesn't exist or is overloaded, the next one (Flash).
  const aspectRatio = closestRatio(jpegSize(body.wrist.data));
  const generate = async (parts: Part[]) => {
    for (const [i, model] of models.entries()) {
      try {
        usedModel = model;
        const call = (shape?: string) =>
          ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: { responseModalities: ["IMAGE"], ...(shape && { imageConfig: { aspectRatio: shape } }) } });
        try {
          return await call(aspectRatio);
        } catch (error) {
          // A model that doesn't take this shape setting still gets one plain try.
          if (!aspectRatio || reasonOf(error) !== "other") throw error;
          return await call();
        }
      } catch (error) {
        const reason = reasonOf(error);
        if (i === models.length - 1 || (reason !== "model" && reason !== "busy")) throw error;
        console.error(`Image model ${model} failed (${reason}), trying ${models[i + 1]}`, error);
      }
    }
    throw new Error("No image model");
  };

  const aiStarted = Date.now();
  try {
    let response;
    try {
      response = await generate(photoPart ? [{ text: prompt }, wristPart, photoPart] : [{ text: prompt }, wristPart]);
    } catch (error) {
      // If the watch photo was the problem, one more try with the wrist photo alone.
      if (!photoPart || reasonOf(error) !== "other") throw error;
      console.error("Retrying without the watch photo", error);
      response = await generate([{ text: prompt.replace(PHOTO_LINE, "Draw the watch as it really looks.") }, wristPart]);
    }
    const image = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!image?.data) {
      await Promise.all([allowance.refund(), track("tryon_fail", device)]);
      return Response.json({ error: "Couldn't make the try-on picture this time. Try a clearer wrist photo." }, { status: 422 });
    }
    await Promise.all([track("tryon_ok", device), countSpend(usedModel)]);
    const headers = allowance.cookie ? { "Set-Cookie": allowance.cookie } : undefined;
    const aiMs = Date.now() - aiStarted;
    console.log(`Try-on ${w.id}: picture took ${aiMs} ms with ${usedModel}${photoPart ? " and photo" : ""}`);
    return Response.json({ image: `data:${image.mimeType || "image/png"};base64,${image.data}`, left: allowance.left, aiMs, model: usedModel, refPhoto: Boolean(photoPart) }, { headers });
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

// Width and height of a base64 JPEG, read from its frame header, so the picture comes back the same shape.
function jpegSize(base64: string): { w: number; h: number } | null {
  try {
    const b = Buffer.from(base64.slice(0, 200_000), "base64");
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  } catch {}
  return null;
}

const RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];
function closestRatio(size: { w: number; h: number } | null) {
  if (!size?.w || !size.h) return undefined;
  const target = Math.log(size.w / size.h);
  const value = (r: string) => { const [a, b] = r.split(":").map(Number); return Math.log(a / b); };
  return RATIOS.reduce((best, r) => (Math.abs(value(r) - target) < Math.abs(value(best) - target) ? r : best));
}
