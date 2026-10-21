import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";
// Server-side fallback: if a request is declined, the API retries it on a suitable model.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export const client = () => new Anthropic();

export function errorResponse(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "The API key isn't valid. Check ANTHROPIC_API_KEY." }, { status: 500 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "Lots of people checking right now. Try again in a minute." }, { status: 429 });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return Response.json({ error: "Couldn't reach the AI. Check your connection and try again." }, { status: 503 });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
