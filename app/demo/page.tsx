"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import catalog from "@/data/catalog.json";
import photos from "@/data/photos.json";
import { Logo } from "@/components/Logo";
import { WatchPic } from "@/components/WatchPic";
import type { Watch } from "@/lib/watch";

// The prizes: the watches we have real photos of, so the reveal looks like the real thing.
const PRIZES = (photos as string[])
  .map((id) => (catalog as Watch[]).find((w) => w.id === id))
  .filter((w): w is Watch => !!w);

type Stage = "closed" | "shaking" | "open";

// A demo for mystery-box partners: open a chest, get a watch, try it on your wrist in Strapped.
export default function BoxDemo() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("closed");
  const [prize, setPrize] = useState<Watch | null>(null);

  function open() {
    if (stage === "shaking") return;
    setPrize(PRIZES[Math.floor(Math.random() * PRIZES.length)]);
    setStage("shaking");
    setTimeout(() => setStage("open"), 1300);
  }

  return (
    <main className="box-demo">
      <header>
        <span>Mystery box · partner demo</span>
        <Logo size={22} />
      </header>

      <div>
        <h1>{stage === "open" ? "You got it." : "Open your box"}</h1>
        <p className="lead">
          {stage === "open" ? "Don't just look at it. See it on your own wrist." : "One luxury watch inside. Tap to open."}
        </p>
      </div>

      <div className={`box-stage ${stage}`}>
        <div className="glow" />
        <Chest />
        {prize && (
          <div className="prize">
            <WatchPic watch={prize} size={150} />
          </div>
        )}
      </div>

      {stage === "open" && prize ? (
        <>
          <div>
            <p className="prize-name">{prize.model.startsWith(prize.brand) ? prize.model : `${prize.brand} ${prize.model}`}</p>
            <p className="prize-sub">
              {prize.caseMm} mm{prize.priceUsd > 0 && ` · worth about $${prize.priceUsd.toLocaleString("en-US")}`}
            </p>
          </div>
          <button className="cta" onClick={() => router.push(`/?watch=${encodeURIComponent(prize.id)}&from=box`)}>
            Try it on your wrist
          </button>
          <button className="ghost" onClick={() => { setStage("closed"); setPrize(null); }}>Open another box</button>
        </>
      ) : (
        <button className="cta" onClick={open} disabled={stage === "shaking"}>
          {stage === "shaking" ? "Opening…" : "Open box"}
        </button>
      )}

      <p className="fine">Demo of the Strapped try-on inside a mystery-box app. Prizes here are for show only.</p>
    </main>
  );
}

// A gold-trimmed chest; the lid is its own group so it can swing open.
function Chest() {
  const gold = "#d9a45b";
  return (
    <svg className="chest" viewBox="0 0 220 180" aria-hidden="true">
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="1" stopColor="#2e1d11" />
        </linearGradient>
      </defs>
      <rect x="20" y="80" width="180" height="90" rx="10" fill="url(#wood)" stroke={gold} strokeWidth="3" />
      <rect x="20" y="112" width="180" height="8" fill={gold} opacity=".8" />
      <rect x="96" y="100" width="28" height="34" rx="5" fill={gold} />
      <circle cx="110" cy="114" r="4" fill="#2e1d11" />
      <g className="lid">
        <path d="M20 80 Q20 30 110 30 Q200 30 200 80 Z" fill="url(#wood)" stroke={gold} strokeWidth="3" />
        <path d="M60 36 V80 M160 36 V80" stroke={gold} strokeWidth="6" />
      </g>
    </svg>
  );
}
