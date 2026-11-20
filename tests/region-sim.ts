export {};
// Checks region targeting, favourite sources, and that rejected (wrong-place) articles never come back.
const SEARCH = process.env.SIM_SEARCH || "tavily";
const REJECT_TARGETING = process.env.SIM_REJECT === "1";
if (SEARCH === "exa") process.env.EXA_API_KEY = "exa-test"; else process.env.TAVILY_API_KEY = "tvly-test";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.DATABASE_URL = `file:/tmp/hana-region-${Date.now()}.db`;
const now = Date.now(), day = 86400_000;
const hits = [
  { url: "https://www.bristolpost.co.uk/news/bristol-news/clean-air-zone-two-years", title: "Clean air zone two years on", w: 1800 },
  { url: "https://www.bristolpress.com/news/council-approves-budget-for-bristol-conn", title: "Bristol, Conn. council approves budget", w: 900 },
  { url: "https://www.bbc.co.uk/news/articles/bristol-harbourside-plan", title: "Harbourside regeneration plan unveiled", w: 1500 },
  { url: "https://www.heraldcourier.com/news/bristol-tenn-speedway-expansion", title: "Bristol Motor Speedway expansion in Tennessee", w: 1200 },
  { url: "https://www.bristol247.com/news-and-features/news/temple-quarter-long-read", title: "Temple Quarter: the long read", w: 3200 },
];
const seen: { tavily: any[]; exa: any[]; plan: string; rank: string } = { tavily: [], exa: [], plan: "", rank: "" };
const reply = (o: unknown) => Response.json({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: JSON.stringify(o) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 } });
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  const body = init?.body ? JSON.parse(init.body) : null;
  const results = hits.map((h) => ({ url: h.url, title: h.title, content: "snippet", raw_content: "word ".repeat(h.w), text: "word ".repeat(h.w), published_date: new Date(now - day).toISOString(), publishedDate: new Date(now - day).toISOString(), score: 0.8 }));
  if (url.includes("api.tavily.com/search")) {
    seen.tavily.push(body);
    if (REJECT_TARGETING && (body.country || body.include_domains_mode)) return new Response('{"detail":"Invalid country"}', { status: 400 });
    return Response.json({ usage: { credits: 2 }, results });
  }
  if (url.includes("api.exa.ai/search")) { seen.exa.push(body); return Response.json({ costDollars: { total: 0.005 }, results }); }
  if (url.includes("api.anthropic.com")) {
    const text = body.messages.at(-1).content as string;
    if (text.includes("search queries")) { seen.plan = text; return reply({ queries: ["Bristol England news", "Bristol city council", "Bristol England analysis", "Bristol long read", "Bristol interview"] }); }
    if (text.includes("Pick up to")) {
      seen.rank = text;
      const ids = [...text.matchAll(/\[(\d+)\] ([^\n]+)/g)].map((m) => ({ id: m[1], t: m[2] }));
      return reply({ picks: ids.filter((x) => !/Conn|Tennessee/.test(x.t)).map((x) => ({ id: x.id, why: "t" })), rejected: ids.filter((x) => /Conn|Tennessee/.test(x.t)).map((x) => x.id) });
    }
    return reply({ headline: "h", summary: "s" });
  }
  const h = hits.find((x) => x.url === url);
  if (h) return new Response(`<html><head><meta property="og:title" content="${h.title}"><meta property="article:published_time" content="${new Date(now - day).toISOString()}"></head><body><article><p>${"word ".repeat(h.w)}</p></article></body></html>`, { headers: { "content-type": "text/html" } });
  return new Response("nope", { status: 404 });
}) as any;
(async () => {
  const { research } = await import("../lib/research");
  const arts = await research({ topic: "Bristol UK News", numArticles: 10, daysBack: 7, customUrls: "", tone: "Professional", audience: "locals", search: SEARCH as any, region: "United Kingdom", sources: "bristolpost.co.uk\nhttps://www.bristol247.com/news\nnot a domain" });
  console.log(`== ${SEARCH}${REJECT_TARGETING ? " (Tavily rejects targeting)" : ""}`);
  console.log("articles:", arts.map((a) => a.title));
  console.log("wrong-place excluded:", !arts.some((a) => /Conn|Tennessee/.test(a.title)), "| even though fewer than asked for:", arts.length, "< 10");
  console.log("planner told region + disambiguate:", seen.plan.includes("Readers are in: United Kingdom") && seen.plan.includes("unambiguous"));
  console.log("ranker told region + favourites:", seen.rank.includes("Readers are in: United Kingdom") && seen.rank.includes("bristolpost.co.uk, bristol247.com"));
  if (SEARCH === "tavily") {
    const t = seen.tavily[0];
    console.log("tavily first call:", JSON.stringify({ topic: t.topic, country: t.country, include_domains: t.include_domains, mode: t.include_domains_mode }), "| calls:", seen.tavily.length);
    if (REJECT_TARGETING) console.log("retried without targeting:", seen.tavily.some((b) => !b.country && !b.include_domains_mode));
  } else {
    console.log("exa userLocation:", [...new Set(seen.exa.map((b) => b.userLocation))], "| calls:", seen.exa.length, "| restricted-to-favourites call:", seen.exa.filter((b) => b.includeDomains).map((b) => b.includeDomains));
  }
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
