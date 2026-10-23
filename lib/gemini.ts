import { GoogleGenAI } from "@google/genai";

const FALLBACK = { text: "gemini-2.5-flash", image: "gemini-3.1-flash-image" };

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

// The Flash models this key can use, newest first, so we pick up Google's faster releases without
// a code change and a renamed model doesn't break anything. "text" reads photos and answers;
// "image" makes pictures. Looked up once per server start.
const lists: Partial<Record<"text" | "image", Promise<string[]>>> = {};
export function flashModels(ai: GoogleGenAI, kind: "text" | "image"): Promise<string[]> {
  lists[kind] ??= (async () => {
    const found: string[] = [];
    for await (const m of await ai.models.list()) {
      const name = (m.name || "").replace(/^.*models\//, "");
      if (!/flash/.test(name) || /tts|live|audio|embed|lite/.test(name)) continue;
      if (/image/.test(name) !== (kind === "image")) continue;
      if (m.supportedActions && !m.supportedActions.includes("generateContent")) continue;
      found.push(name);
    }
    const version = (n: string) => parseFloat(n.match(/\d+(\.\d+)?/)?.[0] || "0");
    // Newest first; a finished model before a preview of the same version.
    found.sort((a, b) => version(b) - version(a) || Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)));
    return found.length ? found.slice(0, 3) : [FALLBACK[kind]];
  })().catch((error) => {
    console.error("Couldn't list Google models", error);
    delete lists[kind];
    return [FALLBACK[kind]];
  });
  return lists[kind]!;
}

// Image models for the try-on picture, newest Flash first. Set GEMINI_IMAGE_MODEL to pin one.
// The model the app launched with stays last in line, so a bad pick can always fall back to it.

export async function imageModels(ai: GoogleGenAI) {
  if (process.env.GEMINI_IMAGE_MODEL) return [process.env.GEMINI_IMAGE_MODEL];
  const found = await flashModels(ai, "image");
  return found.includes(FALLBACK.image) ? found : [...found, FALLBACK.image];
}
