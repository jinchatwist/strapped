import { deviceOf, redis, today, track } from "@/lib/store";

type Feedback = { looks?: number; pay?: string; text?: string; watch?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Feedback;
  const entry = {
    at: new Date().toISOString(),
    day: today(),
    looks: [1, 2, 3, 4, 5].includes(Number(body.looks)) ? Number(body.looks) : null,
    pay: ["yes", "maybe", "no"].includes(String(body.pay)) ? body.pay : null,
    text: String(body.text || "").slice(0, 1000),
    watch: String(body.watch || "").slice(0, 120),
    device: deviceOf(req).slice(0, 8),
  };
  if (!entry.looks && !entry.pay && !entry.text) {
    return Response.json({ error: "Tap an answer or write a few words first." }, { status: 400 });
  }
  // Always in the Vercel logs, and on /admin when the store is set up.
  console.log("FEEDBACK", JSON.stringify(entry));
  await Promise.all([redis([["LPUSH", "feedback", JSON.stringify(entry)], ["LTRIM", "feedback", 0, 999]]), track("feedback", deviceOf(req))]);
  return Response.json({ ok: true });
}
