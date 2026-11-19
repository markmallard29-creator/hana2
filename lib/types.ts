export type Tone = "Professional" | "Casual" | "Technical" | "Conversational";
export const TONES: Tone[] = ["Professional", "Casual", "Technical", "Conversational"];

export interface Settings {
  topic: string;
  numArticles: number; // 1..20
  daysBack: number; // 1..30
  customUrls: string;
  tone: Tone;
  audience: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  source: string; // publication name, e.g. "Bristol Post"
  publishedAt: string | null; // ISO date
  image: string | null;
  wordCount: number;
  readMins: number;
  summary: string;
  /** Full text used for summarising. Never sent to the client after summarising. */
  content?: string;
  status: "pending" | "summarising" | "ready" | "error";
  custom?: boolean;
  whyPicked?: string;
}

export interface ExecItem {
  heading: string;
  text: string;
}

export interface Theme {
  id: string;
  name: string;
  headerBg: string;
  headerText: string;
  accent: string; // links + headings
  barBg?: string; // optional edition bar under the masthead
  barText?: string;
}

export const THEMES: Theme[] = [
  { id: "hana", name: "HANA Blue", headerBg: "#3B63E4", headerText: "#FFFFFF", accent: "#3B63E4" },
  {
    id: "bristol",
    name: "HANA Bristol",
    headerBg: "#111827",
    headerText: "#FFFFFF",
    accent: "#B8901F",
    barBg: "#C9A227",
    barText: "#111827",
  },
  {
    id: "oxford",
    name: "HANA Oxford",
    headerBg: "#000000",
    headerText: "#FFFFFF",
    accent: "#000000",
    barBg: "#FACC15",
    barText: "#000000",
  },
  { id: "mediamorph", name: "Media Morph", headerBg: "#0F172A", headerText: "#FFFFFF", accent: "#0F766E" },
];

export interface Draft {
  id?: string;
  settings: Settings;
  articles: Article[];
  title: string;
  intro: string;
  execSummary: ExecItem[];
  subject: string;
  themeId: string;
  editionLabel: string;
  listId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  topic: "",
  numArticles: 8,
  daysBack: 5,
  customUrls: "",
  tone: "Professional",
  audience: "business professionals",
};
