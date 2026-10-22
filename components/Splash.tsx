"use client";

import { useEffect, useState } from "react";

// Opening animation: a strap closes around a wrist, then the app shows through.
// It is drawn on the server so it covers the page from the first paint; CSS alone hides it at the end.
export function Splash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGone(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  if (gone) return null;

  return (
    <div className="splash" aria-hidden="true" onClick={() => setGone(true)}>
      <svg className="splash-art" viewBox="0 0 240 240">
        <defs>
          <clipPath id="splash-arm">
            <rect x="-400" y="78" width="1040" height="104" rx="52" />
          </clipPath>
          <linearGradient id="splash-round" x1="0" y1="78" x2="0" y2="182" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <stop offset="0.22" stopColor="#000" stopOpacity="0" />
            <stop offset="0.78" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.32" />
          </linearGradient>
        </defs>

        <g className="splash-arm">
          <rect x="-400" y="78" width="1040" height="104" rx="52" fill="var(--skin)" />
          <g clipPath="url(#splash-arm)">
            <path className="splash-strap splash-strap-top" d="M120 106V74" />
            <path className="splash-strap splash-strap-bottom" d="M120 154V186" />
            <g className="splash-holes">
              <circle cx="120" cy="164" r="2.6" />
              <circle cx="120" cy="172" r="2.6" />
              <circle cx="120" cy="180" r="2.6" />
            </g>
            <rect x="-400" y="78" width="1040" height="104" fill="url(#splash-round)" />
          </g>
        </g>

        <g className="splash-watch">
          <rect x="105" y="98" width="30" height="64" rx="8" fill="var(--case)" />
          <circle cx="120" cy="130" r="28" fill="var(--case)" />
          <circle cx="120" cy="130" r="21.5" fill="var(--dial)" />
          <path className="splash-hand" d="M120 130V114" />
          <path className="splash-hand splash-hand-short" d="M120 130H131" />
          <circle cx="120" cy="130" r="2.4" fill="var(--accent)" />
        </g>
      </svg>
      <div className="splash-name">Strapped</div>
    </div>
  );
}
