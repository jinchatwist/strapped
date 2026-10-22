"use client";

import { useEffect, useState } from "react";
import { StrapS } from "@/components/Logo";

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
        <StrapS strapClass="splash-s" stitchClass="splash-stitch" holeClass="splash-hole" />
      </svg>
      <div className="splash-name wordmark">Strapped</div>
    </div>
  );
}
