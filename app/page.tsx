"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "@/data/catalog.json";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WatchFace } from "@/components/WatchFace";
import type { FitResult } from "@/lib/fit";
import { prepareImage, type ImagePayload } from "@/lib/image";
import type { Watch } from "@/lib/watch";

const WATCHES = catalog as Watch[];
const BRANDS = ["G-Shock", "Rolex", "Omega", "Cartier", "AP", "Seiko", "Tudor", "Tissot", "Casio", "Apple"];
const BRAND_MATCH: Record<string, (w: Watch) => boolean> = {
  "G-Shock": (w) => w.family === "G-Shock",
  AP: (w) => w.brand === "Audemars Piguet",
  Casio: (w) => w.brand === "Casio" && w.family !== "G-Shock",
};

type Step = "pick" | "photos" | "result";

const SAVED_WRIST = "strapped-wrist";

// With no search, mix brands so the first screen isn't all one brand.
const MIXED = (() => {
  const byBrand = new Map<string, Watch[]>();
  for (const w of WATCHES) byBrand.set(w.brand, [...(byBrand.get(w.brand) ?? []), w]);
  const out: Watch[] = [];
  const first = ["Rolex", "Casio", "Omega", "Cartier", "Audemars Piguet", "Seiko", "Tudor", "Tissot", "Patek Philippe", "Apple"];
  const rank = (b: string) => (first.includes(b) ? first.indexOf(b) : first.length);
  const lists = [...byBrand.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([, l]) => l);
  for (let i = 0; out.length < WATCHES.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
})();

function search(query: string, brand: string | null) {
  if (!query.trim() && !brand) return MIXED;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return WATCHES.filter((w) => {
    if (brand && !(BRAND_MATCH[brand]?.(w) ?? w.brand === brand)) return false;
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
  const [outfit, setOutfit] = useState<ImagePayload | null>(null);
  const [watchPhoto, setWatchPhoto] = useState<ImagePayload | null>(null);
  const [tryOn, setTryOn] = useState<{ status: "idle" | "loading" | "done" | "error"; image?: string; error?: string }>({ status: "idle" });
  const [result, setResult] = useState<FitResult | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  // Only the latest try counts; answers from an earlier watch are dropped.
  const attempt = useRef(0);

  // The wrist photo is kept on this phone so people can try many watches with one photo.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_WRIST);
      if (saved) {
        setWrist(JSON.parse(saved).wrist);
      }
    } catch {}
  }, []);

  const results = useMemo(() => search(query, brand), [query, brand]);
  const shown = results.slice(0, 60);

  function pick(w: Watch) {
    setWatch(w);
    setWatchPhoto(null);
    setError("");
    window.scrollTo({ top: 0 });
    if (wrist) check(w, wrist, null);
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

  async function onPhoto(file: File | undefined, set: (p: ImagePayload) => void) {
    if (!file) return;
    try {
      set(await prepareImage(file));
      setError("");
    } catch {
      setError("Couldn't read that photo. Try a JPG or PNG.");
    }
  }

  async function check(w: Watch, wristImg: ImagePayload, productPhoto: ImagePayload | null) {
    const id = ++attempt.current;
    setStep("result");
    setResult(null);
    setError("");
    window.scrollTo({ top: 0 });
    saveWrist(wristImg);
    makeTryOn(id, w, wristImg, productPhoto);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        body: JSON.stringify({
          watch: w,
          wrist: { data: wristImg.data, mediaType: wristImg.mediaType },
          outfit: outfit ? { data: outfit.data, mediaType: outfit.mediaType } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (id !== attempt.current) return;
      setResult(json.result);
      setDemo(json.demo);
    } catch (e) {
      if (id !== attempt.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  // Runs alongside the fit check; the result screen shows it when it arrives.
  async function makeTryOn(id: number, w: Watch, wristImg: ImagePayload, productPhoto: ImagePayload | null) {
    setTryOn({ status: "loading" });
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
      if (id !== attempt.current) return;
      setTryOn({ status: "done", image: json.image });
    } catch (e) {
      if (id !== attempt.current) return;
      setTryOn({ status: "error", error: e instanceof Error ? e.message : "The try-on preview failed." });
    }
  }

  function saveWrist(img: ImagePayload) {
    try {
      localStorage.setItem(SAVED_WRIST, JSON.stringify({ wrist: img }));
    } catch {}
  }

  function startOver() {
    attempt.current++;
    setStep("pick");
    setResult(null);
    setError("");
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="app">
      <div className="top">
        <button className="brand" onClick={startOver} aria-label="Strapped home">
          <Logo size={30} /> Strapped
        </button>
        <div className="top-right">
          <ThemeToggle />
          <span className="steps">
            {step === "pick" ? "1 of 3" : step === "photos" ? "2 of 3" : "3 of 3"}
          </span>
        </div>
      </div>

      {step === "pick" && (
        <>
          <div>
            <h1>Will it suit you?</h1>
            <p className="sub">Pick a watch. We&apos;ll put it on your wrist.</p>
          </div>
          {wrist && (
            <div className="saved">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wrist.preview} alt="Your saved wrist photo" />
              <span>Using your saved wrist photo</span>
              <button className="link" onClick={() => { setWatch(null); setStep("photos"); }}>Change</button>
            </div>
          )}
          <input
            id="search"
            className="search"
            type="search"
            placeholder="Try “G-Shock” or “Submariner”"
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
            {results.length} {results.length === 1 ? "watch" : "watches"}
            {results.length > shown.length ? `, showing ${shown.length}` : ""}
          </span>
          <div className="list">
            {shown.map((w) => (
              <button key={w.id} className="row" onClick={() => pick(w)}>
                <WatchFace watch={w} size={56} />
                <span style={{ minWidth: 0 }}>
                  <span className="name" style={{ display: "block" }}>{w.model}</span>
                  <span className="meta">{w.brand} · {w.reference}</span>
                </span>
                <span className="mm">{w.caseMm} mm</span>
              </button>
            ))}
            {query.trim().length > 1 && (
              <button className="lookup" onClick={lookup} disabled={lookingUp}>
                <strong>{lookingUp ? "Looking it up…" : `Not here? Look up “${query.trim()}”`}</strong>
                <span>We&apos;ll find the specs for any watch by name or reference number.</span>
              </button>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </>
      )}

      {step === "photos" && (
        <>
          {watch && <div className="card">
            <div className="picked">
              <WatchFace watch={watch} size={80} />
              <div style={{ minWidth: 0 }}>
                <h2>{watch.model}</h2>
                <div className="sub" style={{ fontSize: 14 }}>{watch.brand} · {watch.reference}</div>
              </div>
            </div>
            <div className="specs">
              <span className="tag">{watch.caseMm} mm case</span>
              <span className="tag">{watch.lugMm} mm lug to lug</span>
              <span className="tag">{watch.thicknessMm} mm thick</span>
              <span className="tag">{watch.strap}</span>
              {watch.custom && <span className="tag">Specs looked up by AI</span>}
            </div>
            <button className="link" onClick={startOver}>Pick a different watch</button>
          </div>}

          <div>
            <h2>Now show us you</h2>
            <p className="sub">A clear photo of your bare wrist from above works best.</p>
          </div>
          <div className="photos">
            <PhotoBox label="Your wrist" hint="Required, saved for next time" photo={wrist} capture="environment" onFile={(f) => onPhoto(f, setWrist)} />
            <PhotoBox label="Your outfit" hint="Optional, helps with style" photo={outfit} capture="user" onFile={(f) => onPhoto(f, setOutfit)} />
          </div>
          {watch && <label className={`addwatch ${watchPhoto ? "filled" : ""}`}>
            {watchPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={watchPhoto.preview} alt="Watch photo" />
            ) : (
              <span className="plus">+</span>
            )}
            <span>
              <strong>{watchPhoto ? "Watch photo added" : "Have a photo of the watch?"}</strong>
              <small>Optional. A store or product shot makes the try-on picture match better.</small>
            </span>
            <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0], setWatchPhoto)} />
          </label>}
          {error && <p className="error">{error}</p>}
          {watch ? (
            <button className="cta" disabled={!wrist} onClick={() => wrist && check(watch, wrist, watchPhoto)}>
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
          <TryOn state={tryOn} fallback={wrist?.preview} />
          <div className="card">
            <div className="picked-line">
              <div style={{ minWidth: 0 }}>
                <h2>{watch.model}</h2>
                <div className="sub" style={{ fontSize: 14 }}>{watch.brand} · {watch.caseMm} mm</div>
              </div>
              {watch.priceUsd > 0 && (
                <div className="price">
                  ${watch.priceUsd.toLocaleString("en-US")}
                  <small>about, new</small>
                </div>
              )}
            </div>
            {result ? (
              <>
                {result.works.length > 0 && (
                  <div className="points">
                    <div className="k good">What works</div>
                    <ul>{result.works.map((t) => <li key={t} className="good">{t}</li>)}</ul>
                  </div>
                )}
                {result.doesnt.length > 0 && (
                  <div className="points">
                    <div className="k bad">What doesn&apos;t</div>
                    <ul>{result.doesnt.map((t) => <li key={t} className="bad">{t}</li>)}</ul>
                  </div>
                )}
                {demo && <div className="demo">Demo notes. Add an Anthropic API key to check real photos.</div>}
              </>
            ) : error ? (
              <p className="error">{error}</p>
            ) : (
              <p className="sub thinking">Looking at how it sits on you…</p>
            )}
          </div>
          <button className="cta" onClick={startOver}>Try another watch</button>
          <button className="link center" onClick={() => setStep("photos")}>Use a different wrist photo</button>
        </>
      )}
    </main>
  );
}

function PhotoBox({
  label,
  hint,
  photo,
  capture,
  onFile,
}: {
  label: string;
  hint: string;
  photo: ImagePayload | null;
  capture: "user" | "environment";
  onFile: (f: File | undefined) => void;
}) {
  return (
    <label className={`drop ${photo ? "filled" : ""}`}>
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt={label} />
          <span className="badge">{label} · tap to change</span>
        </>
      ) : (
        <>
          <span className="label">{label}</span>
          <span className="hint">{hint}</span>
        </>
      )}
      <input type="file" accept="image/*" capture={capture} onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}

function TryOn({ state, fallback }: { state: { status: string; image?: string; error?: string }; fallback?: string }) {
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
              state.error
            )}
          </span>
        </>
      )}
      {state.status === "done" && <figcaption>AI preview, not a real photo</figcaption>}
    </figure>
  );
}
