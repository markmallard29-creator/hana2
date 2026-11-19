import { demoResearch as demoMode } from "@/lib/config";
import { demoSummarise } from "@/lib/demo";
import { fail, ok, route } from "@/lib/api";
import { fetchMeta } from "@/lib/meta";
import { summarise } from "@/lib/research";
import type { Article, Settings } from "@/lib/types";

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const { article, settings } = (await req.json()) as {
    article: Pick<Article, "title" | "source" | "content" | "url">;
    settings: Pick<Settings, "tone" | "audience" | "topic">;
  };
  if (demoMode) return ok(await demoSummarise(article, settings));

  // Drafts don't store full text; re-read the page when retrying a resumed draft.
  let content = article.content;
  if (!content?.trim()) {
    content = (await fetchMeta(article.url)).text ?? "";
    if (!content.trim()) return fail("Couldn't read the article text.", 422);
  }
  return ok(await summarise({ ...article, content }, settings));
});
