/**
 * "Let's run it live" pop-up trigger. Demos call `openLiveDemo("DocDesk")` when a live feature is offline
 * (its service isn't running); the single <LiveDemoDialog /> in the root layout listens and opens a short
 * form that reaches Azad through /api/contact. Client-only.
 */

export const LIVE_DEMO_EVENT = "live-demo:open";

export interface LiveDemoRequest {
  /** Which demo the visitor tried, e.g. "DocDesk". Goes into the email. */
  demo: string;
}

const SEEN_KEY = "live-demo:seen";

/**
 * Opens the pop-up. `once: true` shows it at most once per browser session for that demo
 * (for automatic triggers like a chat reply failing); explicit clicks should open it every time.
 */
export function openLiveDemo(demo: string, opts: { once?: boolean } = {}) {
  if (typeof window === "undefined") return;
  if (opts.once) {
    try {
      const seen = new Set<string>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
      if (seen.has(demo)) return;
      seen.add(demo);
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      /* storage unavailable — still show it */
    }
  }
  window.dispatchEvent(new CustomEvent<LiveDemoRequest>(LIVE_DEMO_EVENT, { detail: { demo } }));
}
