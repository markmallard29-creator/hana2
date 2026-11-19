import "server-only";
import { config } from "./config";

/**
 * Search provider interface. Tavily is the default; swap in Exa (or anything
 * else) by implementing `SearchProvider` and changing `searchProvider` below.
 */
export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  rawContent: string | null;
  publishedAt: string | null;
  score: number;
}

export interface SearchProvider {
  search(q: { query: string; startDate: string; endDate: string; news: boolean; max: number }): Promise<SearchHit[]>;
  extract(urls: string[]): Promise<Record<string, string>>;
}

// Social, video and aggregator sites rarely make good newsletter links.
export const EXCLUDE_DOMAINS = [
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "pinterest.com",
  "linkedin.com",
  "msn.com",
  "news.google.com",
  "yahoo.com",
  "wikipedia.org",
  "quora.com",
];

async function tavily(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.tavily.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.tavilyKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Tavily ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export const tavilyProvider: SearchProvider = {
  async search({ query, startDate, endDate, news, max }) {
    const data = await tavily("/search", {
      query,
      topic: news ? "news" : "general",
      search_depth: "advanced",
      max_results: Math.min(20, max),
      start_date: startDate,
      end_date: endDate,
      include_published_date: true,
      include_raw_content: "text",
      exclude_domains: EXCLUDE_DOMAINS,
    });
    return (data.results ?? []).map(
      (r: { url: string; title: string; content: string; raw_content?: string; published_date?: string; score?: number }) => ({
        url: r.url,
        title: r.title,
        snippet: r.content ?? "",
        rawContent: r.raw_content ?? null,
        publishedAt: r.published_date ?? null,
        score: r.score ?? 0,
      }),
    );
  },
  async extract(urls) {
    if (!urls.length) return {};
    const data = await tavily("/extract", { urls, extract_depth: "advanced", format: "text" });
    const out: Record<string, string> = {};
    for (const r of data.results ?? []) if (r.raw_content) out[r.url] = r.raw_content;
    return out;
  },
};

export const searchProvider: SearchProvider = tavilyProvider;
