"use client";

import { useState } from "react";
import type { Watch } from "@/lib/watch";

// Builds a 4:5 picture for feeds and stories: the try-on photo, the watch and price, and the Strapped name.
async function shareCard(image: string, watch: Watch): Promise<File> {
  const photo = new Image();
  photo.src = image;
  await photo.decode();
  const W = 1080, H = 1350, band = 190;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(W / photo.width, (H - band) / photo.height);
  const dw = photo.width * scale, dh = photo.height * scale;
  ctx.drawImage(photo, (W - dw) / 2, (H - band - dh) / 2, dw, dh);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, H - band, W, band);
  ctx.fillStyle = "#161616";
  ctx.font = "700 46px Rubik, system-ui, sans-serif";
  ctx.fillText(fit(ctx, watch.model, W - 120), 60, H - band + 78);
  ctx.font = "500 36px Rubik, system-ui, sans-serif";
  ctx.fillStyle = "#6b6a66";
  const price = watch.priceUsd > 0 ? ` · $${watch.priceUsd.toLocaleString("en-US")}` : "";
  ctx.fillText(`${watch.brand}${price}`, 60, H - band + 132);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ff5a36";
  ctx.font = "700 34px Rubik, system-ui, sans-serif";
  ctx.fillText("Strapped", W - 60, H - band + 132);
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), "image/jpeg", 0.92));
  return new File([blob], "strapped.jpg", { type: "image/jpeg" });
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

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

  async function share(target: Target) {
    setBusy(true);
    setNote("");
    try {
      const file = await shareCard(image, watch);
      const text = `Trying on the ${watch.model} with Strapped`;
      if (target !== "save" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      if (target === "facebook") {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.origin)}`, "_blank", "noopener");
      }
      download(file);
      const app = target === "instagram" ? "Instagram" : target === "tiktok" ? "TikTok" : target === "facebook" ? "Facebook" : "";
      setNote(app ? `Picture saved. Open ${app} and post it from your photos.` : "Picture saved to your photos.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Couldn't share that. Try Save instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share">
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
