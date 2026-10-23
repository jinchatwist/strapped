import { aiPaused, spentUsd } from "@/lib/pause";
import { EVENTS, hasStore, redis, today } from "@/lib/store";

// Numbers and feedback for /admin. Needs ADMIN_KEY set in Vercel.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Wrong key." }, { status: 401 });
  }
  if (!hasStore) return Response.json({ error: "No store yet. Add Upstash Redis in Vercel → Storage." }, { status: 503 });

  const days = Array.from({ length: 14 }, (_, i) => today(i));
  const cmds: (string | number)[][] = [];
  for (const d of days) cmds.push(["HGETALL", `stats:${d}`], ["PFCOUNT", `people:${d}`]);
  cmds.push(["PFCOUNT", "people:all"], ["LRANGE", "feedback", 0, 199]);
  const out = await redis(cmds);
  if (!out) return Response.json({ error: "Couldn't reach the store." }, { status: 502 });

  const rows = days.map((day, i) => {
    const flat = (out[i * 2] as string[] | null) || [];
    const counts: Record<string, number> = {};
    for (let j = 0; j < flat.length; j += 2) counts[flat[j]] = Number(flat[j + 1]);
    return { day, people: Number(out[i * 2 + 1] || 0), ...Object.fromEntries(EVENTS.map((e) => [e, counts[e] || 0])) };
  });
  const feedback = ((out[days.length * 2 + 1] as string[]) || []).map((s) => JSON.parse(s));
  const [money, paused] = await Promise.all([spentUsd(), aiPaused()]);
  return Response.json({ rows, people: Number(out[days.length * 2] || 0), feedback, events: EVENTS, ...money, paused });
}
