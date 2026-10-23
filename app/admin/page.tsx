"use client";

import { useEffect, useState } from "react";

type Row = Record<string, number | string> & { day: string; people: number };
type Entry = { at: string; looks: number | null; pay: string | null; text: string; watch: string };
type Data = { rows: Row[]; people: number; feedback: Entry[]; events: string[] };

const KEY = "strapped-admin";
// Rough cost of one try-on picture, for the money line.
const COST_PER_TRYON = 0.067;

const FUNNEL: [string, string][] = [
  ["visit", "Opened the app"],
  ["watch_open", "Opened a watch"],
  ["camera_open", "Opened the camera"],
  ["wrist_ok", "Took a wrist photo"],
  ["generate", "Tapped Generate"],
  ["tryon_ok", "Got a picture"],
  ["tryon_fail", "Picture failed"],
  ["try_another", "Tried another watch"],
  ["share_instagram", "Shared: Instagram"],
  ["share_facebook", "Shared: Facebook"],
  ["share_tiktok", "Shared: TikTok"],
  ["share_save", "Saved picture"],
  ["limit_hit", "Ran out of free try-ons"],
  ["feedback", "Sent feedback"],
];

// Jin's page for the beta: how many people came, how far they got, and what they said.
export default function Admin() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  async function load(k: string) {
    setError("");
    const res = await fetch(`/api/admin?key=${encodeURIComponent(k)}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return setError(json.error);
    try {
      localStorage.setItem(KEY, k);
    } catch {}
    setData(json);
  }

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(KEY) || "";
    } catch {}
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, []);

  if (!data) {
    return (
      <main className="app">
        <h2>Strapped beta</h2>
        <input className="search" type="password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="cta" onClick={() => load(key)}>Open</button>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const total = (name: string) => data.rows.reduce((n, r) => n + Number(r[name] || 0), 0);
  const rated = data.feedback.filter((f) => f.looks);
  const avg = rated.length ? rated.reduce((n, f) => n + (f.looks || 0), 0) / rated.length : 0;
  const payers = data.feedback.filter((f) => f.pay);
  const yes = payers.filter((f) => f.pay === "yes").length;
  const maybe = payers.filter((f) => f.pay === "maybe").length;

  return (
    <main className="app admin">
      <div className="top">
        <h2>Strapped beta</h2>
        <button className="link" onClick={() => load(key)}>Refresh</button>
      </div>

      <div className="stat-grid">
        <div className="stat"><b>{data.people}</b><span>People so far</span></div>
        <div className="stat"><b>{total("tryon_ok")}</b><span>Try-on pictures</span></div>
        <div className="stat"><b>{avg ? avg.toFixed(1) : "–"}</b><span>Looks real (of 5)</span></div>
        <div className="stat"><b>{payers.length ? `${Math.round(((yes + maybe / 2) / payers.length) * 100)}%` : "–"}</b><span>Would pay ({yes} yes · {maybe} maybe · {payers.length - yes - maybe} no)</span></div>
      </div>
      <p className="left-note">AI cost, last 14 days: about ${(total("tryon_ok") * COST_PER_TRYON).toFixed(2)}</p>

      <h3>Last 14 days</h3>
      <table className="admin-table">
        <tbody>
          {FUNNEL.map(([name, label]) => (
            <tr key={name}><td>{label}</td><td>{total(name)}</td></tr>
          ))}
        </tbody>
      </table>

      <h3>By day</h3>
      <table className="admin-table">
        <thead><tr><th>Day</th><th>People</th><th>Pictures</th><th>Shares</th><th>Feedback</th></tr></thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.day}>
              <td>{r.day.slice(5)}</td>
              <td>{r.people}</td>
              <td>{r.tryon_ok}</td>
              <td>{Number(r.share_instagram) + Number(r.share_facebook) + Number(r.share_tiktok) + Number(r.share_save)}</td>
              <td>{r.feedback}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Feedback ({data.feedback.length})</h3>
      {data.feedback.length === 0 && <p className="left-note">Nothing yet.</p>}
      {data.feedback.map((f, i) => (
        <div key={i} className="limit-box">
          <small>{new Date(f.at).toLocaleString()} {f.watch && `· ${f.watch}`}</small>
          <span>{f.looks ? "★".repeat(f.looks) + "☆".repeat(5 - f.looks) : ""} {f.pay && `· Would pay: ${f.pay}`}</span>
          {f.text && <p>{f.text}</p>}
        </div>
      ))}
    </main>
  );
}
