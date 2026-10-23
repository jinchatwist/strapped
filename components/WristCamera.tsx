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
          <strong>Hold your arm like you&apos;re checking the time</strong>
          <span>Line your arm up with the outline, bare wrist.</span>
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

// Thin brown outline of a relaxed hand, fingers together, forearm running in from the bottom left.
// Drawn upright with the watch at 0,0 (hand toward -y, wrist 101 units wide), then placed and turned.
const G = CAMERA_GUIDE;
const ARM =
  "M50 -26 C54 -44 62 -60 72 -76 C82 -92 90 -112 86 -126 C82 -136 72 -132 66 -122 C62 -116 60 -112 58 -110 " +
  "C60 -136 58 -158 54 -172 C54 -216 50 -248 44 -258 Q36 -270 28 -260 Q24 -284 12 -286 Q0 -286 -2 -268 " +
  "Q-6 -278 -16 -276 Q-26 -274 -26 -258 Q-30 -250 -38 -248 Q-48 -246 -50 -232 C-54 -196 -60 -146 -58 -96 " +
  "C-56 -62 -52 -38 -50 -26 C-51 -2 -54 54 -58 144 L-68 534 L68 534 L58 144 C54 54 51 -2 50 -26 Z";
const FINGERS = "M28 -260 C29 -226 30 -202 30 -184 M-2 -268 C0 -226 1 -202 2 -184 M-26 -258 C-25 -226 -24 -202 -24 -184";
const CASE = 22;

// Jubilee bracelet running from the case to both edges of the wrist.
function bracelet() {
  let d = "";
  for (const side of [1, -1]) {
    for (let x = CASE + 4; x <= 56; x += 4) d += `M${side * x} -9V9`;
    d += `M${side * (CASE + 4)} -10H${side * 56}M${side * (CASE + 4)} 10H${side * 56}M${side * (CASE + 4)} 0H${side * 56}`;
  }
  return d;
}

function WristGuide() {
  const brown = "#96592a";
  const k = G.wristUnits / 101;
  const place = `translate(${G.x} ${G.y}) rotate(${G.angle}) scale(${k})`;
  const line = (w: number) => w / k;
  return (
    <svg className="cam-guide" viewBox={`0 0 ${G.viewW} ${G.viewH}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <mask id="cam-lane" maskUnits="userSpaceOnUse" x="0" y="0" width={G.viewW} height={G.viewH}>
          <rect width={G.viewW} height={G.viewH} fill="#fff" />
          <path d={ARM} transform={place} fill="#000" />
        </mask>
        <filter id="cam-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#000" floodOpacity=".55" />
        </filter>
      </defs>
      <rect width={G.viewW} height={G.viewH} fill="rgba(0,0,0,.5)" mask="url(#cam-lane)" />
      <g transform={place} fill="none" stroke={brown} strokeLinecap="round" strokeLinejoin="round" filter="url(#cam-glow)">
        <path d={ARM} stroke="#fff" strokeWidth={line(2.6)} strokeDasharray={`${line(9)} ${line(6)}`} opacity=".35" />
        <path d={ARM} strokeWidth={line(1.5)} strokeDasharray={`${line(9)} ${line(6)}`} />
        <path d={FINGERS} strokeWidth={line(1)} opacity=".8" />
        <path d={bracelet()} strokeWidth={line(0.6)} opacity=".85" />
        <ellipse cx="0" cy="0" rx={CASE} ry={CASE * 0.93} fill="rgba(0,0,0,.18)" strokeWidth={line(1.4)} />
        <ellipse cx="0" cy="0" rx={CASE * 0.82} ry={CASE * 0.76} strokeWidth={line(0.7)} opacity=".85" />
      </g>
      <text x={G.viewW / 2} y="720" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" opacity=".9">Watch goes in the circle</text>
    </svg>
  );
}
