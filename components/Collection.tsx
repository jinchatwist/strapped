"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ShareBar } from "@/components/ShareBar";
import { listCollection, removeFromCollection, type Saved } from "@/lib/collection";

type Item = Saved & { url: string };
type Mode = "grid" | "view" | "select";

// "My collection": every try-on made on this phone. Tap one to see and share it again,
// or select several to delete at once.
export function Collection({
  onClose,
  backRef,
}: {
  onClose: () => void;
  // Set to a function the swipe-back gesture calls; it returns false when the collection itself should close.
  backRef?: RefObject<(() => boolean) | null>;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [mode, setMode] = useState<Mode>("grid");
  const [open, setOpen] = useState<Item | null>(null);
  // Select mode: the pictures ticked for deleting, and whether Delete was tapped once (it asks for a second tap).
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  // Which way the last swipe went, so the next picture slides in from that side.
  const [slide, setSlide] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

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
    if (mode === "select") {
      setConfirming(false);
      setSelected((sel) => (sel.includes(item.id) ? sel.filter((id) => id !== item.id) : [...sel, item.id]));
      return;
    }
    setSlide(null);
    setOpen(item);
    setMode("view");
  }

  async function remove(item: Item) {
    await removeFromCollection(item.id).catch(() => {});
    URL.revokeObjectURL(item.url);
    setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
    setOpen(null);
    setMode("grid");
  }

  function startSelect() {
    setSelected([]);
    setConfirming(false);
    setMode("select");
  }

  async function removeSelected() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const gone = new Set(selected);
    await Promise.all(selected.map((id) => removeFromCollection(id).catch(() => {})));
    items?.filter((i) => gone.has(i.id)).forEach((i) => URL.revokeObjectURL(i.url));
    setItems((list) => list?.filter((i) => !gone.has(i.id)) ?? null);
    setSelected([]);
    setConfirming(false);
    setMode("grid");
  }

  if (backRef) {
    backRef.current = () => {
      if (mode === "view" || mode === "select") setMode("grid");
      else return false;
      window.scrollTo({ top: 0 });
      return true;
    };
  }

  // Swipe left for the next picture, right for the one before (not from the very edge, which goes back).
  function step(dir: 1 | -1) {
    if (!items || !open) return;
    const i = items.findIndex((it) => it.id === open.id);
    const next = items[i + dir];
    if (!next) return;
    setSlide(dir === 1 ? "left" : "right");
    setOpen(next);
  }

  if (mode === "view" && open) {
    const index = items?.findIndex((it) => it.id === open.id) ?? 0;
    return (
      <>
        <div
          key={open.id}
          className={`coll-viewer ${slide ? `slide-${slide}` : ""}`}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = t.clientX > 28 ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x, dy = t.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
          }}
        >
          <ShareBar image={open.url} watch={open.watch} />
        </div>
        {items && items.length > 1 && (
          <div className="coll-pager">
            <button className="pager-btn" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous picture">‹</button>
            <span>{index + 1} / {items.length}</span>
            <button className="pager-btn" onClick={() => step(1)} disabled={index === items.length - 1} aria-label="Next picture">›</button>
          </div>
        )}
        <Line item={open} />
        <div className="row-links">
          <button className="link" onClick={() => setMode("grid")}>Back to my collection</button>
          <button className="link danger" onClick={() => remove(open)}>Delete</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="coll-head">
        <h2>{mode === "select" ? (selected.length ? `${selected.length} selected` : "Select pictures") : "My collection"}</h2>
        {items && items.length > 0 && mode === "grid" && (
          <div className="coll-actions">
            <button className="chip" onClick={startSelect}>Select</button>
          </div>
        )}
        {mode === "select" && items && (
          <div className="coll-actions">
            <button
              className="chip"
              onClick={() => { setConfirming(false); setSelected(selected.length === items.length ? [] : items.map((i) => i.id)); }}
            >
              {selected.length === items.length ? "None" : "All"}
            </button>
            <button className="chip" onClick={() => setMode("grid")}>Cancel</button>
          </div>
        )}
      </div>
      {items === null ? null : items.length === 0 ? (
        <div className="coll-empty">
          <strong>Nothing here yet</strong>
          <p>Every try-on you make is saved here on your phone, ready to share again.</p>
        </div>
      ) : (
        <div className="cards">
          {items.map((item) => (
            <button
              key={item.id}
              className={`wcard coll-card ${mode === "select" && selected.includes(item.id) ? "picked" : ""}`}
              onClick={() => tap(item)}
              aria-pressed={mode === "select" ? selected.includes(item.id) : undefined}
            >
              <span className="wcard-pic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={`${item.watch.model} on your wrist`} />
                {mode === "select" && <span className={`pick-check ${selected.includes(item.id) ? "on" : ""}`}>{selected.includes(item.id) ? "✓" : ""}</span>}
              </span>
              <span className="wcard-name">{item.watch.model}</span>
              <span className="wcard-price">{item.watch.brand} · {item.watch.caseMm} mm</span>
            </button>
          ))}
        </div>
      )}
      {mode === "select" ? (
        <div className="select-bar">
          <button className="cta danger-cta" disabled={!selected.length} onClick={removeSelected}>
            {confirming
              ? `Tap again to delete ${selected.length}`
              : `Delete${selected.length ? ` ${selected.length} ${selected.length === 1 ? "picture" : "pictures"}` : ""}`}
          </button>
        </div>
      ) : (
        <button className="cta" onClick={onClose}>Try on a watch</button>
      )}
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
