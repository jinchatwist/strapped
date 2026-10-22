import { useId } from "react";

// The Strapped S: a white leather strap with a dark edge, stitching down the middle and three strap holes,
// standing out from the page with a dark side and a soft shadow.
export const S_PATH = "M72 23H42C17 23 17 49 41 49H59C84 49 84 77 58 77H28";
export const HOLES = [33, 41, 49];
// The strap's side, back to front: offset and color of each layer.
export const DEPTH: [number, number, string][] = [
  [2.4, 3.6, "#3b3b3b"],
  [1.6, 2.4, "#2b2b2b"],
  [0.8, 1.2, "#1f1f1f"],
];

// Drawn by Logo and by the opening animation (which passes a class to animate the strap).
export function StrapS({ strapClass, stitchClass, holeClass }: { strapClass?: string; stitchClass?: string; holeClass?: string }) {
  const hole = useId();
  return (
    <>
      <defs>
        <radialGradient id={hole} cx=".42" cy=".38" r=".7">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset=".55" stopColor="#8d8a84" />
          <stop offset="1" stopColor="#f2f0ec" />
        </radialGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path className={strapClass} pathLength={100} d={S_PATH} stroke="#000" strokeOpacity={0.18} strokeWidth={16} transform="translate(4 6)" style={{ filter: "blur(1.5px)" }} />
        {DEPTH.map(([x, y, color]) => (
          <path key={color} className={strapClass} pathLength={100} d={S_PATH} stroke={color} strokeWidth={16} transform={`translate(${x} ${y})`} />
        ))}
        <path className={strapClass} pathLength={100} d={S_PATH} stroke="#161616" strokeWidth={16} />
        <path className={strapClass} pathLength={100} d={S_PATH} stroke="#ffffff" strokeWidth={11} />
        <path className={stitchClass} d={S_PATH} stroke="#161616" strokeWidth={1.4} strokeDasharray="2.8 2.2" strokeLinecap="butt" />
      </g>
      {HOLES.map((x) => (
        <circle key={x} className={holeClass} cx={x} cy={77} r={2.4} fill={`url(#${hole})`} stroke="#161616" strokeWidth={1.5} />
      ))}
    </>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <StrapS />
    </svg>
  );
}
