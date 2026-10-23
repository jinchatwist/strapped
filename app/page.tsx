"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "@/data/catalog.json";
import { BuyButton } from "@/components/BuyButton";
import { Collection } from "@/components/Collection";
import { Feedback } from "@/components/Feedback";
import { Logo } from "@/components/Logo";
import { ShareBar } from "@/components/ShareBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WatchPic } from "@/components/WatchPic";
import { WristCamera } from "@/components/WristCamera";
import { betaHeaders, rememberCode, track } from "@/lib/beta";
import { addToCollection, listCollection } from "@/lib/collection";
import type { ImagePayload } from "@/lib/image";
import type { Watch } from "@/lib/watch";
import { inches, WRIST_SIZES, type WristSize } from "@/lib/wrist";

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

type Step = "pick" | "photos" | "result" | "collection";
// timing: seconds spent waiting in total and on the picture itself (beta only).
type TryOnState = {
  status: "idle" | "loading" | "done" | "error";
  image?: string;
  error?: string;
  limit?: boolean;
  timing?: { total: number; ai: number };
};

// Older versions kept the wrist photo on the phone; it now lasts only until the app is closed.
const OLD_SAVED_WRIST = "strapped-wrist";
const WRIST_SIZE_KEY = "strapped-wrist-size";

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
  // Set when someone arrives from the mystery-box demo with the watch they just unboxed.
  const [unboxed, setUnboxed] = useState(false);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);
  const [wrist, setWrist] = useState<ImagePayload | null>(null);
  // What the customer types for their picture ("at night", "with a suit"…). Kept when they pick another watch.
  const [wish, setWish] = useState("");
  // Wrist size picked on the watch screen; remembered on this phone.
  const [wristSize, setWristSize] = useState<WristSize>("M");
  const [tryOn, setTryOn] = useState<TryOnState>({ status: "idle" });
  const [error, setError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [camera, setCamera] = useState(false);
  const [feedback, setFeedback] = useState(false);
  // Free try-ons left for this person during the beta; null until the server answers.
  const [left, setLeft] = useState<number | null>(null);
  // True while the AI money has run out; Generate is turned off until it's back.
  const [paused, setPaused] = useState(false);
  // Only the latest try counts; a picture for an earlier watch is dropped.
  const attempt = useRef(0);
  // My collection: how many try-ons are saved, the newest one's id, and whether it opens in compare mode.
  const [saved, setSaved] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | undefined>();
  const [coll, setColl] = useState<{ compare: boolean; preselect?: string; n: number }>({ compare: false, n: 0 });
  const collBack = useRef<(() => boolean) | null>(null);
  // Going back one screen: the phone's back button, Safari's edge swipe, or our own swipe in the installed app.
  const goBack = useRef<() => boolean>(() => false);
  goBack.current = () => {
    if (camera) setCamera(false);
    else if (feedback) setFeedback(false);
    else if (step === "collection" && collBack.current?.()) return true;
    else if (step === "result") { attempt.current++; setStep("photos"); }
    else if (step === "photos" || step === "collection") startOver();
    else return false;
    return true;
  };

  useEffect(() => {
    try {
      localStorage.removeItem(OLD_SAVED_WRIST);
    } catch {}
    rememberCode();
    try {
      const saved = localStorage.getItem(WRIST_SIZE_KEY);
      if (saved && saved in WRIST_SIZES) setWristSize(saved as WristSize);
    } catch {}
    track("visit");
    listCollection().then((all) => setSaved(all.length)).catch(() => {});
    // A link like /?watch=<id> opens that watch straight away (used by the mystery-box demo).
    const params = new URLSearchParams(window.location.search);
    const linked = WATCHES.find((w) => w.id === params.get("watch"));
    if (linked) {
      pick(linked);
      setUnboxed(params.get("from") === "box");
      window.history.replaceState(null, "", "/");
    }
    fetch("/api/tryon", { headers: betaHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.left === "number") setLeft(j.left);
        setPaused(Boolean(j.paused));
      })
      .catch(() => {});
  }, []);

  // Away from home there is always one extra history entry, so Back (or a swipe) lands here instead of leaving the app.
  const armed = useRef(false);
  const skipPop = useRef(false);
  useEffect(() => {
    if (step !== "pick" && !armed.current) {
      window.history.pushState({ strapped: true }, "");
      armed.current = true;
    } else if (step === "pick" && armed.current) {
      // Came home with an in-app button: drop the extra entry so the next Back isn't wasted.
      armed.current = false;
      skipPop.current = true;
      window.history.back();
    }
  }, [step]);
  useEffect(() => {
    function onPop() {
      armed.current = false;
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      goBack.current();
      // Still not home: put the extra entry back for the next swipe.
      setTimeout(() => {
        if (document.body.dataset.step !== "pick" && !armed.current) {
          window.history.pushState({ strapped: true }, "");
          armed.current = true;
        }
      }, 0);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    document.body.dataset.step = step;
  }, [step]);
  // The installed app has no browser swipe, so a drag from the left edge does it.
  useSwipeBack(() => {
    if (armed.current) window.history.back();
    else goBack.current();
  });

  const browsing = !query.trim() && !brand;
  const results = useMemo(() => (browsing ? POPULAR : search(query, brand)), [browsing, query, brand]);
  const shown = results.slice(0, 60);

  function pick(w: Watch) {
    track("watch_open");
    setWatch(w);
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

  async function tryItOn(w: Watch, wristImg: ImagePayload, extra: string) {
    const id = ++attempt.current;
    setStep("result");
    setTryOn({ status: "loading" });
    window.scrollTo({ top: 0 });
    const started = performance.now();
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: betaHeaders(),
        body: JSON.stringify({
          watch: w,
          wrist: { data: wristImg.data, mediaType: wristImg.mediaType },
          wish: extra.trim() || undefined,
          wristSize,
        }),
      });
      const json = await res.json();
      if (typeof json.left === "number") setLeft(json.left);
      if (json.wishRejected) {
        if (id === attempt.current) {
          setStep("photos");
          setError(json.error);
        }
        return;
      }
      if (json.paused) {
        setPaused(true);
        if (id === attempt.current) setTryOn({ status: "error", error: json.error, limit: true });
        return;
      }
      if (json.limit) {
        if (id === attempt.current) setTryOn({ status: "error", error: json.error, limit: true });
        return;
      }
      if (!res.ok) throw new Error(json.error);
      const timing = { total: (performance.now() - started) / 1000, ai: (json.aiMs || 0) / 1000 };
      if (id === attempt.current) setTryOn({ status: "done", image: json.image, timing });
      setLastSaved(undefined);
      addToCollection(w, json.image)
        .then((item) => {
          setSaved((n) => n + 1);
          if (id === attempt.current) setLastSaved(item.id);
        })
        .catch(() => {});
    } catch (e) {
      if (id === attempt.current) setTryOn({ status: "error", error: e instanceof Error ? e.message : "The try-on picture failed." });
    }
  }

  function pickWristSize(k: WristSize) {
    setWristSize(k);
    try {
      localStorage.setItem(WRIST_SIZE_KEY, k);
    } catch {}
  }

  function openCamera() {
    track("camera_open");
    setCamera(true);
  }

  function openCollection(compare: boolean, preselect?: string) {
    track(compare ? "compare_open" : "collection_open");
    attempt.current++;
    setColl((c) => ({ compare, preselect, n: c.n + 1 }));
    setStep("collection");
    window.scrollTo({ top: 0 });
  }

  function startOver() {
    attempt.current++;
    setUnboxed(false);
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
          <div className="home-actions">
            <button className="pill" onClick={() => openCollection(false)}>
              My collection{saved > 0 && <span className="pill-count">{saved}</span>}
            </button>
            <button className="pill" onClick={() => openCollection(true)}>Compare</button>
          </div>
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
              {unboxed && <p className="unboxed-note">You unboxed it. Now see it on your wrist.</p>}
              <div className="detail-pic"><WatchPic watch={watch} size={220} /></div>
              <div className="result-line">
                <div style={{ minWidth: 0 }}>
                  <h2>{watch.model}</h2>
                  <div className="sub">{watch.brand} · {watch.caseMm} mm</div>
                </div>
                {watch.priceUsd > 0 && <div className="price">{formatPrice(watch.priceUsd)}</div>}
              </div>
              <div className="wrist-size">
                <span>Your wrist size</span>
                <div className="sizes" role="group" aria-label="Wrist size">
                  {(Object.keys(WRIST_SIZES) as WristSize[]).map((k) => (
                    <button key={k} className="size-btn" aria-pressed={wristSize === k} onClick={() => pickWristSize(k)}>
                      <strong>{WRIST_SIZES[k].label}</strong>
                      <small>{inches(WRIST_SIZES[k].cm)} in</small>
                    </button>
                  ))}
                </div>
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
            <label className="wish">
              <strong>Make it yours</strong>
              <textarea
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="Optional. e.g. night out with city lights, navy suit sleeve, black and white…"
                rows={2}
                maxLength={200}
                enterKeyHint="done"
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          {watch ? (
            <>
              <button className="cta" disabled={!wrist || left === 0 || paused} onClick={() => wrist && tryItOn(watch, wrist, wish)}>
                Generate
              </button>
              {paused ? (
                <p className="left-note">Try-ons are paused for a little while. Please check back soon!</p>
              ) : left !== null && left < 100 && (
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
            <>
              <ShareBar image={tryOn.image} watch={watch} />
              <BuyButton watch={watch} />
              <button className="ghost" onClick={() => openCollection(true, lastSaved)}>Compare with another watch</button>
              {tryOn.timing && (
                <p className="left-note">
                  Made in {Math.round(tryOn.timing.total)} s · picture {Math.round(tryOn.timing.ai)} s
                </p>
              )}
            </>
          ) : (
            <>
              {tryOn.limit ? (
                <div className="limit-box">
                  <strong>{tryOn.error}</strong>
                  <p>{paused ? "Meanwhile, tell us what you think?" : "Paid packs are coming soon. Tell us what you thought while it\u2019s fresh?"}</p>
                  <button className="ghost" onClick={() => setFeedback(true)}>Give feedback</button>
                </div>
              ) : (
                <TryOn state={tryOn} fallback={wrist?.preview} onRetry={() => wrist && tryItOn(watch, wrist, wish)} />
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

      {step === "collection" && (
        <Collection key={coll.n} backRef={collBack} startCompare={coll.compare} preselect={coll.preselect} onClose={startOver} />
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

function useSwipeBack(onBack: () => void) {
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    // In a browser tab Safari and Chrome already swipe back on their own; doing it twice would skip a screen.
    if (!standalone) return;
    let start: { x: number; y: number } | null = null;
    const app = document.querySelector<HTMLElement>(".app");
    function down(e: TouchEvent) {
      const t = e.touches[0];
      start = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null;
    }
    function move(e: TouchEvent) {
      if (!start || !app) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = Math.abs(e.touches[0].clientY - start.y);
      if (dy > dx) { start = null; app.style.transform = ""; return; }
      app.style.transition = "none";
      app.style.transform = `translateX(${Math.max(0, dx) * 0.5}px)`;
    }
    function up(e: TouchEvent) {
      if (!start || !app) return;
      const dx = e.changedTouches[0].clientX - start.x;
      start = null;
      app.style.transition = "transform .2s ease";
      app.style.transform = "";
      if (dx > 70) cb.current();
    }
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", up);
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
    };
  }, []);
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
