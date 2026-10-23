"use client";

import { useState } from "react";
import { betaHeaders } from "@/lib/beta";

const PAY = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
];

// A short sheet: three quick questions, all optional.
export function Feedback({ watch, onClose }: { watch?: string; onClose: () => void }) {
  const [looks, setLooks] = useState(0);
  const [pay, setPay] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send() {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: betaHeaders(),
        body: JSON.stringify({ looks, pay, text, watch }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setState("sent");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't send that. Try again.");
      setState("idle");
    }
  }

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Feedback" onClick={(e) => e.stopPropagation()}>
        {state === "sent" ? (
          <>
            <h2>Thank you!</h2>
            <p className="sheet-sub">Every note helps make Strapped better.</p>
            <button className="cta" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <h2>How was it?</h2>
            <div className="q">
              <span>How real did the watch look on your wrist?</span>
              <div className="stars" role="group" aria-label="Rating from 1 to 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className="star" aria-pressed={looks === n} aria-label={`${n} of 5`} onClick={() => setLooks(n)}>
                    {n <= looks ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            <div className="q">
              <span>Would you pay $3.99 for 10 more try-ons?</span>
              <div className="chips">
                {PAY.map((p) => (
                  <button key={p.value} className="chip" aria-pressed={pay === p.value} onClick={() => setPay(p.value)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="sheet-text"
              placeholder="Anything else? What was confusing, what you loved, which watch is missing…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            {error && <p className="error">{error}</p>}
            <button className="cta" onClick={send} disabled={state === "sending" || (!looks && !pay && !text.trim())}>
              {state === "sending" ? "Sending…" : "Send"}
            </button>
            <button className="link center" onClick={onClose}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
