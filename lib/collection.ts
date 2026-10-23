import type { Watch } from "@/lib/watch";

// Every finished try-on is kept on this phone (IndexedDB), so people can look back, share again and compare.
export type Saved = { id: string; watch: Watch; image: Blob; at: number };

const DB = "strapped";
const STORE = "collection";

function open(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => done(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((done, fail) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => done(req.result);
    req.onerror = () => fail(req.error);
  });
}

// Shrinks the picture to 1080 px wide so hundreds fit on the phone.
async function shrink(image: string): Promise<Blob> {
  const img = new Image();
  img.src = image;
  await img.decode();
  const scale = Math.min(1, 1080 / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((done) => canvas.toBlob((b) => done(b!), "image/jpeg", 0.85));
}

export async function addToCollection(watch: Watch, image: string): Promise<Saved> {
  const item: Saved = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, watch, image: await shrink(image), at: Date.now() };
  await run("readwrite", (s) => s.put(item));
  return item;
}

export async function listCollection(): Promise<Saved[]> {
  const all = await run<Saved[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.at - a.at);
}

export async function removeFromCollection(id: string) {
  await run("readwrite", (s) => s.delete(id));
}
