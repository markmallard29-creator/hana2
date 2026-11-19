import { demoResearch as demoMode } from "@/lib/config";
import { demoResearch } from "@/lib/demo";
import { fail, route } from "@/lib/api";
import { research } from "@/lib/research";
import type { Settings } from "@/lib/types";

export const maxDuration = 300;

/**
 * Streams newline-delimited JSON: {"progress": "..."} lines while working, then
 * {"articles": [...]} or {"error": "..."}. Sending bytes straight away keeps proxies
 * (e.g. Railway's edge) from closing a connection that looks idle.
 */
export const POST = route(async (req: Request) => {
  const { settings, excludeUrls = [], count } = (await req.json()) as {
    settings: Settings;
    excludeUrls?: string[];
    count?: number;
  };
  if (!settings?.topic?.trim()) return fail("Enter a newsletter topic first.");
  const s: Settings = {
    ...settings,
    numArticles: Math.min(20, Math.max(1, Math.round(settings.numArticles || 8))),
    daysBack: Math.min(30, Math.max(1, Math.round(settings.daysBack || 5))),
  };
  const want = Math.min(20, Math.max(1, count ?? s.numArticles));
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ ping: 1 }), 10_000);
      try {
        send({ progress: "Starting research…" });
        const articles = demoMode
          ? await demoResearch(s, excludeUrls, want)
          : await research(s, excludeUrls, want, (m) => send({ progress: m }));
        send({ articles, demo: demoMode });
      } catch (e) {
        console.error("[research]", e);
        send({ error: (e as Error).message || "Research failed" });
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
});
