"use client";

import { useEffect, useState } from "react";

// Opening animation: the S draws itself like a strap wrapping, then the holes punch in.
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
        <mask id="splash-holes" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <circle className="splash-hole" cx="33" cy="77" r="2.4" fill="#000" />
          <circle className="splash-hole" cx="41" cy="77" r="2.4" fill="#000" />
          <circle className="splash-hole" cx="49" cy="77" r="2.4" fill="#000" />
        </mask>
        <g mask="url(#splash-holes)">
          <path className="splash-s" pathLength="100" d="M72 23H42C17 23 17 49 41 49H59C84 49 84 77 58 77H28" />
        </g>
      </svg>
      <div className="splash-name">Strapped</div>
    </div>
  );
}
