import { wristWidthMm, type WristSize } from "@/lib/wrist";

// Where the wrist sits in a photo, in the photo's own pixels; angle is the line across the wrist.
export type WristSpot = { x: number; y: number; width: number; angle: number };
export type ImagePayload = { data: string; mediaType: "image/jpeg"; preview: string };

// Shrinks a photo to at most 1024px on its long side and returns base64 JPEG.
export async function prepareImage(file: File): Promise<ImagePayload> {
  const bitmap = await createImageBitmap(file);
  return toPayload(bitmap, bitmap.width, bitmap.height);
}

// Same, for the current frame of a live camera.
export function captureFrame(video: HTMLVideoElement): ImagePayload {
  return toPayload(video, video.videoWidth, video.videoHeight);
}

// Paints a bright magenta patch exactly the watch's real size where the watch goes, so the AI
// only has to swap the patch for the watch instead of guessing the size.
export async function markWatchSpot(photo: ImagePayload, spot: WristSpot | undefined, size: WristSize, caseMm: number, lugMm: number) {
  if (!spot) return null;
  const img = new Image();
  img.src = photo.preview;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const pxPerMm = spot.width / wristWidthMm(size);
  const across = Math.max(lugMm, caseMm) * pxPerMm; // lug to lug runs across the arm
  const along = caseMm * pxPerMm;
  ctx.translate(spot.x, spot.y);
  ctx.rotate((spot.angle * Math.PI) / 180);
  ctx.fillStyle = "#ff00ff";
  ctx.beginPath();
  ctx.roundRect(-across / 2, -along / 2, across, along, along * 0.3);
  ctx.fill();
  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
}

// Asks the server where the wrist really is in this photo. Works for library photos too, and for
// camera photos where the arm didn't quite fill the outline. Null when it can't tell.
const measured = new WeakMap<ImagePayload, Promise<WristSpot | null>>();
export function measureWrist(photo: ImagePayload): Promise<WristSpot | null> {
  // Once per photo: trying several watches on the same wrist reuses it.
  if (!measured.has(photo)) measured.set(photo, findWrist(photo).catch(() => null));
  return measured.get(photo)!;
}

async function findWrist(photo: ImagePayload): Promise<WristSpot | null> {
  const res = await fetch("/api/wrist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: photo.data, mediaType: photo.mediaType }),
  });
  const out = await res.json();
  if (!out.found) return null;
  const img = new Image();
  img.src = photo.preview;
  await img.decode();
  const [ay, ax] = out.a as [number, number];
  const [by, bx] = out.b as [number, number];
  const A = { x: (ax / 1000) * img.naturalWidth, y: (ay / 1000) * img.naturalHeight };
  const B = { x: (bx / 1000) * img.naturalWidth, y: (by / 1000) * img.naturalHeight };
  const width = Math.hypot(B.x - A.x, B.y - A.y);
  // A wrist narrower than a tenth of the picture is more likely a misread than a real wrist.
  if (width < Math.max(img.naturalWidth, img.naturalHeight) / 10) return null;
  return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, width, angle: (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI };
}

function toPayload(source: CanvasImageSource, width: number, height: number): ImagePayload {
  const max = 1024;
  const ratio = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { data: preview.split(",")[1], mediaType: "image/jpeg", preview };
}
