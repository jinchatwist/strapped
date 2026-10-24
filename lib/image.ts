export type ImagePayload = { data: string; mediaType: "image/jpeg"; preview: string };

// Shrinks a photo to at most 1536px on its long side and returns base64 JPEG.
// (At 1024px the watch ended up only ~150px across, too few pixels for a sharp, real-looking result.)
export async function prepareImage(file: File): Promise<ImagePayload> {
  const bitmap = await createImageBitmap(file);
  return toPayload(bitmap, bitmap.width, bitmap.height);
}

// Same, for the current frame of a live camera: only the part shown on screen (the video is cropped to
// fill it), so the photo is framed exactly like the guide and the wrist fills as much of it as it seemed to.
export function captureFrame(video: HTMLVideoElement): ImagePayload {
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(video.clientWidth / vw, video.clientHeight / vh) || 1;
  const sw = Math.min(vw, video.clientWidth / scale), sh = Math.min(vh, video.clientHeight / scale);
  return toPayload(video, sw, sh, (vw - sw) / 2, (vh - sh) / 2);
}

function toPayload(source: CanvasImageSource, width: number, height: number, sx = 0, sy = 0): ImagePayload {
  const max = 1536;
  const ratio = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.getContext("2d")!.drawImage(source, sx, sy, width, height, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { data: preview.split(",")[1], mediaType: "image/jpeg", preview };
}
