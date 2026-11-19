import { Resend } from "resend";
import { config, demoSend } from "@/lib/config";
import { fail, ok, route } from "@/lib/api";
import { claimForSending, getLists, getSubscribers, markSent, releaseClaim, saveDraft } from "@/lib/db";
import { renderEmail } from "@/lib/email";
import type { Draft } from "@/lib/types";
import { resendEmailUsd } from "@/lib/pricing";
import { recordUsage } from "@/lib/usage";

export const maxDuration = 300;

const BATCH = 100; // Resend batch API limit

/** Turn Resend's domain errors into something actionable. */
function resendError(message: string) {
  if (/domain is not verified|domain mismatch/i.test(message)) {
    return `Resend won't send from ${config.emailFrom}: ${message} Set EMAIL_FROM to an address on a domain that shows "Verified" in Resend (see /setup).`;
  }
  return `Resend: ${message}`;
}

/**
 * POST { draft, testEmail }          -> sends one "[TEST]" copy, nothing is marked sent
 * POST { draft, listId, confirm: n } -> sends to every active subscriber on the list.
 *   `confirm` must equal the active subscriber count the user was shown, so a list
 *   that changed since the confirm dialog opened can't be sent to by accident.
 */
export const POST = route(async (req: Request) => {
  const body = (await req.json()) as { draft: Draft; listId?: string; testEmail?: string; confirm?: number };
  const d = body.draft;
  if (!d?.articles?.length) return fail("This newsletter has no articles.");
  if (!d.subject?.trim()) return fail("Add a subject line.");
  if (d.articles.some((a) => a.status !== "ready" || !a.summary.trim())) {
    return fail("Some articles are still summarising or have no summary.");
  }

  const id = await saveDraft(d);
  const resend = demoSend ? null : new Resend(config.resendKey);
  const webUrl = `${config.appUrl}/view/${id}`;
  const base = {
    title: d.title,
    intro: d.intro,
    execSummary: d.execSummary,
    articles: d.articles,
    themeId: d.themeId,
    editionLabel: d.editionLabel,
    senderAddress: config.senderAddress,
  };

  // ---- Test send ----
  if (body.testEmail) {
    const to = body.testEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail("Enter a valid test email address.");
    const html = renderEmail({ ...base, webUrl, listName: "(test send)" });
    if (resend) {
      const { error } = await resend.emails.send({
        from: config.emailFrom,
        to,
        subject: `[TEST] ${d.subject}`,
        html,
        replyTo: config.emailReplyTo || undefined,
      });
      if (error) return fail(resendError(error.message), 502);
      const per = resendEmailUsd();
      await recordUsage({ provider: "resend", kind: "test email", units: 1, unitLabel: "emails", costUsd: per });
    } else {
      console.log(`[demo send] test to ${to}: ${d.subject}`);
    }
    return ok({ id, test: true, sent: 1, demo: demoSend });
  }

  // ---- Real send ----
  if (!body.listId) return fail("Choose an email list.");
  const list = (await getLists()).find((l) => l.id === body.listId);
  if (!list) return fail("That email list no longer exists.", 404);
  const subs = await getSubscribers(list.id, true);
  if (!subs.length) return fail(`"${list.name}" has no active subscribers.`);
  if (body.confirm !== subs.length) {
    return fail(`The list now has ${subs.length} active subscribers (you confirmed ${body.confirm}). Please confirm again.`, 409);
  }
  if (!(await claimForSending(id))) return fail("This newsletter has already been sent (or is sending now).", 409);

  let sent = 0;
  try {
    for (let i = 0; i < subs.length; i += BATCH) {
      const chunk = subs.slice(i, i + BATCH);
      const emails = chunk.map((s) => {
        const unsub = `${config.appUrl}/unsubscribe/${s.token}`;
        return {
          from: config.emailFrom,
          to: s.email,
          subject: d.subject,
          html: renderEmail({ ...base, webUrl, listName: list.name, unsubscribeUrl: unsub }),
          replyTo: config.emailReplyTo || undefined,
          headers: {
            "List-Unsubscribe": `<${config.appUrl}/api/unsubscribe?token=${s.token}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      });
      if (resend) {
        const { error } = await resend.batch.send(emails);
        if (error) throw new Error(resendError(error.message));
        const per = resendEmailUsd();
        await recordUsage({ provider: "resend", kind: "email", units: emails.length, unitLabel: "emails", costUsd: per == null ? null : per * emails.length });
      } else {
        console.log(`[demo send] batch of ${emails.length} to "${list.name}"`);
      }
      sent += chunk.length;
    }
  } catch (e) {
    if (sent === 0) {
      await releaseClaim(id); // nothing went out, safe to retry
      throw e;
    }
    // Partial send: record what went out and stop, so a retry can't double-send.
    await markSent(id, renderEmail({ ...base, listName: list.name }), list.id, sent);
    return fail(`Sent to ${sent} of ${subs.length} before an error: ${(e as Error).message}`, 502);
  }

  await markSent(id, renderEmail({ ...base, listName: list.name }), list.id, sent);
  return ok({ id, sent, demo: demoSend });
});
