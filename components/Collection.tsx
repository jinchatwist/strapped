"use client";

import { useEffect, useState, type RefObject } from "react";
import { BuyButton } from "@/components/BuyButton";
import { ShareBar, download, isIOS } from "@/components/ShareBar";
import { track } from "@/lib/beta";
import { listCollection, removeFromCollection, type Saved } from "@/lib/collection";

type Item = Saved & { url: string };
type Mode = "grid" | "view" | "pick" | "compare";

// "My collection": every try-on made on this phone. Tap one to see and share it again,
// or pick two to see them side by side.
export function Collection({
  startCompare,
  preselect,
  onClose,
  backRef,
}: {
  startCompare?: boolean;
  preselect?: string;
  onClose: () => void;
  // Set to a function the swipe-back gesture calls; it returns false when the collection itself should close.
  backRef?: RefObject<(() => boolean) | null>;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [mode, setMode] = useState<Mode>(startCompare ? "pick" : "grid");
  const [open, setOpen] = useState<Item | null>(null);
  const [picked, setPicked] = useState<string[]>(preselect ? [preselect] : []);

  useEffect(() => {
    let urls: string[] = [];
    listCollection()
      .then((all) => {
        const list = all.map((s) => ({ ...s, url: URL.createObjectURL(s.image) }));
        urls = list.map((i) => i.url);
        setItems(list);
      })
      .catch(() => setItems([]));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function tap(item: Item) {
    if (mode === "pick") {
      const next = picked.includes(item.id) ? picked.filter((p) => p !== item.id) : [...picked, item.id].slice(-2);
      setPicked(next);
      if (next.length === 2) {
        track("compare_open");
        setMode("compare");
      }
      return;
    }
    setOpen(item);
    setMode("view");
  }

  async function remove(item: Item) {
    await removeFromCollection(item.id).catch(() => {});
    URL.revokeObjectURL(item.url);
    setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
    setPicked((p) => p.filter((id) => id !== item.id));
    setOpen(null);
    setMode("grid");
  }

  if (backRef) {
    backRef.current = () => {
      if (mode === "view") setMode("grid");
      else if (mode === "compare") { setPicked([]); setMode("pick"); }
      else if (mode === "pick" && !startCompare) { setPicked([]); setMode("grid"); }
      else return false;
      window.scrollTo({ top: 0 });
      return true;
    };
  }

  const pair = picked.map((id) => items?.find((i) => i.id === id)).filter((i): i is Item => !!i);

  if (mode === "view" && open) {
    return (
      <>
        <ShareBar image={open.url} watch={open.watch} />
        <Line item={open} />
        <BuyButton watch={open.watch} />
        <button className="ghost" onClick={() => { setPicked([open.id]); setMode("pick"); }}>Compare with another</button>
        <div className="row-links">
          <button className="link" onClick={() => setMode("grid")}>Back to my collection</button>
          <button className="link danger" onClick={() => remove(open)}>Delete</button>
        </div>
      </>
    );
  }

  if (mode === "compare" && pair.length === 2) {
    return <Compare a={pair[0]} b={pair[1]} onBack={() => { setPicked([]); setMode("pick"); }} onDone={onClose} />;
  }

  return (
    <>
      <div className="coll-head">
        <h2>{mode === "pick" ? "Compare two watches" : "My collection"}</h2>
        {items && items.length > 1 && mode === "grid" && (
          <button className="chip" onClick={() => { setPicked([]); setMode("pick"); }}>Compare</button>
        )}
        {mode === "pick" && (
          <button className="chip" onClick={() => { setPicked([]); setMode("grid"); }}>Cancel</button>
        )}
      </div>
      {mode === "pick" && items && items.length > 1 && (
        <p className="count">{picked.length === 0 ? "Pick two try-ons." : "Now pick one more."}</p>
      )}
      {items === null ? null : items.length < (mode === "pick" ? 2 : 1) ? (
        <div className="coll-empty">
          <strong>{items.length === 0 ? "Nothing here yet" : "Try on one more watch"}</strong>
          <p>
            {mode === "pick"
              ? "Compare needs two try-ons. Every picture you make is saved here, so try on another watch and come back."
              : "Every try-on you make is saved here on your phone, ready to share again or compare."}
          </p>
        </div>
      ) : (
        <div className="cards">
          {items.map((item) => (
            <button
              key={item.id}
              className={`wcard coll-card ${picked.includes(item.id) ? "picked" : ""}`}
              onClick={() => tap(item)}
              aria-pressed={mode === "pick" ? picked.includes(item.id) : undefined}
            >
              <span className="wcard-pic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={`${item.watch.model} on your wrist`} />
                {mode === "pick" && picked.includes(item.id) && <span className="pick-num">{picked.indexOf(item.id) + 1}</span>}
              </span>
              <span className="wcard-name">{item.watch.model}</span>
              <span className="wcard-price">{item.watch.brand} · {item.watch.caseMm} mm</span>
            </button>
          ))}
        </div>
      )}
      <button className="cta" onClick={onClose}>Try on a watch</button>
    </>
  );
}

function Line({ item }: { item: Item }) {
  return (
    <div className="result-line">
      <div style={{ minWidth: 0 }}>
        <h2>{item.watch.model}</h2>
        <div className="sub">{item.watch.brand} · {item.watch.caseMm} mm</div>
      </div>
      {item.watch.priceUsd > 0 && <div className="price">${item.watch.priceUsd.toLocaleString("en-US")}</div>}
    </div>
  );
}

function Compare({ a, b, onBack, onDone }: { a: Item; b: Item; onBack: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function share() {
    track("compare_share");
    setBusy(true);
    setNote("");
    try {
      const file = await compareCard(a, b);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(isIOS() ? { files: [file] } : { files: [file], text: "Which one? Made with Strapped" });
      } else {
        download(file);
        setNote("Saved to your gallery.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Couldn't share that.");
    } finally {
      setBusy(false);
    }
  }

  const sides = [a, b];
  return (
    <>
      <h2 className="compare-title">Which one?</h2>
      <div className="compare">
        {sides.map((s) => (
          <div key={s.id} className="compare-side">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt={`${s.watch.model} on your wrist`} />
            <span className="compare-brand">{s.watch.brand}</span>
            <strong className="compare-name">{s.watch.model.replace(new RegExp(`^${s.watch.brand}\\s+`), "")}</strong>
            <span className="compare-stat">{s.watch.caseMm} mm{s.watch.lugMm > 0 ? ` · ${s.watch.lugMm} lug` : ""}</span>
            {s.watch.priceUsd > 0 && <span className="compare-stat">${s.watch.priceUsd.toLocaleString("en-US")}</span>}
            <BuyButton watch={s.watch} small />
          </div>
        ))}
      </div>
      <button className="ghost" onClick={share} disabled={busy}>Share the pair</button>
      {note && <p className="share-note">{note}</p>}
      <div className="row-links">
        <button className="link" onClick={onBack}>Pick two others</button>
        <button className="link" onClick={onDone}>Done</button>
      </div>
    </>
  );
}

// A 4:5 picture with both try-ons side by side and each watch's name and numbers underneath.
async function compareCard(a: Item, b: Item): Promise<File> {
  const W = 1080, H = 1350, half = W / 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  for (const [i, s] of [a, b].entries()) {
    const img = new Image();
    img.src = s.url;
    await img.decode();
    const scale = Math.max(half / img.width, H / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * half, 0, half, H);
    ctx.clip();
    ctx.drawImage(img, i * half + (half - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, H - 420, 0, H);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(0.5, "rgba(0,0,0,.6)");
  shade.addColorStop(1, "rgba(0,0,0,.85)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, H - 420, W, 420);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(half - 2, 0, 4, H);
  ctx.font = "italic 500 40px Georgia, serif";
  ctx.textBaseline = "top";
  ctx.fillText("Strapped", 40, 36);
  [a, b].forEach((s, i) => {
    const x = i * half + 40, max = half - 80;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ff5a36";
    ctx.font = "600 26px Rubik, system-ui, sans-serif";
    ctx.fillText(s.watch.brand.toUpperCase(), x, H - 200);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 40px Rubik, system-ui, sans-serif";
    ctx.fillText(clip(ctx, s.watch.model.replace(new RegExp(`^${s.watch.brand}\\s+`), ""), max), x, H - 150);
    ctx.font = "500 30px Rubik, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    const price = s.watch.priceUsd > 0 ? ` · $${s.watch.priceUsd.toLocaleString("en-US")}` : "";
    ctx.fillText(clip(ctx, `${s.watch.caseMm} mm${price}`, max), x, H - 96);
  });
  const blob = await new Promise<Blob>((done) => canvas.toBlob((bl) => done(bl!), "image/jpeg", 0.92));
  return new File([blob], "strapped-compare.jpg", { type: "image/jpeg" });
}

function clip(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
