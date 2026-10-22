"use client";

import { useEffect, useState } from "react";
import { HOLES, S_PATH } from "@/components/Logo";

// Opening animation: the S draws itself like a strap wrapping, the stitching appears, then the holes punch in.
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
      <svg className="splash-art" viewBox="0 0 100 100">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path className="splash-s" pathLength={100} d={S_PATH} stroke="#161616" strokeWidth={16} />
          <path className="splash-s" pathLength={100} d={S_PATH} stroke="#ffffff" strokeWidth={11} />
          <path className="splash-stitch" d={S_PATH} stroke="#161616" strokeWidth={1.4} strokeDasharray="2.8 2.2" strokeLinecap="butt" />
        </g>
        {HOLES.map((x) => (
          <circle key={x} className="splash-hole" cx={x} cy={77} r={2.4} fill="#ffffff" stroke="#161616" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="splash-name wordmark">Strapped</div>
    </div>
  );
}
