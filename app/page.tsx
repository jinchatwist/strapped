"use client";

import { useMemo, useState } from "react";
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

type Step = "pick" | "photos" | "checking" | "result";

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
  const [wristCm, setWristCm] = useState("");
  const [result, setResult] = useState<FitResult | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const results = useMemo(() => search(query, brand), [query, brand]);
  const shown = results.slice(0, 60);

  function pick(w: Watch) {
    setWatch(w);
    setWatchPhoto(null);
    setError("");
    setStep("photos");
    window.scrollTo({ top: 0 });
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

  async function check() {
    if (!watch || !wrist) return;
    setStep("checking");
    setError("");
    const cm = parseFloat(wristCm);
    const wristSize = cm > 10 && cm < 30 ? cm : undefined;
    makeTryOn(watch, wrist, wristSize);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        body: JSON.stringify({
          watch,
          wrist: { data: wrist.data, mediaType: wrist.mediaType },
          outfit: outfit ? { data: outfit.data, mediaType: outfit.mediaType } : undefined,
          wristCm: wristSize,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.result);
      setDemo(json.demo);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setStep("photos");
    }
  }

  // Runs alongside the fit check; the result screen shows it when it arrives.
  async function makeTryOn(w: Watch, wristImg: ImagePayload, wristSize?: number) {
    setTryOn({ status: "loading" });
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        body: JSON.stringify({
          watch: w,
          wrist: { data: wristImg.data, mediaType: wristImg.mediaType },
          watchPhoto: watchPhoto ? { data: watchPhoto.data, mediaType: watchPhoto.mediaType } : undefined,
          wristCm: wristSize,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTryOn({ status: "done", image: json.image });
    } catch (e) {
      setTryOn({ status: "error", error: e instanceof Error ? e.message : "The try-on preview failed." });
    }
  }

  function startOver() {
    setStep("pick");
    setResult(null);
    setError("");
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
            <p className="sub">Find the watch you&apos;re eyeing. Then snap your wrist.</p>
          </div>
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

      {step === "photos" && watch && (
        <>
          <div className="card">
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
          </div>

          <div>
            <h2>Now show us you</h2>
            <p className="sub">A clear photo of your bare wrist from above works best.</p>
          </div>
          <div className="photos">
            <PhotoBox label="Your wrist" hint="Required" photo={wrist} capture="environment" onFile={(f) => onPhoto(f, setWrist)} />
            <PhotoBox label="Your outfit" hint="Optional, helps with style" photo={outfit} capture="user" onFile={(f) => onPhoto(f, setOutfit)} />
          </div>
          <label className={`addwatch ${watchPhoto ? "filled" : ""}`}>
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
          </label>
          <div className="card">
            <div className="field">
              <label htmlFor="wrist-cm">
                Wrist size
                <small>Optional. Wrap a string around it and measure.</small>
              </label>
              <input
                id="wrist-cm"
                inputMode="decimal"
                placeholder="cm"
                value={wristCm}
                onChange={(e) => setWristCm(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="cta" disabled={!wrist} onClick={check}>
            Check my fit
          </button>
        </>
      )}

      {step === "checking" && (
        <div className="loading">
          <span className="spin"><Logo size={48} /></span>
          Checking how it fits…
        </div>
      )}

      {step === "result" && watch && result && (
        <>
          <TryOn state={tryOn} fallback={wrist?.preview} />
          <div className="card">
            <div className="score">
              <ScoreRing score={result.score} />
              <div style={{ minWidth: 0 }}>
                <p className="verdict">{result.verdict}</p>
                <div className="sub" style={{ fontSize: 14 }}>{watch.model}</div>
              </div>
            </div>
            <div className="line">
              <div className="k">
                Size <span className={`pill ${tone(result.size.rating)}`}>{result.size.rating}</span>
              </div>
              <span className="sub" style={{ margin: 0 }}>{result.size.comment}</span>
            </div>
            <div className="line">
              <div className="k">
                Style <span className={`pill ${tone(result.style.rating)}`}>{result.style.rating}</span>
              </div>
              <span className="sub" style={{ margin: 0 }}>{result.style.comment}</span>
            </div>
            {result.tips.length > 0 && (
              <div className="line">
                <div className="k">Tips</div>
                <ul className="tips">
                  {result.tips.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            )}
            {demo && <div className="demo">This is a demo result. Add an Anthropic API key to check real photos.</div>}
          </div>
          <button className="cta" onClick={startOver}>Try another watch</button>
          <button className="ghost" onClick={() => setStep("photos")}>Change my photos</button>
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

function ScoreRing({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = 42;
  const len = 2 * Math.PI * r;
  const color = s >= 75 ? "var(--good)" : s >= 50 ? "var(--ok)" : "var(--bad)";
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`Fit score ${s} out of 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(len * s) / 100} ${len}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="58" textAnchor="middle" fontSize="26">{s}</text>
    </svg>
  );
}

function tone(rating: string) {
  if (rating === "Just right" || rating === "Great match") return "good";
  if (rating === "Works") return "ok";
  return "bad";
}
