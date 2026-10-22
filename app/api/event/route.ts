import { deviceOf, EVENTS, track, type EventName } from "@/lib/store";

// The app reports a few taps (opened a watch, shared, …) so the beta can see where people drop off.
export async function POST(req: Request) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name || !EVENTS.includes(name as EventName)) return new Response(null, { status: 204 });
  await track(name as EventName, deviceOf(req));
  return new Response(null, { status: 204 });
}
