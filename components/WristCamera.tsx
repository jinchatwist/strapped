"use client";

import { useEffect, useRef, useState } from "react";
import { captureFrame, prepareImage, type ImagePayload } from "@/lib/image";

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
          <strong>Hand at the top, wrist inside the lines</strong>
          <span>Bare wrist, phone about 30 cm away.</span>
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

// Thin leather-brown outline: the wrist lane, a strap across it with stitching and holes like the logo, and the watch case.
function WristGuide() {
  const brown = "#a86d38";
  return (
    <svg className="cam-guide" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <mask id="cam-lane">
          <rect width="390" height="844" fill="#fff" />
          <rect x="105" y="-40" width="180" height="924" rx="90" fill="#000" />
        </mask>
        <mask id="cam-case" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="844">
          <rect width="390" height="844" fill="#fff" />
          <circle cx="195" cy="422" r="47" fill="#000" />
        </mask>
        <filter id="cam-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#000" floodOpacity=".55" />
        </filter>
      </defs>
      <rect width="390" height="844" fill="rgba(0,0,0,.42)" mask="url(#cam-lane)" />
      <g fill="none" stroke={brown} strokeLinecap="round" filter="url(#cam-glow)">
        <path d="M105 -40V884M285 -40V884" strokeWidth="1.4" strokeDasharray="10 7" opacity=".9" />

        <g mask="url(#cam-case)">
          <rect x="84" y="401" width="222" height="42" rx="21" strokeWidth="1.5" />
          <rect x="90" y="407" width="210" height="30" rx="15" strokeWidth=".8" strokeDasharray="4 3" opacity=".85" />
        </g>
        <circle cx="258" cy="422" r="3.2" strokeWidth="1.3" />
        <circle cx="270" cy="422" r="3.2" strokeWidth="1.3" />
        <circle cx="282" cy="422" r="3.2" strokeWidth="1.3" />

        <path d="M150 404h-8M150 440h-8M240 404h8M240 440h8" strokeWidth="1.5" />
        <circle cx="195" cy="422" r="46" fill="rgba(0,0,0,.18)" strokeWidth="1.6" />
        <circle cx="195" cy="422" r="38" strokeWidth=".9" opacity=".85" />
        <path d="M195 388v5M195 451v5M161 422h5M224 422h5" strokeWidth="1.2" />
        <path d="M244 418v8" strokeWidth="2" />
      </g>
      <text x="195" y="490" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" opacity=".9">watch goes here</text>
      <text x="195" y="120" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" opacity=".9">↑ hand this way</text>
    </svg>
  );
}
