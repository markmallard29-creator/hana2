import { demoResearch as demoMode } from "@/lib/config";
import { demoCompose } from "@/lib/demo";
import { fail, ok, route } from "@/lib/api";
import { compose } from "@/lib/research";
import type { Article, Settings } from "@/lib/types";

export const maxDuration = 60;

type Part = "title" | "subject" | "execSummary" | "intro";

export const POST = route(async (req: Request) => {
  const { articles, settings, parts } = (await req.json()) as {
    articles: Pick<Article, "title" | "summary" | "source">[];
    settings: Pick<Settings, "tone" | "audience" | "topic">;
    parts: Part[];
  };
  if (!articles?.length) return fail("Add at least one article first.");
  if (demoMode) {
    const d = await demoCompose(articles, settings);
    return ok(Object.fromEntries(parts.map((p) => [p, d[p]])));
  }
  return ok(await compose(articles, settings, parts));
});
