// A small shared store for the beta: try-on counts, usage numbers and feedback.
// Uses Upstash Redis over its REST API (Vercel → Storage → Upstash Redis sets these variables).
// With no store set up, everything still works; limits fall back to a cookie and feedback goes to the logs.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasStore = Boolean(URL_ && TOKEN);

type Cmd = (string | number)[];

// Runs several commands in one round trip. Returns null when there is no store or it can't be reached.
export async function redis(commands: Cmd[]): Promise<unknown[] | null> {
  if (!hasStore) return null;
  try {
    const res = await fetch(`${URL_}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`store ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r) => r.result ?? null);
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Dates are counted in US Eastern time, where the testers are.
export function today(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// Usage counters people see on /admin. Kept to a fixed list so nobody can fill the store with junk.
export const EVENTS = [
  "visit", "watch_open", "camera_open", "wrist_ok", "generate",
  "tryon_ok", "tryon_fail", "limit_hit", "wish_used",
  "share_instagram", "share_facebook", "share_tiktok", "share_save", "card_toggle",
  "try_another", "feedback",
] as const;
export type EventName = (typeof EVENTS)[number];

const MONTH = 60 * 60 * 24 * 60;

export async function track(name: EventName, device?: string) {
  const day = today();
  const cmds: Cmd[] = [
    ["HINCRBY", `stats:${day}`, name, 1],
    ["EXPIRE", `stats:${day}`, MONTH],
  ];
  if (device) cmds.push(["PFADD", `people:${day}`, device], ["EXPIRE", `people:${day}`, MONTH], ["PFADD", "people:all", device]);
  await redis(cmds);
}

export function deviceOf(req: Request) {
  const id = req.headers.get("x-strapped-device") || "";
  return /^[a-z0-9-]{8,64}$/i.test(id) ? id : "";
}

export function ipOf(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

// Testers Jin lets in without a limit open the app once with ?code=<TESTER_CODE>.
export function isUnlimited(req: Request) {
  const code = process.env.TESTER_CODE;
  return Boolean(code && req.headers.get("x-strapped-code") === code);
}
