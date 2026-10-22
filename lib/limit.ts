import { deviceOf, ipOf, isUnlimited, redis, today } from "@/lib/store";

// Each try-on picture costs about $0.07, so the beta gives everyone a few for free and caps the whole day.
export const FREE_TRYONS = Number(process.env.FREE_TRYONS || 5);
const DAILY_CAP = Number(process.env.DAILY_TRYON_CAP || 60);
// Several people can share one internet address (home Wi-Fi, a phone network), so it gets more room.
const PER_IP_PER_DAY = FREE_TRYONS * 3;
const COOKIE = "strapped_tries";

export type Allowance =
  | { ok: true; left: number; used: number; refund: () => Promise<void>; cookie?: string }
  | { ok: false; reason: "person" | "day"; left: 0 };

function cookieCount(req: Request) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`${COOKIE}=(\\d+)`));
  return m ? Number(m[1]) : 0;
}

export function triesCookie(used: number) {
  return `${COOKIE}=${used}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
}

// How many free try-ons this person has left, without using one.
export async function remaining(req: Request) {
  if (isUnlimited(req)) return { left: 999, unlimited: true };
  const device = deviceOf(req);
  const out = device ? await redis([["GET", `tries:dev:${device}`]]) : null;
  const used = Math.max(cookieCount(req), Number(out?.[0] || 0));
  return { left: Math.max(0, FREE_TRYONS - used), unlimited: false };
}

// Takes one try-on from this person's allowance. Call refund() if the picture fails, so failures are free.
export async function useTry(req: Request): Promise<Allowance> {
  const day = today();
  const dayKey = `tries:day:${day}`;
  if (isUnlimited(req)) {
    await redis([["INCR", dayKey], ["EXPIRE", dayKey, 172800]]);
    return { ok: true, left: 999, used: 0, refund: async () => { await redis([["DECR", dayKey]]); } };
  }

  const device = deviceOf(req);
  const ipKey = `tries:ip:${day}:${ipOf(req)}`;
  const devKey = device ? `tries:dev:${device}` : "";
  const fromCookie = cookieCount(req);

  const cmds: (string | number)[][] = [["INCR", dayKey], ["EXPIRE", dayKey, 172800], ["INCR", ipKey], ["EXPIRE", ipKey, 172800]];
  if (devKey) cmds.push(["INCR", devKey]);
  const out = await redis(cmds);

  if (!out) {
    // No store: count with a cookie only. Good enough to keep honest testers inside the free amount.
    const used = fromCookie + 1;
    if (used > FREE_TRYONS) return { ok: false, reason: "person", left: 0 };
    return { ok: true, used, left: FREE_TRYONS - used, cookie: triesCookie(used), refund: async () => {} };
  }

  const dayCount = Number(out[0]);
  const ipCount = Number(out[2]);
  const used = Math.max(fromCookie + 1, devKey ? Number(out[4]) : ipCount);
  const undo = async () => {
    const back: (string | number)[][] = [["DECR", dayKey], ["DECR", ipKey]];
    if (devKey) back.push(["DECR", devKey]);
    await redis(back);
  };

  if (dayCount > DAILY_CAP) {
    await undo();
    return { ok: false, reason: "day", left: 0 };
  }
  if (used > FREE_TRYONS || ipCount > PER_IP_PER_DAY) {
    await undo();
    return { ok: false, reason: "person", left: 0 };
  }
  return { ok: true, used, left: FREE_TRYONS - used, cookie: triesCookie(used), refund: undo };
}
