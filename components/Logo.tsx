// The Strapped S: a white leather strap with a dark edge, stitching down the middle and three strap holes.
export const S_PATH = "M72 23H42C17 23 17 49 41 49H59C84 49 84 77 58 77H28";
export const HOLES = [33, 41, 49];

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={S_PATH} stroke="#161616" strokeWidth={16} />
        <path d={S_PATH} stroke="#ffffff" strokeWidth={11} />
        <path d={S_PATH} stroke="#161616" strokeWidth={1.4} strokeDasharray="2.8 2.2" strokeLinecap="butt" />
      </g>
      {HOLES.map((x) => (
        <circle key={x} cx={x} cy={77} r={2.4} fill="#ffffff" stroke="#161616" strokeWidth={1.5} />
      ))}
    </svg>
  );
}
