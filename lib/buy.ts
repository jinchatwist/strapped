import type { Watch } from "@/lib/watch";

// Where "Buy this watch" goes. NEXT_PUBLIC_BUY_URL can swap in an affiliate link; {q} becomes the search words.
const TEMPLATE = process.env.NEXT_PUBLIC_BUY_URL || "https://www.chrono24.com/search/index.htm?query={q}";

export const BUY_STORE = process.env.NEXT_PUBLIC_BUY_STORE || "Chrono24";

export function buyUrl(w: Watch) {
  const q = w.reference && !w.custom ? `${w.brand} ${w.reference}` : `${w.brand} ${w.model}`;
  return TEMPLATE.replace("{q}", encodeURIComponent(q).replace(/%20/g, "+"));
}
