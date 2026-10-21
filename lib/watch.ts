import { z } from "zod";

export const WatchSchema = z.object({
  brand: z.string(),
  family: z.string(),
  model: z.string(),
  reference: z.string(),
  caseMm: z.number().describe("Case diameter (or width for rectangular watches) in mm"),
  lugMm: z.number().describe("Lug-to-lug length in mm"),
  thicknessMm: z.number(),
  caseHex: z.string().describe("Case color as a hex code, e.g. #c9cbcd for steel"),
  dialHex: z.string().describe("Dial color as a hex code"),
  strap: z.string().describe("e.g. steel bracelet, leather, rubber, resin"),
  styles: z.array(z.string()).describe("From: sport, dress, dive, field, pilot, chrono, digital, casual, luxury"),
  priceUsd: z.number().describe("Approximate US retail price in dollars"),
});

export type WatchSpecs = z.infer<typeof WatchSchema>;
export type Watch = WatchSpecs & { id: string; custom?: boolean };

export type WatchShape = "round" | "octagon" | "rect" | "square";

export function shapeOf(w: Pick<Watch, "brand" | "family" | "model">): WatchShape {
  const name = `${w.brand} ${w.family} ${w.model}`.toLowerCase();
  if (/tank|reverso|santos-dumont|baignoire|ventura|monaco/.test(name)) return "rect";
  if (/square|dw-5600|gw-m5610|gmw-b5000|mrg-b5000|gmd-s5600|apple watch|santos|panth|f-91w|a168|a158|a700|ca-53w/.test(name)) return "square";
  if (/royal oak|casioak|ga-2100|ga-b2100|gm-2100|gm-b2100|gma-s2100|ga-2110|prx|nautilus|aquanaut|overseas|code 11|tissot prx|hublot|defy skyline/.test(name)) return "octagon";
  return "round";
}

export function sizeLabel(mm: number) {
  if (mm < 36) return "Small";
  if (mm < 41) return "Medium";
  if (mm < 45) return "Large";
  return "Extra large";
}
