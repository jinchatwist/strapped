import { CAMERA_GUIDE, wristWidthMm, type WristSize } from "@/lib/wrist";

// Where the wrist sits in a photo from the in-app camera, in the photo's own pixels.
export type WristSpot = { x: number; y: number; width: number; angle: number };
export type ImagePayload = { data: string; mediaType: "image/jpeg"; preview: string; spot?: WristSpot };

// Shrinks a photo to at most 1024px on its long side and returns base64 JPEG.
export async function prepareImage(file: File): Promise<ImagePayload> {
  const bitmap = await createImageBitmap(file);
  return toPayload(bitmap, bitmap.width, bitmap.height);
}

// Same, for the current frame of a live camera. The person lined their arm up with the outline,
// so we also know where the wrist is and how wide it is in the picture.
export function captureFrame(video: HTMLVideoElement): ImagePayload {
  const vw = video.videoWidth, vh = video.videoHeight;
  const payload = toPayload(video, vw, vh);
  const W = video.clientWidth || window.innerWidth, H = video.clientHeight || window.innerHeight;
  const g = CAMERA_GUIDE;
  // Outline drawing → screen (preserveAspectRatio slice), screen → video frame (object-fit cover).
  const s = Math.max(W / g.viewW, H / g.viewH);
  const v = Math.max(W / vw, H / vh);
  const ratio = Math.min(1, 1024 / Math.max(vw, vh));
  const toFrame = (screen: number, view: number, frame: number) => ((screen - (view - frame * v) / 2) / v) * ratio;
  payload.spot = {
    x: toFrame((W - g.viewW * s) / 2 + g.x * s, W, vw),
    y: toFrame((H - g.viewH * s) / 2 + g.y * s, H, vh),
    width: ((g.wristUnits * s) / v) * ratio,
    angle: g.angle,
  };
  return payload;
}

// Paints a bright magenta patch exactly the watch's real size where the watch goes, so the AI
// only has to swap the patch for the watch instead of guessing the size.
export async function markWatchSpot(photo: ImagePayload, size: WristSize, caseMm: number, lugMm: number) {
  if (!photo.spot) return null;
  const img = new Image();
  img.src = photo.preview;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const pxPerMm = photo.spot.width / wristWidthMm(size);
  const across = Math.max(lugMm, caseMm) * pxPerMm; // lug to lug runs across the arm
  const along = caseMm * pxPerMm;
  ctx.translate(photo.spot.x, photo.spot.y);
  ctx.rotate((photo.spot.angle * Math.PI) / 180);
  ctx.fillStyle = "#ff00ff";
  ctx.beginPath();
  ctx.roundRect(-across / 2, -along / 2, across, along, along * 0.3);
  ctx.fill();
  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
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
