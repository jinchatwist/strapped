// Client helpers for the beta: a random id for this phone (no personal info), the tester code, and tap counts.
const DEVICE = "strapped-device";
const CODE = "strapped-code";

function stored(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function deviceId() {
  let id = stored(DEVICE);
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    try {
      localStorage.setItem(DEVICE, id);
    } catch {}
  }
  return id;
}

// Opening the app with ?code=… once (a link Jin sends) remembers the tester code on this phone.
export function rememberCode() {
  const code = new URLSearchParams(location.search).get("code");
  if (!code) return;
  try {
    localStorage.setItem(CODE, code);
  } catch {}
  history.replaceState(null, "", location.pathname);
}

export function betaHeaders(): Record<string, string> {
  const h: Record<string, string> = { "x-strapped-device": deviceId() };
  const code = stored(CODE);
  if (code) h["x-strapped-code"] = code;
  return h;
}

export function track(name: string) {
  fetch("/api/event", { method: "POST", headers: betaHeaders(), body: JSON.stringify({ name }), keepalive: true }).catch(() => {});
}
