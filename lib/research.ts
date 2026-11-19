import "server-only";
import { randomUUID } from "node:crypto";
import { askJson, cleanTitle } from "./llm";
import { domainOf, fetchMeta, normaliseDate, sourceFromUrl, wordCount } from "./meta";
import { EXCLUDE_DOMAINS, searchProvider, type SearchHit } from "./search";
import type { Article, Settings } from "./types";

const MAX_CONTENT_CHARS = 14000; // what we keep per article for summarising
const MIN_WORDS = 250; // below this it's a stub, a paywall teaser or a listing page
const LONG_READ_WORDS = 1200;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Listing, tag and home pages are not articles. */
function looksLikeArticle(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    if (!path || path.split("/").length < 2) return false;
    if (/\/(tag|tags|topic|topics|category|categories|author|authors|search|page)(\/|$)/i.test(path)) return false;
    if (/\.(pdf|jpg|png|mp4|mp3)$/i.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

function canonical(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    [...u.searchParams.keys()].forEach((k) => {
      if (/^(utm_|fbclid|gclid|ref|cmp|ito|at_)/i.test(k)) u.searchParams.delete(k);
    });
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url;
  }
}

export async function planQueries(s: Settings): Promise<string[]> {
  const r = await askJson<{ queries: string[] }>({
    system: "You plan web searches for a newsletter editor who wants thoughtful, substantive reading.",
    prompt: `Newsletter topic: ${s.topic}
Audience: ${s.audience}
Period: the last ${s.daysBack} day(s).

Write 5 distinct search queries that together cover this topic for the period.
- 2 queries should find recent news on the topic.
- 3 queries should find in-depth pieces: analysis, features, long reads, interviews, research write-ups, explainers.
- Keep each query short (3-8 words). Include place names if the topic is local. Don't put dates in the queries.`,
    shape: `{"queries": ["...", "...", "...", "...", "..."]}`,
    fast: true,
    maxTokens: 400,
  });
  return (r.queries ?? []).filter(Boolean).slice(0, 6);
}

interface Candidate extends SearchHit {
  id: string;
  words: number;
}

export type Progress = (msg: string) => void;

export async function gatherCandidates(s: Settings, excludeUrls: string[] = [], progress: Progress = () => {}): Promise<Candidate[]> {
  progress("Planning searches…");
  const queries = await planQueries(s);
  progress(`Searching the web (${queries.length} searches)…`);
  const end = new Date();
  const start = new Date(end.getTime() - s.daysBack * 86400_000);
  const startDate = isoDay(start);
  const endDate = isoDay(end);

  const results = await Promise.allSettled(
    queries.map((query, i) => searchProvider.search({ query, startDate, endDate, news: i < 2, max: 12 })),
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length === results.length) {
    throw new Error(`Search failed: ${(failures[0] as PromiseRejectedResult).reason?.message ?? "unknown error"}`);
  }

  const seen = new Set(excludeUrls.map(canonical));
  const titles = new Set<string>();
  const out: Candidate[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const h of r.value) {
      const key = canonical(h.url);
      const tkey = h.title.toLowerCase().replace(/\W+/g, " ").trim().slice(0, 80);
      const dom = domainOf(h.url);
      if (EXCLUDE_DOMAINS.some((x) => dom === x || dom.endsWith(`.${x}`))) continue;
      if (seen.has(key) || titles.has(tkey) || !looksLikeArticle(h.url)) continue;
      const words = wordCount(h.rawContent);
      if (h.rawContent && words < MIN_WORDS) continue;
      const pub = normaliseDate(h.publishedAt);
      // Tavily keeps undated results; drop only those we can see are out of range (1 day grace).
      if (pub && new Date(pub).getTime() < start.getTime() - 86400_000) continue;
      seen.add(key);
      titles.add(tkey);
      out.push({ ...h, publishedAt: pub, id: String(out.length + 1), words });
    }
  }
  return out;
}

export async function rankCandidates(s: Settings, cands: Candidate[], want: number) {
  if (cands.length <= want) return cands.map((c) => ({ c, why: "" }));
  const list = cands
    .map(
      (c) =>
        `[${c.id}] ${c.title}\n    source: ${sourceFromUrl(c.url)} | date: ${c.publishedAt?.slice(0, 10) ?? "unknown"} | words: ${c.words || "unknown"}\n    ${c.snippet.replace(/\s+/g, " ").slice(0, 280)}`,
    )
    .join("\n");

  const r = await askJson<{ picks: { id: string; why: string }[] }>({
    system: "You are the commissioning editor of a high-quality email newsletter.",
    prompt: `Topic: ${s.topic}
Audience: ${s.audience}
Pick the ${want + 4} best articles from the candidates below, best first.

What "best" means, in order of importance:
1. Clearly about the topic and useful to this audience.
2. Substance and insight: original reporting, analysis, data, expert interviews, features. Prefer these over short rewrites of a press release or breaking-news stubs.
3. Long reads: articles over ${LONG_READ_WORDS} words should be favoured when they are good.
4. Variety: no two articles about the same story, and at most 2 from any one publication.
Skip listicles, adverts, sponsored posts, job ads, event listings and pages that look paywalled or empty.

Candidates:
${list}`,
    shape: `{"picks": [{"id": "3", "why": "one short phrase on why it earns its place"}]}`,
    maxTokens: 1500,
  });
  const byId = new Map(cands.map((c) => [c.id, c]));
  const picked = (r.picks ?? []).filter((p) => byId.has(String(p.id)));
  // If the model returned too few, top up by length × relevance.
  const used = new Set(picked.map((p) => String(p.id)));
  const rest = cands
    .filter((c) => !used.has(c.id))
    .sort((a, b) => b.score * Math.log(10 + b.words) - a.score * Math.log(10 + a.words));
  return [
    ...picked.map((p) => ({ c: byId.get(String(p.id))!, why: p.why })),
    ...rest.map((c) => ({ c, why: "" })),
  ];
}

/** Turn a candidate into an Article, pulling image / publication / date from the page itself. */
export async function enrich(url: string, opts: { title?: string; raw?: string | null; publishedAt?: string | null; why?: string; custom?: boolean }) {
  const meta = await fetchMeta(url);
  const content = (opts.raw && wordCount(opts.raw) > wordCount(meta.text) * 0.5 ? opts.raw : meta.text || opts.raw || "")
    .slice(0, MAX_CONTENT_CHARS * 3);
  const words = Math.max(wordCount(opts.raw), wordCount(meta.text));
  const title = cleanTitle(opts.title || meta.title || url).replace(/\s+[|–—-]\s+[^|–—-]{2,40}$/, "");
  const a: Article = {
    id: randomUUID(),
    url,
    title,
    source: meta.siteName || sourceFromUrl(url),
    publishedAt: meta.publishedAt || opts.publishedAt || null,
    image: meta.image,
    wordCount: words,
    readMins: Math.max(1, Math.round(words / 230)),
    summary: "",
    content: content.slice(0, MAX_CONTENT_CHARS),
    status: "pending",
    custom: opts.custom,
    whyPicked: opts.why,
  };
  return a;
}

export async function research(
  s: Settings,
  excludeUrls: string[] = [],
  want = s.numArticles,
  progress: Progress = () => {},
): Promise<Article[]> {
  const cands = await gatherCandidates(s, excludeUrls, progress);
  if (!cands.length) return [];
  progress(`Picking the best ${want} of ${cands.length} candidates…`);
  const ranked = await rankCandidates(s, cands, want);
  progress("Reading the chosen articles…");
  const start = Date.now() - (s.daysBack + 1) * 86400_000;

  // Enrich in ranked order, a few at a time, until we have enough in-range articles.
  const out: Article[] = [];
  const perDomain = new Map<string, number>();
  for (let i = 0; i < ranked.length && out.length < want; i += 4) {
    const batch = ranked.slice(i, i + 4);
    const arts = await Promise.all(
      batch.map(({ c, why }) => enrich(c.url, { title: c.title, raw: c.rawContent, publishedAt: c.publishedAt, why })),
    );
    for (const a of arts) {
      if (out.length >= want) break;
      if (a.publishedAt && new Date(a.publishedAt).getTime() < start) continue; // page says it's older
      if (a.wordCount && a.wordCount < MIN_WORDS) continue;
      const d = domainOf(a.url);
      if ((perDomain.get(d) ?? 0) >= 2) continue;
      perDomain.set(d, (perDomain.get(d) ?? 0) + 1);
      out.push(a);
    }
  }
  return out;
}

export async function articleFromUrl(url: string) {
  let raw: string | null = null;
  try {
    raw = (await searchProvider.extract([url]))[url] ?? null;
  } catch {
    /* fall back to our own fetch */
  }
  return enrich(url, { raw, custom: true });
}

export async function summarise(a: Pick<Article, "title" | "source" | "content" | "url">, s: Pick<Settings, "tone" | "audience" | "topic">) {
  const r = await askJson<{ headline: string; summary: string }>({
    system: "You write the article summaries for an email newsletter.",
    prompt: `Newsletter topic: ${s.topic}
Audience: ${s.audience}
Tone of voice: ${s.tone}

Summarise this article in one paragraph of 70-110 words. Lead with what happened or what the piece argues, then why it matters to this audience. Use only facts in the article.
Also give a clear headline (max 90 characters). Keep the original headline if it is already clear; never add quote marks.

Title: ${a.title}
Source: ${a.source}
URL: ${a.url}

Article text:
${(a.content || "").slice(0, MAX_CONTENT_CHARS)}`,
    shape: `{"headline": "...", "summary": "..."}`,
    fast: true,
    maxTokens: 600,
  });
  return { headline: cleanTitle(r.headline || a.title), summary: (r.summary || "").trim() };
}

export async function compose(
  articles: Pick<Article, "title" | "summary" | "source">[],
  s: Pick<Settings, "tone" | "audience" | "topic">,
  parts: ("title" | "subject" | "execSummary" | "intro")[],
) {
  const list = articles.map((a, i) => `${i + 1}. ${a.title} (${a.source})\n${a.summary}`).join("\n\n");
  const r = await askJson<{
    title?: string;
    subject?: string;
    execSummary?: { heading: string; text: string }[];
    intro?: string;
  }>({
    system: "You are the editor of an email newsletter, writing the framing copy around the articles.",
    prompt: `Topic: ${s.topic}
Audience: ${s.audience}
Tone: ${s.tone}

Articles in this edition:
${list}

Write only these parts: ${parts.join(", ")}.
- title: the masthead headline for this edition, max 60 characters, no quote marks, no emoji.
- subject: the email subject line, max 70 characters, specific about what's inside, different wording from the title, no clickbait, no quote marks.
- execSummary: one item per article, same order. heading = 3-7 words; text = one sentence, max 30 words.
- intro: 2-3 sentences from the editor, warm but not gushing, that frames this week's themes. No "Welcome to" opener.`,
    shape: `{${[
      parts.includes("title") && `"title": "..."`,
      parts.includes("subject") && `"subject": "..."`,
      parts.includes("execSummary") && `"execSummary": [{"heading": "...", "text": "..."}]`,
      parts.includes("intro") && `"intro": "..."`,
    ]
      .filter(Boolean)
      .join(", ")}}`,
    maxTokens: 2500,
  });
  return {
    title: r.title ? cleanTitle(r.title) : undefined,
    subject: r.subject ? cleanTitle(r.subject) : undefined,
    execSummary: r.execSummary?.map((x) => ({ heading: cleanTitle(x.heading), text: x.text.trim() })),
    intro: r.intro?.trim(),
  };
}

export async function refineTopic(topic: string, audience: string) {
  const r = await askJson<{ topic: string }>({
    system: "You help a newsletter editor sharpen a topic into a clear brief for researching articles.",
    prompt: `Rewrite this newsletter topic as a one-sentence brief (max 30 words) that says what to cover and what to leave out, for the audience "${audience}". Keep the editor's intent and any place names.\n\nTopic: ${topic || "(blank: suggest a topic for this audience)"}`,
    shape: `{"topic": "..."}`,
    fast: true,
    maxTokens: 200,
  });
  return cleanTitle(r.topic || topic);
}
