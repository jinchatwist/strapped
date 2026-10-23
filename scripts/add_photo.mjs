// Adds a watch photo you already have: node scripts/add_photo.mjs <watch id> <image file>
// Trims the edges, centers it on a white square and saves public/watches/<id>.jpg.
import { readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [id, file] = process.argv.slice(2);
if (!id || !file) throw new Error("Usage: node scripts/add_photo.mjs <watch id> <image file>");
const trimmed = await sharp(file).flatten({ background: "#ffffff" }).trim({ threshold: 20 }).toBuffer();
const jpg = await sharp(trimmed)
  .resize(640, 640, { fit: "contain", background: "#ffffff" })
  .extend({ top: 40, bottom: 40, left: 40, right: 40, background: "#ffffff" })
  .jpeg({ quality: 84, mozjpeg: true })
  .toBuffer();
writeFileSync(`public/watches/${id}.jpg`, jpg);
const ids = readdirSync("public/watches").filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).sort();
writeFileSync("data/photos.json", JSON.stringify(ids, null, 1) + "\n");
console.log("added", id);
