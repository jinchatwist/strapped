"use client";

import { useEffect, useState } from "react";
import { DEPTH, HOLES, S_PATH } from "@/components/Logo";
import type { Watch } from "@/lib/watch";


// Builds a 4:5 picture for feeds and stories in the style of a workout share card:
// the try-on photo fills the frame, with the watch name and big numbers along the bottom.
export async function shareCard(image: string, watch: Watch): Promise<File> {
  const photo = new Image();
  photo.src = image;
  await photo.decode();
  const wordmark = `${getComputedStyle(document.documentElement).getPropertyValue("--font-wordmark").trim() || "Georgia"}, Georgia, serif`;
  await document.fonts?.load(`italic 500 44px ${wordmark}`).catch(() => {});
  await document.fonts?.ready;
  const W = 1080, H = 1350, pad = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(W / photo.width, H / photo.height);
  const dw = photo.width * scale, dh = photo.height * scale;
  ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // Shade the top and bottom so white text reads on any photo.
  const top = ctx.createLinearGradient(0, 0, 0, 240);
  top.addColorStop(0, "rgba(0,0,0,.55)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 240);
  const bottom = ctx.createLinearGradient(0, H - 560, 0, H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(0.45, "rgba(0,0,0,.55)");
  bottom.addColorStop(1, "rgba(0,0,0,.85)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H - 560, W, 560);

  // Logo and name, top left.
  ctx.save();
  ctx.translate(pad - 6, 52);
  ctx.scale(0.64, 0.64);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const strap = new Path2D(S_PATH);
  DEPTH.forEach(([x, y, color], i) => {
    ctx.save();
    ctx.translate(x, y);
    if (i === 0) {
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowOffsetX = 1.6 * 0.64 * 2;
      ctx.shadowOffsetY = 2.4 * 0.64 * 2;
      ctx.shadowBlur = 4;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 16;
    ctx.stroke(strap);
    ctx.restore();
  });
  ctx.strokeStyle = "#161616";
  ctx.lineWidth = 16;
  ctx.stroke(strap);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 11;
  ctx.stroke(strap);
  ctx.strokeStyle = "#161616";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "butt";
  ctx.setLineDash([2.8, 2.2]);
  ctx.stroke(strap);
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  for (const x of HOLES) {
    const g = ctx.createRadialGradient(x - 0.4, 76.6, 0, x - 0.4, 76.6, 3.4);
    g.addColorStop(0, "#3a3a3a");
    g.addColorStop(0.55, "#8d8a84");
    g.addColorStop(1, "#f2f0ec");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, 77, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.font = `italic 500 46px ${wordmark}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Strapped", pad + 64, 82);

  // Watch name, then a row of big numbers like a workout summary.
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 30px Rubik, system-ui, sans-serif";
  ctx.fillStyle = "#ff5a36";
  ctx.fillText(watch.brand.toUpperCase(), pad, H - 330);
  ctx.font = "700 58px Rubik, system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fit(ctx, watch.model.replace(new RegExp(`^${watch.brand}\\s+`), ""), W - pad * 2), pad, H - 262);

  const stats: [string, string][] = [["Case", `${watch.caseMm} mm`]];
  if (watch.lugMm > 0) stats.push(["Lug to lug", `${watch.lugMm} mm`]);
  if (watch.priceUsd > 0) stats.push(["Price", `$${watch.priceUsd.toLocaleString("en-US")}`]);
  const col = (W - pad * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = pad + col * i;
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "500 28px Rubik, system-ui, sans-serif";
    ctx.fillText(label, x, H - 160);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 64px Rubik, system-ui, sans-serif";
    ctx.fillText(fit(ctx, value, col - 24), x, H - 92);
    if (i > 0) {
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillRect(x - 24, H - 190, 2, 110);
    }
  });

  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), "image/jpeg", 0.92));
  return new File([blob], "strapped.jpg", { type: "image/jpeg" });
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// On Android a downloaded picture lands in Downloads, which the gallery shows.
function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Target = "instagram" | "facebook" | "tiktok" | "save";

// Instagram and TikTok can't be posted to from a web page, so the phone's share sheet opens with the picture
// ready; people pick the app there. Where the share sheet can't take files, the picture is saved instead.
export function ShareBar({ image, watch }: { image: string; watch: Watch }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ file: File; url: string } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  // Tapping the card shows just the photo, with no words on it. Save and share use whichever is showing.
  const [plain, setPlain] = useState(false);

  // The card is made as soon as the try-on is ready, so people see exactly what they'll post.
  useEffect(() => {
    let url = "";
    let live = true;
    shareCard(image, watch)
      .then((file) => {
        url = URL.createObjectURL(file);
        if (live) setCard({ file, url });
      })
      .catch(() => {});
    fetch(image)
      .then((r) => r.blob())
      .then((b) => live && setPhoto(new File([b], "strapped-photo.jpg", { type: b.type || "image/jpeg" })))
      .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [image, watch]);

  async function share(target: Target) {
    setBusy(true);
    setNote("");
    try {
      const file = plain && photo ? photo : card?.file ?? (await shareCard(image, watch));
      const text = `Trying on the ${watch.model} with Strapped`;
      if (target === "save" && isIOS() && navigator.canShare?.({ files: [file] })) {
        // A web page can't write to Photos on iPhone. The share sheet with only the picture offers "Save Image",
        // which puts it straight in Photos. (Adding text hides that option.)
        await navigator.share({ files: [file] });
        return;
      }
      if (target !== "save" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      if (target === "facebook") {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.origin)}`, "_blank", "noopener");
      }
      download(file);
      const app = target === "instagram" ? "Instagram" : target === "tiktok" ? "TikTok" : target === "facebook" ? "Facebook" : "";
      setNote(app ? `Picture saved. Open ${app} and post it from your gallery.` : "Saved to your gallery.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Couldn't share that. Try Save instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share">
      <button className="card-preview" onClick={() => setPlain(!plain)} aria-label={plain ? "Show the share card" : "Show the photo only"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={plain || !card ? image : card.url} alt={plain ? `${watch.model} on your wrist` : `${watch.model} on your wrist, share card`} />
        <span className="card-hint">{plain ? "Tap for the card" : "Tap for the photo only"}</span>
      </button>
      <div className="share-row">
        <button className="share-btn" onClick={() => share("instagram")} disabled={busy} aria-label="Share to Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
          </svg>
          Instagram
        </button>
        <button className="share-btn" onClick={() => share("facebook")} disabled={busy} aria-label="Share to Facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" fill="currentColor" />
          </svg>
          Facebook
        </button>
        <button className="share-btn" onClick={() => share("tiktok")} disabled={busy} aria-label="Share to TikTok">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 3h2.8c.2 1.9 1.6 3.4 3.7 3.6v2.8c-1.4 0-2.7-.4-3.7-1.1v6.2a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v2.9a2.7 2.7 0 1 0 1.8 2.5V3z" fill="currentColor" />
          </svg>
          TikTok
        </button>
        <button className="share-btn" onClick={() => share("save")} disabled={busy} aria-label="Save picture">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Save
        </button>
      </div>
      {note && <p className="share-note">{note}</p>}
    </div>
  );
}
