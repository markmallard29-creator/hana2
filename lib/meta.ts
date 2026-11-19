import "server-only";

/** Page metadata pulled from an article's HTML: image, publication name, date, title, text length. */
export interface PageMeta {
  image: string | null;
  siteName: string | null;
  publishedAt: string | null;
  title: string | null;
  text: string | null;
}

const KNOWN_SOURCES: Record<string, string> = {
  "bbc.co.uk": "BBC News",
  "bbc.com": "BBC",
  "theguardian.com": "The Guardian",
  "ft.com": "Financial Times",
  "economist.com": "The Economist",
  "nytimes.com": "The New York Times",
  "wsj.com": "The Wall Street Journal",
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
  "bristolpost.co.uk": "Bristol Post",
  "bristol247.com": "Bristol24/7",
  "bristol.ac.uk": "University of Bristol",
  "oxfordmail.co.uk": "Oxford Mail",
  "ox.ac.uk": "University of Oxford",
  "technologyreview.com": "MIT Technology Review",
  "wired.com": "WIRED",
  "wired.co.uk": "WIRED",
  "theverge.com": "The Verge",
  "arstechnica.com": "Ars Technica",
  "hbr.org": "Harvard Business Review",
  "theatlantic.com": "The Atlantic",
  "newyorker.com": "The New Yorker",
  "techcrunch.com": "TechCrunch",
  "nature.com": "Nature",
  "sciencedaily.com": "ScienceDaily",
  "statnews.com": "STAT",
};

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Best human name for a publication from its URL, used when the page doesn't say. */
export function sourceFromUrl(url: string) {
  const d = domainOf(url);
  for (const [k, v] of Object.entries(KNOWN_SOURCES)) {
    if (d === k || d.endsWith(`.${k}`)) return v;
  }
  return d;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaTag(html: string, names: string[]): string | null {
  for (const name of names) {
    const esc = name.replace(/[:.]/g, "\\$&");
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']+)["']`, "i");
    const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${esc}["']`, "i");
    const m = html.match(a) || html.match(b);
    if (m?.[1]) return decode(m[1]);
  }
  return null;
}

function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const v = JSON.parse(m[1].trim());
      const items = Array.isArray(v) ? v : v["@graph"] ? v["@graph"] : [v];
      for (const it of items) if (it && typeof it === "object") out.push(it);
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

function htmlToText(html: string) {
  const body = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  return decode(
    body
      .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|h\d|li|div|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function absolute(src: string | null, base: string) {
  if (!src) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/** Don't let a pasted URL make the server fetch internal addresses. */
function isPrivateHost(url: string) {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      h === "localhost" ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
      h === "::1" ||
      /^f[cd][0-9a-f]{2}:/.test(h) ||
      /^fe80:/.test(h)
    );
  } catch {
    return true;
  }
}

export async function fetchMeta(url: string, timeoutMs = 8000): Promise<PageMeta> {
  const empty: PageMeta = { image: null, siteName: null, publishedAt: null, title: null, text: null };
  if (isPrivateHost(url)) return empty;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return empty;
    const html = (await res.text()).slice(0, 1_500_000);
    const ld = jsonLd(html);
    const ldArticle = ld.find((x) => /Article|Posting|Report/i.test(String(x["@type"] ?? "")));
    const ldImage = (() => {
      const img = ldArticle?.image as unknown;
      if (typeof img === "string") return img;
      if (Array.isArray(img)) return typeof img[0] === "string" ? img[0] : (img[0] as { url?: string })?.url;
      return (img as { url?: string } | undefined)?.url ?? null;
    })();
    const ldPublisher = (ldArticle?.publisher as { name?: string } | undefined)?.name ?? null;

    const image = absolute(
      metaTag(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ?? ldImage ?? null,
      res.url || url,
    );
    let siteName = metaTag(html, ["og:site_name", "application-name"]) ?? ldPublisher;
    if (siteName && siteName.length < 4) siteName = null; // e.g. "Bristol" for a sub-site is not useful
    const publishedAt =
      metaTag(html, ["article:published_time", "og:article:published_time", "datePublished", "date", "dc.date"]) ??
      (ldArticle?.datePublished as string | undefined) ??
      html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] ??
      null;
    const title = metaTag(html, ["og:title", "twitter:title"]) ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;
    return {
      image,
      siteName,
      publishedAt: normaliseDate(publishedAt),
      title: title ? decode(title) : null,
      text: htmlToText(html).slice(0, 40000),
    };
  } catch {
    return empty;
  }
}

export function normaliseDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function wordCount(s: string | null | undefined) {
  return s ? s.split(/\s+/).filter(Boolean).length : 0;
}
