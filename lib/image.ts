export type ImagePayload = { data: string; mediaType: "image/jpeg"; preview: string };

// Shrinks a photo to at most 1024px on its long side and returns base64 JPEG.
export async function prepareImage(file: File): Promise<ImagePayload> {
  const bitmap = await createImageBitmap(file);
  const max = 1024;
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { data: preview.split(",")[1], mediaType: "image/jpeg", preview };
}
