import "server-only";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { config, demoResearch as demoMode, demoSend } from "./config";
import { saveDraft, type ScheduleRow } from "./db";
import { demoArticleFromUrl, demoCompose, demoResearch, demoSummarise } from "./demo";
import { renderEmail } from "./email";
import { resendEmailUsd } from "./pricing";
import { articleFromUrl, compose, research, summarise } from "./research";
import type { Article, Draft } from "./types";
import { recordUsage, withEdition } from "./usage";

/**
 * One unattended edition: the same six steps as the wizard, with no one checking it.
 * The result goes to the schedule's recipient (you), never to a list, and is saved as a
 * draft so it can be edited, copied into beehiiv or sent on from HANA.
 */

export interface RunResult {
  status: "sent" | "skipped" | "failed";
  message: string;
  newsletterId: string | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sendEmail(to: string, subject: string, html: string, kind: string) {
  if (demoSend) {
    console.log(`[demo send] ${kind} to ${to}: ${subject}`);
    return;
  }
  const { error } = await new Resend(config.resendKey).emails.send({
    from: config.emailFrom,
    to,
    subject,
    html,
    replyTo: config.emailReplyTo || undefined,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  const per = resendEmailUsd();
  await recordUsage({ provider: "resend", kind, units: 1, unitLabel: "emails", costUsd: per });
}

/** Plain note for runs that didn't produce an edition. */
function noticeHtml(title: string, body: string, link?: { href: string; text: string }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F3F4F6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;padding:28px 32px;">
<h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${esc(title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${esc(body)}</p>
${link ? `<p style="margin:0;"><a href="${esc(link.href)}" style="color:#3B63E4;font-weight:600;">${esc(link.text)}</a></p>` : ""}
</div></body></html>`;
}

async function summariseAll(articles: Article[], s: Draft["settings"]) {
  const out: Article[] = [];
  let i = 0;
  const worker = async () => {
    for (;;) {
      const a = articles[i++];
      if (!a) return;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = demoMode ? await demoSummarise(a, s) : await summarise(a, s);
          out.push({ ...a, title: r.headline || a.title, summary: r.summary, status: "ready", content: undefined });
          break;
        } catch {
          /* one retry, then drop the article */
        }
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  // keep the research order
  const order = new Map(articles.map((a, k) => [a.id, k]));
  return out.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export async function runScheduledEdition(sch: ScheduleRow): Promise<RunResult> {
  const newsletterId = randomUUID();
  const s = sch.recipe.settings;
  const settingsUrl = `${config.appUrl}/schedules`;

  return withEdition(newsletterId, async () => {
    try {
      // 1. Research (plus any fixed URLs in the recipe)
      const urls = (s.customUrls || "").split(/[\s,]+/).filter((u) => /^https?:\/\//i.test(u));
      const [found, ...custom] = await Promise.all([
        demoMode ? demoResearch(s, urls) : research(s, urls),
        ...urls.map((u) => (demoMode ? demoArticleFromUrl(u) : articleFromUrl(u)).catch(() => null)),
      ]);
      const candidates = [...custom.filter((a): a is Article => !!a && (demoMode || !!a.content)), ...found];

      // 2. Summarise
      const articles = await summariseAll(candidates, s);
      const needed = Math.min(3, s.numArticles);
      if (articles.length < needed) {
        const msg = `Only found ${articles.length} good article${articles.length === 1 ? "" : "s"} in the last ${s.daysBack} day${s.daysBack === 1 ? "" : "s"} (needs at least ${needed}), so nothing was sent.`;
        await sendEmail(
          sch.recipient,
          `HANA: no edition this time for "${sch.name}"`,
          noticeHtml(`No edition this time: ${sch.name}`, `${msg} Try more days back or a broader topic.`, { href: settingsUrl, text: "Edit the schedule" }),
          "schedule notice",
        );
        return { status: "skipped" as const, message: msg, newsletterId: null };
      }

      // 3. Title, subject, summary bullets, intro
      const parts = ["title", "subject", "execSummary", "intro"] as const;
      const c = demoMode ? await demoCompose(articles, s) : await compose(articles, s, [...parts]);

      // 4. Save it as a draft you can open, edit and forward
      const draft: Draft = {
        id: newsletterId,
        settings: s,
        articles,
        title: c.title || s.topic,
        intro: c.intro || "",
        execSummary: c.execSummary ?? [],
        subject: c.subject || c.title || s.topic,
        themeId: sch.recipe.themeId,
        editionLabel: sch.recipe.editionLabel,
        listId: null,
        step: 4,
        scheduleId: sch.id,
        scheduleName: sch.name,
      };
      await saveDraft(draft);

      // 5. Email it to the schedule's recipient
      const open = `${config.appUrl}/new?id=${newsletterId}`;
      const html = renderEmail({
        title: draft.title,
        intro: draft.intro,
        execSummary: draft.execSummary,
        articles: draft.articles,
        themeId: draft.themeId,
        editionLabel: draft.editionLabel,
        senderAddress: config.senderAddress,
        notice: { text: `Your scheduled HANA edition (${sch.name}). Review, edit or copy it into beehiiv:`, href: open, linkText: "Open in HANA" },
      });
      await sendEmail(sch.recipient, draft.subject, html, "scheduled email");
      return {
        status: "sent" as const,
        message: `Sent ${articles.length} articles to ${sch.recipient}`,
        newsletterId,
      };
    } catch (e) {
      const msg = (e as Error).message || "Unknown error";
      console.error(`[schedule ${sch.id}]`, msg);
      // Tell the recipient, unless it's the email itself that's failing.
      if (!/^Resend:/.test(msg)) {
        await sendEmail(
          sch.recipient,
          `HANA: scheduled edition failed for "${sch.name}"`,
          noticeHtml(`Scheduled edition failed: ${sch.name}`, `HANA couldn't build this edition: ${msg}. It will try again at the next scheduled time.`, {
            href: settingsUrl,
            text: "Open schedules",
          }),
          "schedule notice",
        ).catch(() => {});
      }
      return { status: "failed" as const, message: msg, newsletterId: null };
    }
  });
}
