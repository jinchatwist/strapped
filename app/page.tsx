"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "@/data/catalog.json";
import { Logo } from "@/components/Logo";
import { ShareBar } from "@/components/ShareBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WatchFace } from "@/components/WatchFace";
import { WristCamera } from "@/components/WristCamera";
import { prepareImage, type ImagePayload } from "@/lib/image";
import type { Watch } from "@/lib/watch";

const WATCHES = catalog as Watch[];
const BRANDS = [...new Set(WATCHES.map((w) => w.brand))].sort((a, b) => a.localeCompare(b));

// Shown first, before any search. Picked by hand: the models people ask about most.
const POPULAR_IDS = [
  "rolex-submariner-date-black-126610ln",
  "rolex-cosmograph-daytona-white-panda-126500ln",
  "rolex-datejust-41-blue-jubilee-126334",
  "omega-speedmaster-moonwatch-professional-310-30-42-50-01-002",
  "ap-royal-oak-41-blue-15510st-oo-1320st-03",
  "patek-philippe-nautilus-5711-blue-5711-1a-010",
  "cartier-santos-de-cartier-large-wssa0018",
  "tudor-black-bay-58-m79030n-0001",
  "prx-powermatic-80-40mm-ice-blue-t137-407-11-351-00",
  "ga-2100-casioak-black-ga-2100-1a1",
];
const POPULAR = POPULAR_IDS.map((id) => WATCHES.find((w) => w.id === id)).filter((w): w is Watch => !!w);

type Step = "pick" | "photos" | "result";
type TryOnState = { status: "idle" | "loading" | "done" | "error"; image?: string; error?: string };

const SAVED_WRIST = "strapped-wrist";

function search(query: string, brand: string | null) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return WATCHES.filter((w) => {
    if (brand && w.brand !== brand) return false;
    const hay = `${w.brand} ${w.family} ${w.model} ${w.reference} ${w.family === "G-Shock" ? "gshock g shock" : ""} ${w.brand === "Audemars Piguet" ? "ap" : ""}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export default function Home() {
  const [step, setStep] = useState<Step>("pick");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);
  const [wrist, setWrist] = useState<ImagePayload | null>(null);
  const [watchPhoto, setWatchPhoto] = useState<ImagePayload | null>(null);
  const [tryOn, setTryOn] = useState<TryOnState>({ status: "idle" });
  const [error, setError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [camera, setCamera] = useState(false);
  // Only the latest try counts; a picture for an earlier watch is dropped.
  const attempt = useRef(0);

  // The wrist photo is kept on this phone so people can try many watches with one photo.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_WRIST);
      if (saved) setWrist(JSON.parse(saved).wrist);
    } catch {}
  }, []);

  const browsing = !query.trim() && !brand;
  const results = useMemo(() => (browsing ? POPULAR : search(query, brand)), [browsing, query, brand]);
  const shown = results.slice(0, 60);

  function pick(w: Watch) {
    setWatch(w);
    setWatchPhoto(null);
    setError("");
    window.scrollTo({ top: 0 });
    if (wrist) tryItOn(w, wrist, null);
    else setStep("photos");
  }

  async function lookup() {
    setLookingUp(true);
    setError("");
    try {
      const res = await fetch("/api/lookup", { method: "POST", body: JSON.stringify({ query }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      pick(json.watch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't look that one up.");
    } finally {
      setLookingUp(false);
    }
  }

  async function onWatchPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setWatchPhoto(await prepareImage(file));
      setError("");
    } catch {
      setError("Couldn't read that photo. Try a JPG or PNG.");
    }
  }

  function saveWrist(img: ImagePayload) {
    try {
      localStorage.setItem(SAVED_WRIST, JSON.stringify({ wrist: img }));
    } catch {}
  }

  async function tryItOn(w: Watch, wristImg: ImagePayload, productPhoto: ImagePayload | null) {
    const id = ++attempt.current;
    saveWrist(wristImg);
    setStep("result");
    setTryOn({ status: "loading" });
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        body: JSON.stringify({
          watch: w,
          wrist: { data: wristImg.data, mediaType: wristImg.mediaType },
          watchPhoto: productPhoto ? { data: productPhoto.data, mediaType: productPhoto.mediaType } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (id === attempt.current) setTryOn({ status: "done", image: json.image });
    } catch (e) {
      if (id === attempt.current) setTryOn({ status: "error", error: e instanceof Error ? e.message : "The try-on picture failed." });
    }
  }

  function startOver() {
    attempt.current++;
    setStep("pick");
    setError("");
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="app">
      <div className="top">
        <button className="brand" onClick={startOver} aria-label="Strapped home">
          <Logo size={30} /> Strapped
        </button>
        <ThemeToggle />
      </div>

      {step === "pick" && (
        <>
          <h1>Try a watch on</h1>
          {wrist && (
            <div className="saved">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wrist.preview} alt="Your saved wrist photo" />
              <span>Using your wrist photo</span>
              <button className="link" onClick={() => { setWatch(null); setStep("photos"); }}>Change</button>
            </div>
          )}
          <input
            id="search"
            className="search"
            type="search"
            placeholder="Search any watch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <div className="chips" role="group" aria-label="Brands">
            {BRANDS.map((b) => (
              <button key={b} className="chip" aria-pressed={brand === b} onClick={() => setBrand(brand === b ? null : b)}>
                {b}
              </button>
            ))}
          </div>
          <span className="count">
            {browsing ? "Most popular" : `${results.length} ${results.length === 1 ? "watch" : "watches"}`}
          </span>
          <div className="list">
            {shown.map((w) => (
              <button key={w.id} className="row" onClick={() => pick(w)}>
                <WatchFace watch={w} size={56} />
                <span style={{ minWidth: 0 }}>
                  <span className="name" style={{ display: "block" }}>{w.model}</span>
                  <span className="meta">{w.brand}</span>
                </span>
                <span className="mm">{formatPrice(w.priceUsd)}</span>
              </button>
            ))}
            {query.trim().length > 1 && (
              <button className="lookup" onClick={lookup} disabled={lookingUp}>
                <strong>{lookingUp ? "Looking it up…" : `Not here? Look up “${query.trim()}”`}</strong>
                <span>Any watch, by name or reference number.</span>
              </button>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </>
      )}

      {step === "photos" && (
        <>
          {watch && (
            <div className="card picked">
              <WatchFace watch={watch} size={64} />
              <div style={{ minWidth: 0 }}>
                <h2>{watch.model}</h2>
                <button className="link" onClick={startOver}>Pick a different watch</button>
              </div>
            </div>
          )}
          <button className={`drop wide ${wrist ? "filled" : ""}`} onClick={() => setCamera(true)}>
            {wrist ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wrist.preview} alt="Your wrist" />
                <span className="badge">Tap to retake</span>
              </>
            ) : (
              <>
                <span className="label">Snap your wrist</span>
                <span className="hint">We&apos;ll show you where to hold it</span>
              </>
            )}
          </button>
          {watch && (
            <label className={`addwatch ${watchPhoto ? "filled" : ""}`}>
              {watchPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={watchPhoto.preview} alt="Watch photo" />
              ) : (
                <span className="plus">+</span>
              )}
              <span>
                <strong>{watchPhoto ? "Watch photo added" : "Add a photo of the watch"}</strong>
                <small>Optional. Makes the picture match better.</small>
              </span>
              <input type="file" accept="image/*" onChange={(e) => onWatchPhoto(e.target.files?.[0])} />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          {watch ? (
            <button className="cta" disabled={!wrist} onClick={() => wrist && tryItOn(watch, wrist, watchPhoto)}>
              Put it on my wrist
            </button>
          ) : (
            <button className="cta" disabled={!wrist} onClick={() => { if (wrist) saveWrist(wrist); startOver(); }}>
              Save and pick a watch
            </button>
          )}
        </>
      )}

      {step === "result" && watch && (
        <>
          <TryOn state={tryOn} fallback={wrist?.preview} onRetry={() => wrist && tryItOn(watch, wrist, watchPhoto)} />
          <div className="result-line">
            <div style={{ minWidth: 0 }}>
              <h2>{watch.model}</h2>
              <div className="sub">{watch.brand}</div>
            </div>
            {watch.priceUsd > 0 && <div className="price">{formatPrice(watch.priceUsd)}</div>}
          </div>
          {tryOn.status === "done" && tryOn.image && <ShareBar image={tryOn.image} watch={watch} />}
          <button className="cta" onClick={startOver}>Try another watch</button>
        </>
      )}

      {camera && (
        <WristCamera
          onClose={() => setCamera(false)}
          onDone={(photo) => {
            setWrist(photo);
            setError("");
            setCamera(false);
          }}
        />
      )}
    </main>
  );
}

function formatPrice(usd: number) {
  return usd > 0 ? `$${usd.toLocaleString("en-US")}` : "";
}

function TryOn({ state, fallback, onRetry }: { state: TryOnState; fallback?: string; onRetry: () => void }) {
  if (state.status === "idle") return null;
  return (
    <figure className="tryon">
      {state.status === "done" && state.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.image} alt="AI preview of the watch on your wrist" />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {fallback && <img src={fallback} alt="Your wrist" className="dim" />}
          <span className="tryon-note">
            {state.status === "loading" ? (
              <>
                <span className="spin"><Logo size={28} /></span> Putting it on your wrist…
              </>
            ) : (
              <span className="tryon-error">
                {state.error}
                <button className="ghost" onClick={onRetry}>Try again</button>
              </span>
            )}
          </span>
        </>
      )}
      {state.status === "done" && <figcaption>AI preview</figcaption>}
    </figure>
  );
}
