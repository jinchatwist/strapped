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

// Thin brown outline at the angle people check a watch: forearm running up to the right, hand at the top.
// Drawn upright around the wrist, then turned; the watch sits on a jubilee bracelet across the wrist.
const ANGLE = CAMERA_GUIDE.angle;
const WRIST = { x: CAMERA_GUIDE.x, y: CAMERA_GUIDE.y };
const EDGES = "M-126 -520 C-118 -330 -98 -200 -92 -70 L-118 760 M126 -520 C118 -330 98 -200 92 -70 L118 760";
const LANE = "M-92 -70 C-98 -200 -118 -330 -126 -520 L126 -520 C118 -330 98 -200 92 -70 L118 760 L-118 760 Z";

function Jubilee({ side }: { side: 1 | -1 }) {
  // Five rows: wide outer links, three small centre links, offset like a real jubilee.
  const rows = [
    { y: -17, h: 8, step: 9, shift: 0 },
    { y: -9, h: 5, step: 5, shift: 2.5 },
    { y: -4, h: 8, step: 5, shift: 0 },
    { y: 4, h: 5, step: 5, shift: 2.5 },
    { y: 9, h: 8, step: 9, shift: 0 },
  ];
  const from = 44, to = 110;
  return (
    <g transform={side === -1 ? "scale(-1 1)" : undefined}>
      <path d={`M${from} -17H${to}M${from} 17H${to}`} strokeWidth="1.2" />
      {rows.map((r) => (
        <g key={r.y}>
          <path d={`M${from} ${r.y + r.h}H${to}`} strokeWidth=".6" opacity=".8" />
          {Array.from({ length: Math.floor((to - from - r.shift) / r.step) }, (_, i) => from + r.shift + (i + 1) * r.step).map((x) => (
            <path key={x} d={`M${x} ${r.y + 0.8}V${r.y + r.h - 0.8}`} strokeWidth=".6" opacity=".85" />
          ))}
        </g>
      ))}
    </g>
  );
}

function WristGuide() {
  const brown = "#96592a";
  const place = `translate(${WRIST.x} ${WRIST.y}) rotate(${ANGLE})`;
  return (
    <svg className="cam-guide" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <mask id="cam-lane" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="844">
          <rect width="390" height="844" fill="#fff" />
          <path d={LANE} transform={place} fill="#000" />
        </mask>
        <filter id="cam-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#000" floodOpacity=".55" />
        </filter>
      </defs>
      <rect width="390" height="844" fill="rgba(0,0,0,.5)" mask="url(#cam-lane)" />
      <g transform={place} fill="none" stroke={brown} strokeLinecap="round" filter="url(#cam-glow)">
        <path d={EDGES} stroke="#fff" strokeWidth="2.6" strokeDasharray="9 6" opacity=".35" />
        <path d={EDGES} strokeWidth="1.4" strokeDasharray="9 6" />
        <Jubilee side={1} />
        <Jubilee side={-1} />
        <path d="M30 -19 L44 -17 M30 19 L44 17 M-30 -19 L-44 -17 M-30 19 L-44 17" strokeWidth="1.3" />
        <ellipse cx="0" cy="0" rx="40" ry="37" fill="rgba(0,0,0,.18)" strokeWidth="1.5" />
        <ellipse cx="0" cy="0" rx="33" ry="30.5" strokeWidth=".8" opacity=".85" />
        <path d="M0 -30v5M0 25v5M-33 0h5M28 0h5" strokeWidth="1.1" />
        <path d="M40 -4v8" strokeWidth="2" />
      </g>
      <text x="195" y="720" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" opacity=".9">Watch goes in the circle</text>
    </svg>
  );
}
