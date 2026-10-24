import { GoogleGenAI } from "@google/genai";

// Which account pays for pictures, by the same order imageClient picks in.
export function billedTo(): "google-cloud" | "ai-studio" | null {
  const env = process.env;
  if (env.GOOGLE_CLOUD_API_KEY || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_SERVICE_ACCOUNT_JSON)) return "google-cloud";
  return env.GEMINI_API_KEY ? "ai-studio" : null;
}

// Picks how to reach Google's image model. Vertex AI bills the Google Cloud account (so trial credits apply);
// the plain Gemini API key bills AI Studio. The first one that is set up wins.
export function imageClient(): GoogleGenAI | null {
  const env = process.env;
  if (env.GOOGLE_CLOUD_API_KEY) {
    return new GoogleGenAI({ vertexai: true, apiKey: env.GOOGLE_CLOUD_API_KEY });
  }
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return new GoogleGenAI({
      vertexai: true,
      project: env.GOOGLE_CLOUD_PROJECT,
      location: env.GOOGLE_CLOUD_LOCATION || "global",
      googleAuthOptions: { credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) },
    });
  }
  if (env.GEMINI_API_KEY) return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return null;
}

const FLASH_IMAGE = "gemini-3.1-flash-image";

// The newest "Pro" image model this key can use: slower and about twice the price of Flash, but it
// blends the watch into the photo (angle, light, shadows) instead of pasting it on. Looked up once per
// server start; null if the key has none.
let pro: Promise<string | null> | undefined;
function proImageModel(ai: GoogleGenAI): Promise<string | null> {
  pro ??= (async () => {
    const found: string[] = [];
    for await (const m of await ai.models.list()) {
      const name = (m.name || "").replace(/^.*models\//, "");
      if (/pro/.test(name) && /image/.test(name)) found.push(name);
    }
    const version = (n: string) => parseFloat(n.match(/\d+(\.\d+)?/)?.[0] || "0");
    found.sort((a, b) => version(b) - version(a) || Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)));
    return found[0] ?? null;
  })().catch((error) => {
    console.error("Couldn't list Google models", error);
    pro = undefined;
    return null;
  });
  return pro;
}

// Image models for the try-on picture, best first; Flash stays last so there is always a fallback.
// Flash makes every first picture; Pro only when someone asks for a more real one.
// GEMINI_IMAGE_MODEL pins one model; TRYON_QUALITY=fast turns Pro off entirely.
export async function imageModels(ai: GoogleGenAI, wantPro = false): Promise<string[]> {
  if (process.env.GEMINI_IMAGE_MODEL) return [process.env.GEMINI_IMAGE_MODEL];
  if (!wantPro || process.env.TRYON_QUALITY === "fast") return [FLASH_IMAGE];
  const best = await proImageModel(ai);
  return best ? [best, FLASH_IMAGE] : [FLASH_IMAGE];
}
