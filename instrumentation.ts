/**
 * Starts HANA's schedule timer once per server process. Every minute it asks this same
 * server to run any due schedules (going through the normal API route keeps all the
 * server code in one place). Set DISABLE_SCHEDULER=1 to turn it off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_SCHEDULER === "1") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const g = globalThis as unknown as { __hanaTicker?: boolean };
  if (g.__hanaTicker) return;
  g.__hanaTicker = true;

  // Web Crypto, not node:crypto: this file is also bundled for the edge runtime.
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  process.env.HANA_INTERNAL_CRON_TOKEN = token;

  const tick = Number(process.env.SCHEDULER_TICK_MS) || 60_000;
  const port = process.env.PORT || "3000";
  const run = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(280_000),
      });
      if (!res.ok && res.status !== 401) console.warn("[scheduler] tick failed:", res.status);
    } catch (e) {
      // the server may still be starting up; the next tick will try again
      if (!/ECONNREFUSED|fetch failed/.test(String(e))) console.warn("[scheduler] tick error:", (e as Error).message);
    }
  };
  setTimeout(run, Math.min(15_000, tick));
  setInterval(run, tick).unref?.();
}
