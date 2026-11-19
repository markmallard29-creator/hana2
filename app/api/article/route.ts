import { demoResearch as demoMode } from "@/lib/config";
import { demoArticleFromUrl } from "@/lib/demo";
import { fail, ok, route } from "@/lib/api";
import { articleFromUrl } from "@/lib/research";

export const maxDuration = 60;

/** Turn a pasted URL into an article card (custom URLs and "Add more articles"). */
export const POST = route(async (req: Request) => {
  const { url } = (await req.json()) as { url: string };
  let u: URL;
  try {
    u = new URL(String(url).trim());
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    return fail("That doesn't look like a web address.");
  }
  const article = demoMode ? await demoArticleFromUrl(u.toString()) : await articleFromUrl(u.toString());
  if (!demoMode && !article.content) {
    return fail(`Couldn't read ${u.hostname}. It may be paywalled or block automated readers.`, 422);
  }
  return ok({ article });
});
