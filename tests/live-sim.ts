// Simulates Tavily + Anthropic + article pages via a fake fetch, then runs the real pipeline.
const SEARCH = process.env.SIM_SEARCH || "tavily";
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:/tmp/hana-sim-${Date.now()}.db`;
// SIM_SEARCH: tavily | exa | both (both keys set; SIM_PICK chooses per newsletter)
if (SEARCH === "exa" || SEARCH === "both") process.env.EXA_API_KEY = "exa-test";
if (SEARCH === "tavily" || SEARCH === "both") process.env.TAVILY_API_KEY = "tvly-test";
const PROVIDER = process.env.SIM_PROVIDER || "anthropic";
if (PROVIDER === "openai") process.env.OPENAI_API_KEY = "sk-openai-test"; else process.env.ANTHROPIC_API_KEY = "sk-test";
const now = Date.now(), day = 86400_000;
const page = (title: string, site: string, img: string, date: string, words: number) =>
  `<html><head><meta property="og:title" content="${title} | ${site}"><meta property="og:site_name" content="${site}">
   <meta property="og:image" content="${img}"><meta property="article:published_time" content="${date}"></head>
   <body><article><p>${"word ".repeat(words)}</p></article></body></html>`;
const hits = [
  { url: "https://www.bristolpost.co.uk/news/bristol-news/long-feature-1", title: "Inside Bristol's housing squeeze", d: 1, w: 2600, site: "Bristol Post" },
  { url: "https://www.bbc.co.uk/news/articles/abc123", title: "Clean air zone two years on", d: 2, w: 1400, site: "BBC News" },
  { url: "https://www.bristol247.com/news-and-features/news/old-story", title: "Very old story", d: 20, w: 1800, site: "Bristol24/7" },
  { url: "https://www.bristolpost.co.uk/news/bristol-news/short-stub", title: "Stub", d: 1, w: 90, site: "Bristol Post" },
  { url: "https://www.bristolpost.co.uk/", title: "Homepage", d: 1, w: 900, site: "Bristol Post" },
  { url: "https://www.youtube.com/watch?v=1", title: "Video", d: 1, w: 900, site: "YouTube" },
  { url: "https://www.theguardian.com/uk-news/2026/nov/17/bristol-arena?utm_source=x", title: "Bristol's arena finally gets going", d: 2, w: 3100, site: "The Guardian" },
  { url: "https://www.theguardian.com/uk-news/2026/nov/17/bristol-arena", title: "Bristol's arena finally gets going (dup)", d: 2, w: 3100, site: "The Guardian" },
  { url: "https://www.ft.com/content/blocked-feature", title: "Bristol's tech cluster comes of age", d: 3, w: 2200, site: "BLOCKED" },
];
const calls: string[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  const body = init?.body ? JSON.parse(init.body) : null;
  calls.push(url.replace(/\?.*/, ""));
  if (url.includes("api.tavily.com/search")) {
    if (!body.start_date || !body.include_published_date) throw new Error("bad tavily params");
    return Response.json({ usage: { credits: 2 }, results: hits.map((h) => ({ url: h.url, title: h.title, content: "snippet", raw_content: "word ".repeat(h.w), published_date: new Date(now - h.d * day).toISOString(), score: 0.8 })) });
  }
  if (url.includes("api.exa.ai/search")) {
    if (!body.startPublishedDate?.endsWith("Z") || !body.contents?.text) throw new Error("bad exa params");
    calls.push(`exa:${body.category ?? "any"}`);
    return Response.json({ costDollars: { total: 0.007 }, results: hits.map((h) => ({ url: h.url, title: h.title, text: "word ".repeat(h.w), publishedDate: new Date(now - h.d * day).toISOString(), image: "https://img.example/exa-" + h.d + ".jpg" })) });
  }
  if (url.includes("api.anthropic.com") || url.includes("api.openai.com")) {
    const isOpenAI = url.includes("api.openai.com");
    if (isOpenAI && !(body.model && body.instructions && Array.isArray(body.input))) throw new Error("bad openai params");
    const text = (isOpenAI ? body.input : body.messages).at(-1).content as string;
    let out: any;
    if (text.includes("search queries")) out = { queries: ["bristol news", "bristol council", "bristol analysis", "bristol long read", "bristol interview"] };
    else if (text.includes("Pick the")) { const ids = [...text.matchAll(/\[(\d+)\] ([^\n]+)/g)].map((m) => ({ id: m[1], t: m[2] })); out = { picks: ids.map((x) => ({ id: x.id, why: "test" })) }; console.log("candidates sent to Claude:", ids.map((x) => x.t)); }
    else out = { headline: '"Quoted headline"', summary: "A summary." };
    if (isOpenAI) {
      calls.push(`openai:${body.model}`);
      return Response.json({ id: "r", object: "response", usage: { input_tokens: 4000, output_tokens: 400 }, output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(out) }] }] });
    }
    return Response.json({ id: "m", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: "```json\n" + JSON.stringify(out) + "\n```" }], stop_reason: "end_turn", usage: { input_tokens: 4000, output_tokens: 400 } });
  }
  const h = hits.find((x) => x.url.split("?")[0] === url.split("?")[0]);
  if (h?.site === "BLOCKED") return new Response("Forbidden", { status: 403 });
  if (h) return new Response(page(h.title, h.site, "/img/hero.jpg", new Date(now - h.d * day).toISOString(), h.w), { headers: { "content-type": "text/html" } });
  return new Response("nope", { status: 404 });
}) as any;

(async () => {
  const { research, summarise } = await import("../lib/research");
  const pick = process.env.SIM_PICK as "tavily" | "exa" | undefined;
  const { withEdition } = await import("../lib/usage");
  const { usageForEdition } = await import("../lib/db");
  const EDITION = "11111111-2222-3333-4444-555555555555";
  const arts = await withEdition(EDITION, () => research({ topic: "Bristol UK News", numArticles: 5, daysBack: 7, customUrls: "", tone: "Professional", audience: "locals", search: pick }));
  console.log("via:", [...new Set(arts.map((a) => a.via))].join(","));
  for (const a of arts) console.log(`- ${a.title} | ${a.source} | ${a.publishedAt?.slice(0,10)} | ${a.wordCount}w ${a.readMins}min | img=${a.image}`);
  const s = await withEdition(EDITION, () => summarise({ title: "x", source: "y", url: "https://e.com", content: "z" }, { tone: "Professional", audience: "a", topic: "t" }));
  console.log("summary headline:", s.headline);
  const u = await usageForEdition(EDITION);
  console.log("meter:", `$${u.totalUsd.toFixed(4)}`, "| calls", u.calls, "| unpriced", u.unpriced);
  for (const l of u.lines) console.log(`   ${l.provider}/${l.kind}${l.model ? " " + l.model : ""}: ${l.calls} calls, ${l.units} ${l.unitLabel}, $${l.costUsd.toFixed(4)}${l.unpriced ? ` (${l.unpriced} unpriced)` : ""}`);
  console.log("search calls:", calls.filter((c) => c.includes("tavily") || c.startsWith("exa:")).map((c) => c.replace(/^https:\/\/api\.tavily\.com\//, "tavily:")).join(" "), "| models:", [...new Set(calls.filter((c) => c.startsWith("openai:")))].join(", ") || "anthropic");
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
