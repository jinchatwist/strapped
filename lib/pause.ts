import { redis } from "@/lib/store";

// Stops try-ons the moment the AI money runs out, so customers see a clear note instead of failures.
// Two triggers: Google says the credit is gone, or our own spend count reaches AI_BUDGET_USD (if set).
const PAUSE_SECONDS = 15 * 60; // after Google says "no credit", check again in 15 minutes
const CENTS_PER_TRYON = 7;
const BUDGET_CENTS = Math.round(Number(process.env.AI_BUDGET_USD || 0) * 100);

let pausedUntil = 0; // per server instance, for when there's no shared store

export async function aiPaused() {
  if (Date.now() < pausedUntil) return true;
  const out = await redis([["GET", "ai:paused"], ["GET", "ai:spent_cents"]]);
  if (out?.[0]) return true;
  return BUDGET_CENTS > 0 && Number(out?.[1] || 0) >= BUDGET_CENTS;
}

export async function pauseAi() {
  pausedUntil = Date.now() + PAUSE_SECONDS * 1000;
  await redis([["SET", "ai:paused", 1, "EX", PAUSE_SECONDS]]);
}

export async function countSpend() {
  await redis([["INCRBY", "ai:spent_cents", CENTS_PER_TRYON]]);
}

export async function spentUsd() {
  const out = await redis([["GET", "ai:spent_cents"]]);
  return { spent: Number(out?.[0] || 0) / 100, budget: BUDGET_CENTS / 100 };
}

export const PAUSED_MESSAGE = "Try-ons are paused for a little while. Please check back soon!";
