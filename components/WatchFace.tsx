import { shapeOf, type Watch } from "@/lib/watch";

const STRAP_COLORS: Record<string, string> = {
  leather: "#6b4a32",
  nylon: "#3f4a3a",
  canvas: "#5c5a48",
  rubber: "#202020",
  resin: "",
  silicone: "#2a2a2a",
  velcro: "#2a2a2a",
  mesh: "",
  "sport band": "#2a2a2a",
};

function strapColor(w: Watch) {
  const key = Object.keys(STRAP_COLORS).find((k) => w.strap.toLowerCase().includes(k));
  if (key && STRAP_COLORS[key]) return STRAP_COLORS[key];
  return w.caseHex; // bracelets, resin and mesh match the case
}

// A simple drawing of the watch, scaled so that 50 mm fills the box.
export function WatchFace({ watch, size = 72 }: { watch: Watch; size?: number }) {
  const scale = 100 / 50;
  const w = Math.min(watch.caseMm, 50) * scale;
  const h = Math.min(Math.max(watch.lugMm, watch.caseMm), 60) * scale * 0.62;
  const shape = shapeOf(watch);
  const strap = strapColor(watch);
  const c = 50;
  const strapW = Math.max(w * 0.5, 20);
  const dark = isDark(watch.dialHex);
  const hand = dark ? "#f4f4f4" : "#1c1c1c";

  let caseEl: React.ReactNode;
  let dialEl: React.ReactNode;
  if (shape === "rect" || shape === "square") {
    const ch = shape === "rect" ? Math.max(h, w * 1.3) : w;
    caseEl = <rect x={c - w / 2} y={c - ch / 2} width={w} height={ch} rx={shape === "rect" ? 4 : 9} fill={watch.caseHex} stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1.5} />;
    dialEl = <rect x={c - w / 2 + 4} y={c - ch / 2 + 4} width={w - 8} height={ch - 8} rx={shape === "rect" ? 2 : 6} fill={watch.dialHex} />;
  } else if (shape === "octagon") {
    caseEl = <circle cx={c} cy={c} r={w / 2} fill={watch.caseHex} stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1.5} />;
    dialEl = <polygon points={octagon(c, w / 2 - 4)} fill={watch.dialHex} />;
  } else {
    caseEl = <circle cx={c} cy={c} r={w / 2} fill={watch.caseHex} stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1.5} />;
    dialEl = <circle cx={c} cy={c} r={w / 2 - 4} fill={watch.dialHex} />;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${watch.model} drawing`}>
      <rect x={c - strapW / 2} y={0} width={strapW} height={100} rx={4} fill={strap} stroke="var(--ink)" strokeOpacity={0.18} strokeWidth={1.5} />
      {caseEl}
      {dialEl}
      {!watch.styles.includes("digital") || shape === "round" ? (
        <g stroke={hand} strokeLinecap="round">
          <line x1={c} y1={c} x2={c} y2={c - w * 0.28} strokeWidth={2.4} />
          <line x1={c} y1={c} x2={c + w * 0.2} y2={c + w * 0.06} strokeWidth={2.4} />
        </g>
      ) : (
        <rect x={c - w * 0.28} y={c - w * 0.1} width={w * 0.56} height={w * 0.2} rx={2} fill={hand} opacity={0.25} />
      )}
    </svg>
  );
}

function octagon(c: number, r: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 8) * (2 * i + 1);
    return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function isDark(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 140;
}
