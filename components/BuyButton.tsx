"use client";

import { track } from "@/lib/beta";
import { BUY_STORE, buyUrl } from "@/lib/buy";
import type { Watch } from "@/lib/watch";

export function BuyButton({ watch, small }: { watch: Watch; small?: boolean }) {
  return (
    <a
      className={small ? "buy buy-small" : "buy"}
      href={buyUrl(watch)}
      target="_blank"
      rel="noopener sponsored"
      onClick={() => track("buy_click")}
    >
      {small ? "Buy" : "Buy this watch"}
      {!small && <small>on {BUY_STORE}</small>}
    </a>
  );
}
