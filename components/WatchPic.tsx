import photos from "@/data/photos.json";
import { WatchFace } from "@/components/WatchFace";
import type { Watch } from "@/lib/watch";

const HAS_PHOTO = new Set<string>(photos);

export function photoUrl(w: Watch) {
  return HAS_PHOTO.has(w.id) ? `/watches/${w.id}.jpg` : null;
}

// The watch's photo when there is one, otherwise the drawing.
export function WatchPic({ watch, size }: { watch: Watch; size: number }) {
  const src = photoUrl(watch);
  if (!src) return <WatchFace watch={watch} size={size} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="watch-photo" src={src} alt={`${watch.brand} ${watch.model}`} loading="lazy" />;
}
