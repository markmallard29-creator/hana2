import "server-only";
import { randomUUID } from "node:crypto";
import type { Article, Settings } from "./types";

/** Sample data used when TAVILY_API_KEY / ANTHROPIC_API_KEY aren't set. */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PALETTES = [
  ["#1e3a8a", "#3b82f6"],
  ["#0f766e", "#5eead4"],
  ["#7c2d12", "#fb923c"],
  ["#4c1d95", "#a78bfa"],
  ["#14532d", "#4ade80"],
  ["#831843", "#f472b6"],
];

function placeholder(label: string, i: number) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="600" height="400" fill="url(#g)"/>
<text x="40" y="350" font-family="Helvetica,Arial" font-size="34" font-weight="700" fill="white" opacity="0.9">${label.replace(/[<&>]/g, "")}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const ANGLES = [
  ["The long view: what's really driving", "Feature", 2400],
  ["Inside the numbers behind", "Analysis", 1800],
  ["Five people shaping", "Profile", 3100],
  ["Why the latest data on", "Research", 1500],
  ["The quiet revolution in", "Long read", 4200],
  ["What leaders get wrong about", "Opinion", 1300],
  ["A year on: lessons from", "Investigation", 2900],
  ["How one team rethought", "Case study", 2000],
] as const;

const SOURCES = ["The Guardian", "Financial Times", "BBC News", "The Economist", "WIRED", "Bristol Post", "Reuters", "MIT Technology Review"];

export async function demoResearch(s: Settings, excludeUrls: string[] = [], want = s.numArticles): Promise<Article[]> {
  await sleep(1200);
  const topic = s.topic.trim() || "your topic";
  const start = excludeUrls.length;
  return Array.from({ length: want }, (_, k) => {
    const i = start + k;
    const [lead, kind, words] = ANGLES[i % ANGLES.length];
    const source = SOURCES[i % SOURCES.length];
    const slug = `${topic}-${i}`.toLowerCase().replace(/\W+/g, "-");
    return {
      id: randomUUID(),
      url: `https://example.com/${slug}`,
      title: `${lead} ${topic}`,
      source,
      publishedAt: new Date(Date.now() - ((i % s.daysBack) + 0.3) * 86400_000).toISOString(),
      image: placeholder(kind, i),
      wordCount: words + i * 37,
      readMins: Math.round((words + i * 37) / 230),
      summary: "",
      content: `Demo article ${i + 1} about ${topic}.`,
      status: "pending" as const,
      whyPicked: `${kind}, ${words}+ words`,
      via: s.search ?? "tavily",
    };
  });
}

export async function demoArticleFromUrl(url: string): Promise<Article> {
  await sleep(600);
  let host = "example.com";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  return {
    id: randomUUID(),
    url,
    title: `Custom article from ${host}`,
    source: host,
    publishedAt: new Date().toISOString(),
    image: placeholder("Your link", 3),
    wordCount: 1600,
    readMins: 7,
    summary: "",
    content: "Demo custom article.",
    status: "pending",
    custom: true,
  };
}

export async function demoSummarise(a: Pick<Article, "title" | "source">, s: Pick<Settings, "tone" | "audience">) {
  await sleep(500 + Math.random() * 700);
  return {
    headline: a.title,
    summary: `This is a demo summary written in a ${s.tone.toLowerCase()} tone for ${s.audience}. In live mode, Claude reads the full text of the ${a.source} article and writes a 70–110 word paragraph: what happened or what the piece argues, then why it matters to your readers. Add your Tavily and Anthropic API keys to switch it on.`,
  };
}

export async function demoCompose(articles: Pick<Article, "title">[], s: Pick<Settings, "topic">) {
  await sleep(900);
  const t = s.topic.trim() || "This week";
  return {
    title: `${t}: the week's best reads`,
    subject: `${articles.length} pieces worth your time on ${t.toLowerCase()}`,
    execSummary: articles.map((a, i) => ({
      heading: a.title.split(" ").slice(0, 5).join(" "),
      text: `One-sentence takeaway for article ${i + 1}, written by Claude in live mode.`,
    })),
    intro: `A short editor's note framing this edition's themes. In live mode Claude drafts this from the articles you picked; edit it to sound like you.`,
  };
}
