import { GoogleGenAI } from "@google/genai";

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
