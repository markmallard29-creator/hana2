export {};
// Unattended run with simulated Tavily + Claude + Resend: email content, saved draft, cost meter, skip path, failure path.
process.env.TAVILY_API_KEY = "tvly-test";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.RESEND_API_KEY = "re_test_key";
process.env.APP_URL = "https://new.hana.news";
process.env.DATABASE_URL = `file:/tmp/hana-sched-${Date.now()}.db`;
const MODE = process.env.SIM_MODE || "ok"; // ok | thin | searchdown
const now = Date.now(), day = 86400_000;
const hits = Array.from({ length: MODE === "thin" ? 1 : 6 }, (_, i) => ({ url: `https://www.${["bristolpost.co.uk", "bristol247.com", "bbc.co.uk", "theguardian.com", "bristol.ac.uk", "ft.com"][i]}/news/bristol/story-${i}`, title: `Bristol story ${i}`, w: 1500 + i * 100 }));
const sent: { to: string; subject: string; html: string }[] = [];
const reply = (o: unknown) => Response.json({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: JSON.stringify(o) }], stop_reason: "end_turn", usage: { input_tokens: 3000, output_tokens: 300 } });
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  const body = init?.body ? JSON.parse(init.body) : null;
  if (url.includes("api.tavily.com")) {
    if (MODE === "searchdown") return new Response("down", { status: 500 });
    return Response.json({ usage: { credits: 2 }, results: hits.map((h) => ({ url: h.url, title: h.title, content: "s", raw_content: "word ".repeat(h.w), published_date: new Date(now - day).toISOString(), score: 0.8 })) });
  }
  if (url.includes("api.anthropic.com")) {
    const text = body.messages.at(-1).content as string;
    if (text.includes("search queries")) return reply({ queries: ["a", "b", "c", "d", "e"] });
    if (text.includes("Pick up to")) return reply({ picks: [...text.matchAll(/\[(\d+)\]/g)].map((m) => ({ id: m[1], why: "good" })), rejected: [] });
    if (text.includes("Write only these parts")) return reply({ title: "Bristol this week", subject: "Six reads on Bristol this week", execSummary: hits.map((h) => ({ heading: h.title, text: "Takeaway." })), intro: "Editor's note." });
    return reply({ headline: "A headline", summary: "A summary of the article." });
  }
  if (url.includes("api.resend.com")) { sent.push({ to: body.to, subject: body.subject, html: body.html }); return Response.json({ id: "email_1" }); }
  const h = hits.find((x) => x.url === url);
  if (h) return new Response(`<html><head><meta property="og:image" content="https://img.example/${h.title}.jpg"><meta property="og:site_name" content="Bristol Post"></head><body><article>${"word ".repeat(h.w)}</article></body></html>`, { headers: { "content-type": "text/html" } });
  return new Response("nope", { status: 404 });
}) as any;
(async () => {
  const { saveSchedule, getSchedule, getNewsletter, usageForEdition } = await import("../lib/db");
  const { runScheduledEdition } = await import("../lib/autorun");
  const id = await saveSchedule({
    name: "Bristol weekly", recipient: "mark@mathison.ai", enabled: true, next_run_at: null,
    cadence: { freq: "weekly", day: 1, time: "07:00", tz: "Europe/London" },
    recipe: { settings: { topic: "Bristol UK News", numArticles: 6, daysBack: 7, customUrls: "", tone: "Professional", audience: "locals", region: "United Kingdom" }, themeId: "bristol", editionLabel: "Edition 58" },
  });
  const r = await runScheduledEdition((await getSchedule(id))!);
  console.log(`== ${MODE}:`, r.status, "|", r.message);
  for (const e of sent) console.log("   email to", e.to, "| subject:", JSON.stringify(e.subject), "| has 'Open in HANA':", e.html.includes("Open in HANA"), "| link:", e.html.match(/https:\/\/new\.hana\.news\/[^"]+/)?.[0]);
  if (r.newsletterId) {
    const n = (await getNewsletter(r.newsletterId))!;
    console.log("   draft saved:", n.status, "| step", n.draft.step, "| articles", n.draft.articles.length, "| all ready:", n.draft.articles.every((a) => a.status === "ready"), "| images:", n.draft.articles.filter((a) => a.image).length, "| schedule:", n.draft.scheduleName, "| theme:", n.draft.themeId);
    const u = await usageForEdition(r.newsletterId);
    console.log("   cost recorded for this edition:", `$${u.totalUsd.toFixed(4)}`, "|", u.lines.map((l) => `${l.provider}/${l.kind}`).join(", "));
  }
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
