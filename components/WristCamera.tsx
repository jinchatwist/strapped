"use client";

import { useEffect, useRef, useState } from "react";
import { captureFrame, prepareImage, type ImagePayload } from "@/lib/image";
import { CAMERA_GUIDE } from "@/lib/wrist";

// Full-screen camera with an outline showing where the wrist goes, so every photo is framed the same way.
export function WristCamera({ onDone, onClose }: { onDone: (photo: ImagePayload) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setFailed(true));
    if (!navigator.mediaDevices) setFailed(true);
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    if (!video.current || !ready) return;
    onDone(captureFrame(video.current));
  }

  async function fromLibrary(file: File | undefined) {
    if (!file) return;
    try {
      onDone(await prepareImage(file));
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="cam" role="dialog" aria-label="Take a wrist photo">
      <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} />

      <WristGuide />

      <div className="cam-top">
        <button className="cam-x" onClick={onClose} aria-label="Close camera">✕</button>
        <p>
          <strong>Lay your arm across the screen</strong>
          <span>Watch spot on your wrist, arm between the lines.</span>
        </p>
      </div>

      {failed && (
        <div className="cam-failed">
          Can&apos;t open the camera. Allow camera access in Settings, or pick a photo instead.
        </div>
      )}

      <div className="cam-bar">
        <label className="cam-lib">
          Photos
          <input type="file" accept="image/*" onChange={(e) => fromLibrary(e.target.files?.[0])} />
        </label>
        <button className="cam-shoot" onClick={shoot} disabled={!ready} aria-label="Take photo" />
        <span className="cam-lib" aria-hidden="true" />
      </div>
    </div>
  );
}

// A faint watch where the watch goes, dotted lines along both edges of the forearm and [ ] marks at the wrist.
// Drawn upright with the watch at 0,0 (hand toward -y, wrist 101 units wide), then placed and turned.
const G = CAMERA_GUIDE;
const CASE = 22;
const HOOKS = [-34, 34].map((y) => { const s = -Math.sign(y); return `M-64 ${y + s * 10}Q-64 ${y} -54 ${y}M64 ${y + s * 10}Q64 ${y} 54 ${y}`; }).join("");
const RAILS =
  "M-54 260 C-52 160 -50 80 -50 20 C-50 -60 -58 -120 -58 -150 M54 260 C52 160 50 80 50 20 C50 -60 60 -120 60 -150";

// Clock ticks around the dial.
function ticks(r1: number, r2: number, n: number) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    d += `M${(Math.sin(a) * r1).toFixed(2)} ${(-Math.cos(a) * r1).toFixed(2)}L${(Math.sin(a) * r2).toFixed(2)} ${(-Math.cos(a) * r2).toFixed(2)}`;
  }
  return d;
}

// Bracelet links from the case out to both edges of the wrist.
function bracelet() {
  let d = "";
  for (const s of [1, -1]) {
    d += `M${s * (CASE - 2)} -10H${s * 54}M${s * (CASE - 2)} 10H${s * 54}`;
    for (let i = 0; i < 8; i++) d += `M${s * (CASE + 2 + i * 4)} -10V10`;
  }
  return d;
}

function WristGuide() {
  const k = G.wristUnits / 101;
  const place = `translate(${G.x} ${G.y}) rotate(${G.angle}) scale(${k})`;
  const line = (w: number) => w / k;
  return (
    <svg className="cam-guide" viewBox={`0 0 ${G.viewW} ${G.viewH}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="cam-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor="#000" floodOpacity=".45" />
        </filter>
      </defs>
      <g transform={place} fill="none" stroke="#fff" strokeLinecap="round" filter="url(#cam-glow)">
        <path d={RAILS} strokeWidth={line(2.2)} strokeDasharray={`${line(0.1)} ${line(6)}`} opacity=".9" />
        <path d={HOOKS} strokeWidth={line(2)} />
        <g opacity=".8">
          <path d={bracelet()} strokeWidth={line(0.9)} />
          <circle r={CASE + 1} fill="rgba(255,255,255,.12)" strokeWidth={line(1.8)} />
          <circle r={CASE - 4} strokeWidth={line(0.9)} />
          <path d={ticks(CASE - 7, CASE - 4, 12)} strokeWidth={line(1.2)} />
          <path d="M0 0 L0 -12 M0 0 L8 4" strokeWidth={line(1.4)} transform={`rotate(${-G.angle})`} />
          <rect x={CASE + 1} y="-3" width="4" height="6" rx="1" fill="#fff" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
