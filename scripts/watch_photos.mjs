// Makes a studio-style AI photo for each catalog watch and saves it to public/watches/<id>.jpg.
// Run: GEMINI_API_KEY=… node scripts/watch_photos.mjs popular   (or: all, or a list of watch ids)
// Watches that already have a photo are skipped, so it can be run again after a failure.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const BRANDS = [
  "Audemars Piguet", "Breitling", "Cartier", "Casio", "Hamilton", "Omega",
  "Patek Philippe", "Rolex", "Seiko", "TAG Heuer", "Tissot", "Tudor",
];
const POPULAR = [
  "rolex-submariner-date-black-126610ln",
  "rolex-cosmograph-daytona-white-panda-126500ln",
  "rolex-datejust-41-blue-jubilee-126334",
  "omega-speedmaster-moonwatch-professional-310-30-42-50-01-002",
  "ap-royal-oak-41-blue-15510st-oo-1320st-03",
  "patek-philippe-nautilus-5711-blue-5711-1a-010",
  "cartier-santos-de-cartier-large-wssa0018",
  "tudor-black-bay-58-m79030n-0001",
  "prx-powermatic-80-40mm-ice-blue-t137-407-11-351-00",
  "ga-2100-casioak-black-ga-2100-1a1",
];
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const OUT = "public/watches";

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const shown = catalog.filter((w) => BRANDS.includes(w.brand));
const args = process.argv.slice(2);
const wanted =
  args[0] === "all" ? shown : args[0] === "popular" || !args.length ? POPULAR.map((id) => shown.find((w) => w.id === id)) : args.map((id) => shown.find((w) => w.id === id));

function prompt(w) {
  return [
    `Professional studio product photograph of a ${w.brand} ${w.model}, reference ${w.reference}.`,
    `It must look exactly like the real ${w.reference}: correct case shape, bezel, dial color and texture, hour markers, hands, sub-dials and date window as the real watch has them.`,
    `${w.caseMm} mm case, ${w.strap}.`,
    "Straight-on front view, watch centered and upright, strap or bracelet visible going up and down out of the frame.",
    "Pure white seamless background, soft diffused light, subtle shadow, sharp focus, photorealistic catalog image. No props, no hands, no extra text.",
  ].join(" ");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let made = 0;
let failed = 0;
for (const w of wanted) {
  if (!w) continue;
  const file = `${OUT}/${w.id}.jpg`;
  if (existsSync(file)) continue;
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt(w) }] }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    });
    const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error("no image");
    const jpg = await sharp(Buffer.from(data, "base64")).resize(720, 720, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    writeFileSync(file, jpg);
    made++;
    console.log("made", w.id);
  } catch (e) {
    failed++;
    console.error("failed", w.id, e instanceof Error ? e.message : e);
  }
}
// The app reads this list to know which watches have a photo.
const ids = readdirSync(OUT).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).sort();
writeFileSync("data/photos.json", JSON.stringify(ids, null, 1) + "\n");
console.log(`Done: ${made} made, ${failed} failed.`);
