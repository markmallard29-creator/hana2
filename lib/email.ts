import { THEMES, type Article, type ExecItem, type Theme } from "./types";

/**
 * Email-safe HTML: tables, inline styles, 600px column, no external CSS.
 * Used both for the in-app preview and the real send, so they always match.
 */

export interface EmailInput {
  title: string;
  intro: string;
  execSummary: ExecItem[];
  articles: Pick<Article, "url" | "title" | "source" | "publishedAt" | "image" | "summary" | "readMins">[];
  themeId: string;
  editionLabel?: string;
  preheader?: string;
  unsubscribeUrl?: string;
  webUrl?: string;
  listName?: string;
  senderAddress?: string;
}

/**
 * Content only, for pasting into Beehiiv (or sending through its API): no <html>/<head>,
 * no masthead and no footer, because the Beehiiv template supplies its own header,
 * branding and unsubscribe footer. Inline styles only, since Beehiiv strips <style> tags.
 */
export function renderFragment(e: EmailInput): string {
  const rows = contentRows(e, 24);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escape, then turn blank-line-separated text into paragraphs. */
function paras(s: string, style: string) {
  return s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
const TEXT = "#374151";
const MUTED = "#6B7280";

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function renderEmail(e: EmailInput): string {
  const t = themeById(e.themeId);
  const preheader = e.preheader || e.execSummary[0]?.text || e.intro.slice(0, 120);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const { bar, intro, exec, articles } = sections(e, 40);

  const footerBits = [
    e.listName ? `You're receiving this because you're subscribed to ${esc(e.listName)}.` : "",
    [
      e.webUrl ? `<a href="${esc(e.webUrl)}" style="color:${MUTED};">View in browser</a>` : "",
      e.unsubscribeUrl ? `<a href="${esc(e.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>` : "",
    ]
      .filter(Boolean)
      .join(" &nbsp;|&nbsp; "),
    e.senderAddress ? esc(e.senderAddress) : "",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(e.title)}</title>
<style>
  @media (max-width: 620px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    td[style*="padding:24px 40px"], td[style*="padding:28px 40px"], td[style*="padding:36px 40px"], td[style*="padding:10px 40px"], td[style*="padding:8px 40px"], td[style*="padding:0 40px"], td[style*="padding:16px 40px"] { padding-left: 20px !important; padding-right: 20px !important; }
    h1 { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E5E7EB;">
      <tr><td style="background:${t.headerBg};padding:36px 40px;">
        <h1 style="margin:0;font:800 32px/1.15 ${FONT};color:${t.headerText};">${esc(e.title)}</h1>
      </td></tr>
      ${bar}
      ${intro}
      ${exec}
      ${articles}
      <tr><td style="padding:28px 40px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
        ${footerBits.map((b) => `<p style="margin:0 0 6px;font:12px/1.5 ${FONT};color:${MUTED};">${b}</p>`).join("")}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function sections(e: EmailInput, px: number) {
  const t = themeById(e.themeId);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const bar = t.barBg
    ? `<tr><td style="background:${t.barBg};color:${t.barText};padding:10px ${px}px;font:600 13px/1.4 ${FONT};letter-spacing:.04em;text-transform:uppercase;">
        ${esc(e.editionLabel || "")}${e.editionLabel ? " &nbsp;·&nbsp; " : ""}${esc(today)}
      </td></tr>`
    : e.editionLabel
      ? `<tr><td style="padding:16px ${px}px 0;font:600 12px/1.4 ${FONT};color:${MUTED};letter-spacing:.04em;text-transform:uppercase;">${esc(e.editionLabel)} &nbsp;·&nbsp; ${esc(today)}</td></tr>`
      : "";

  const intro = e.intro.trim()
    ? `<tr><td style="padding:28px ${px}px 4px;">${paras(e.intro, `margin:0 0 14px;font:16px/1.6 ${FONT};color:${TEXT};`)}</td></tr>`
    : "";

  const exec = e.execSummary.length
    ? `<tr><td style="padding:24px ${px}px 8px;">
        <p style="margin:0 0 12px;font:700 13px/1.4 ${FONT};color:${t.accent};letter-spacing:.06em;text-transform:uppercase;">In this edition</p>
        ${e.execSummary
          .map(
            (x) =>
              `<p style="margin:0 0 12px;font:15px/1.55 ${FONT};color:${TEXT};"><strong style="color:#111827;">${esc(x.heading)}</strong>: ${esc(x.text)}</p>`,
          )
          .join("")}
      </td></tr>
      <tr><td style="padding:8px ${px}px;"><div style="border-top:1px solid #E5E7EB;"></div></td></tr>`
    : "";

  const articles = e.articles
    .map((a) => {
      const meta = [a.source, fmtDate(a.publishedAt)].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
      const img = a.image
        ? `<a href="${esc(a.url)}" style="text-decoration:none;"><img src="${esc(a.image)}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:8px;margin:0 0 16px;"></a>`
        : "";
      return `<tr><td style="padding:24px ${px}px 20px;">
        ${img}
        <p style="margin:0 0 6px;font:12px/1.4 ${FONT};color:${MUTED};letter-spacing:.02em;">${meta}</p>
        <h2 style="margin:0 0 10px;font:700 20px/1.35 ${FONT};color:#111827;"><a href="${esc(a.url)}" style="color:#111827;text-decoration:none;">${esc(a.title)}</a></h2>
        ${paras(a.summary, `margin:0 0 12px;font:15px/1.6 ${FONT};color:${TEXT};`)}
        <p style="margin:0;font:600 14px/1.4 ${FONT};"><a href="${esc(a.url)}" style="color:${t.accent};text-decoration:none;">Read more at ${esc(a.source)} (${a.readMins} min read) &rarr;</a></p>
      </td></tr>`;
    })
    .join(`<tr><td style="padding:0 ${px}px;"><div style="border-top:1px solid #F3F4F6;"></div></td></tr>`);

  return { bar, intro, exec, articles };
}

function contentRows(e: EmailInput, px: number) {
  const { bar, intro, exec, articles } = sections(e, px);
  return `${bar}${intro}${exec}${articles}`;
}
