"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "@/data/catalog.json";
import { Feedback } from "@/components/Feedback";
import { Logo } from "@/components/Logo";
import { ShareBar } from "@/components/ShareBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WatchPic } from "@/components/WatchPic";
import { WristCamera } from "@/components/WristCamera";
import { betaHeaders, rememberCode, track } from "@/lib/beta";
import { prepareImage, type ImagePayload } from "@/lib/image";
import type { Watch } from "@/lib/watch";

// Only the brands people want most right now; the rest of the catalog stays in the data file for later.
const BRANDS = [
  "Audemars Piguet", "Breitling", "Cartier", "Casio", "Hamilton", "Omega",
  "Patek Philippe", "Rolex", "Seiko", "TAG Heuer", "Tissot", "Tudor",
];
const WATCHES = (catalog as Watch[]).filter((w) => BRANDS.includes(w.brand));

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
type TryOnState = { status: "idle" | "loading" | "done" | "error"; image?: string; error?: string; limit?: boolean };

// Older versions kept the wrist photo on the phone; it now lasts only until the app is closed.
const OLD_SAVED_WRIST = "strapped-wrist";

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
  const [feedback, setFeedback] = useState(false);
  // Free try-ons left for this person during the beta; null until the server answers.
  const [left, setLeft] = useState<number | null>(null);
  // Only the latest try counts; a picture for an earlier watch is dropped.
  const attempt = useRef(0);

  useEffect(() => {
    try {
      localStorage.removeItem(OLD_SAVED_WRIST);
    } catch {}
    rememberCode();
    track("visit");
    fetch("/api/tryon", { headers: betaHeaders() })
      .then((r) => r.json())
      .then((j) => typeof j.left === "number" && setLeft(j.left))
      .catch(() => {});
  }, []);

  const browsing = !query.trim() && !brand;
  const results = useMemo(() => (browsing ? POPULAR : search(query, brand)), [browsing, query, brand]);
  const shown = results.slice(0, 60);

  function pick(w: Watch) {
    track("watch_open");
    setWatch(w);
    setWatchPhoto(null);
    setError("");
    window.scrollTo({ top: 0 });
    setStep("photos");
  }

  async function lookup() {
    setLookingUp(true);
    setError("");
    try {
      const res = await fetch("/api/lookup", { method: "POST", headers: betaHeaders(), body: JSON.stringify({ query }) });
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

  async function tryItOn(w: Watch, wristImg: ImagePayload, productPhoto: ImagePayload | null) {
    const id = ++attempt.current;
    setStep("result");
    setTryOn({ status: "loading" });
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: betaHeaders(),
        body: JSON.stringify({
          watch: w,
          wrist: { data: wristImg.data, mediaType: wristImg.mediaType },
          watchPhoto: productPhoto ? { data: productPhoto.data, mediaType: productPhoto.mediaType } : undefined,
        }),
      });
      const json = await res.json();
      if (typeof json.left === "number") setLeft(json.left);
      if (json.limit) {
        if (id === attempt.current) setTryOn({ status: "error", error: json.error, limit: true });
        return;
      }
      if (!res.ok) throw new Error(json.error);
      if (id === attempt.current) setTryOn({ status: "done", image: json.image });
    } catch (e) {
      if (id === attempt.current) setTryOn({ status: "error", error: e instanceof Error ? e.message : "The try-on picture failed." });
    }
  }

  function openCamera() {
    track("camera_open");
    setCamera(true);
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
          <Logo size={30} /> <span className="wordmark">Strapped</span>
        </button>
        <ThemeToggle />
      </div>

      {step === "pick" && (
        <>
          <input
            id="search"
            className="search"
            type="search"
            placeholder="Search any watch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {wrist && (
            <div className="saved">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wrist.preview} alt="Your saved wrist photo" />
              <span>Using your wrist photo</span>
              <button className="link" onClick={() => { setWatch(null); setStep("photos"); }}>Change</button>
            </div>
          )}
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
          <div className="cards">
            {shown.map((w) => (
              <button key={w.id} className="wcard" onClick={() => pick(w)}>
                <span className="wcard-pic"><WatchPic watch={w} size={120} /></span>
                <span className="wcard-name">{w.model}</span>
                <span className="wcard-price">{w.caseMm} mm</span>
              </button>
            ))}
          </div>
          {query.trim().length > 1 && (
            <button className="lookup" onClick={lookup} disabled={lookingUp}>
              <strong>{lookingUp ? "Looking it up…" : `Not here? Look up “${query.trim()}”`}</strong>
              <span>Any watch, by name or reference number.</span>
            </button>
          )}
          {error && <p className="error">{error}</p>}
          <button className="link feedback-link" onClick={() => setFeedback(true)}>Send feedback</button>
        </>
      )}

      {step === "photos" && (
        <>
          {watch ? (
            <>
              <div className="detail-pic"><WatchPic watch={watch} size={220} /></div>
              <div className="result-line">
                <div style={{ minWidth: 0 }}>
                  <h2>{watch.model}</h2>
                  <div className="sub">{watch.brand} · {watch.caseMm} mm</div>
                </div>
                {watch.priceUsd > 0 && <div className="price">{formatPrice(watch.priceUsd)}</div>}
              </div>
              <button className={`addwatch ${wrist ? "filled" : ""}`} onClick={openCamera}>
                {wrist ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={wrist.preview} alt="Your wrist" />
                ) : (
                  <span className="plus">+</span>
                )}
                <span>
                  <strong>{wrist ? "Your wrist photo" : "Snap your wrist"}</strong>
                  <small>{wrist ? "Tap to retake." : "We'll show you where to hold it."}</small>
                </span>
              </button>
            </>
          ) : (
            <button className={`drop wide ${wrist ? "filled" : ""}`} onClick={openCamera}>
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
          )}
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
            <>
              <button className="cta" disabled={!wrist || left === 0} onClick={() => wrist && tryItOn(watch, wrist, watchPhoto)}>
                Generate
              </button>
              {left !== null && left < 100 && (
                <p className="left-note">
                  {left === 0 ? "You've used all your free try-ons." : `${left} free ${left === 1 ? "try-on" : "try-ons"} left`}
                </p>
              )}
              <button className="link back" onClick={startOver}>Pick a different watch</button>
            </>
          ) : (
            <button className="cta" disabled={!wrist} onClick={startOver}>
              Pick a watch
            </button>
          )}
        </>
      )}

      {step === "result" && watch && (
        <>
          {tryOn.status === "done" && tryOn.image ? (
            <ShareBar image={tryOn.image} watch={watch} />
          ) : (
            <>
              {tryOn.limit ? (
                <div className="limit-box">
                  <strong>{tryOn.error}</strong>
                  <p>Paid packs are coming soon. Tell us what you thought while it&apos;s fresh?</p>
                  <button className="ghost" onClick={() => setFeedback(true)}>Give feedback</button>
                </div>
              ) : (
                <TryOn state={tryOn} fallback={wrist?.preview} onRetry={() => wrist && tryItOn(watch, wrist, watchPhoto)} />
              )}
              <div className="result-line">
                <div style={{ minWidth: 0 }}>
                  <h2>{watch.model}</h2>
                  <div className="sub">{watch.brand} · {watch.caseMm} mm</div>
                </div>
                {watch.priceUsd > 0 && <div className="price">{formatPrice(watch.priceUsd)}</div>}
              </div>
            </>
          )}
          {tryOn.status === "done" && (
            <button className="ghost" onClick={() => setFeedback(true)}>How did it look? Tell us</button>
          )}
          <button className="cta" onClick={() => { track("try_another"); startOver(); }}>Try another watch</button>
        </>
      )}

      {feedback && <Feedback watch={watch ? `${watch.brand} ${watch.model}` : undefined} onClose={() => setFeedback(false)} />}

      {camera && (
        <WristCamera
          onClose={() => setCamera(false)}
          onDone={(photo) => {
            track("wrist_ok");
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
