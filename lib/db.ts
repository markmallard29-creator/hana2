import "server-only";
import type { Client } from "@libsql/client";
import { createClient as createRemoteClient } from "@libsql/client/web";
import { randomBytes, randomUUID } from "node:crypto";
import type { Draft } from "./types";

/**
 * Storage is plain SQLite via libsql: a local file in dev, Turso in production.
 * Tables are created on first use, so there is no migration step to run.
 *
 * Remote databases use the pure-fetch client (@libsql/client/web), so production
 * never needs libsql's native binary, which serverless bundlers often drop.
 */

export class SetupError extends Error {
  readonly setup = true;
}

/** Serverless hosts (Netlify/Vercel/Lambda): the disk is read-only, so a hosted database is required. */
export const onServerless = !!(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
/** Railway: a normal server, but its disk is wiped on every deploy unless a volume is attached. */
export const onRailway = !!(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const railwayVolume = (process.env.RAILWAY_VOLUME_MOUNT_PATH || "").trim();
/** Render: also a normal server; data must live on a persistent disk (we expect it at /var/data). */
export const onRender = process.env.RENDER === "true";
export const RENDER_DISK = (process.env.DATA_DIR || "/var/data").trim();
async function renderDiskReady() {
  const { existsSync } = await import("node:fs");
  return existsSync(RENDER_DISK);
}

/** Which storage the app will use, for the setup page. */
export function storageKind() {
  const url = (process.env.DATABASE_URL || "").trim();
  if (url && !url.startsWith("file:")) return "Hosted database (Turso)";
  if (onRailway) return railwayVolume ? `Railway volume (${railwayVolume}/hana.db)` : "None: attach a Railway volume";
  if (onRender) return `Render disk (${RENDER_DISK}/hana.db)`;
  if (onServerless) return "None: set DATABASE_URL";
  return `Local file (${url || "file:./data/hana.db"})`;
}

let client: Client | null = null;
let ready: Promise<void> | null = null;

async function getClient(): Promise<Client> {
  if (client) return client;
  const url = (process.env.DATABASE_URL || "").trim();
  const authToken = (process.env.DATABASE_AUTH_TOKEN || "").trim() || undefined;

  if (!url || url.startsWith("file:")) {
    if (onServerless) {
      throw new SetupError(
        "DATABASE_URL isn't set to a hosted database. On Netlify/Vercel the disk is read-only, so set DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN from Turso, then redeploy.",
      );
    }
    let fileUrl = url || "file:./data/hana.db";
    if (onRailway && !url) {
      if (!railwayVolume) {
        throw new SetupError(
          "No Railway volume is attached, so your lists and newsletters would be wiped on every deploy. In Railway, right-click the project canvas → Volume → attach it to this service with mount path /app/data, then redeploy.",
        );
      }
      fileUrl = `file:${railwayVolume.replace(/\/$/, "")}/hana.db`;
    }
    if (onRender && !url) {
      if (!(await renderDiskReady())) {
        throw new SetupError(
          `No persistent disk found at ${RENDER_DISK}, so your lists and newsletters would be wiped on every deploy. In Render, open this service → Disks → Add disk with mount path ${RENDER_DISK} (1 GB is plenty).`,
        );
      }
      fileUrl = `file:${RENDER_DISK.replace(/\/$/, "")}/hana.db`;
    }
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(fileUrl.slice("file:".length)), { recursive: true });
    const { createClient } = await import("@libsql/client");
    client = createClient({ url: fileUrl });
    return client;
  }
  if (!/^(libsql|https|wss?):\/\//.test(url)) {
    throw new SetupError(`DATABASE_URL should start with libsql:// (got "${url.slice(0, 12)}…").`);
  }
  if (!authToken && /turso\.io/.test(url)) {
    throw new SetupError("DATABASE_AUTH_TOKEN is missing. Create one with: turso db tokens create <db-name>");
  }
  client = createRemoteClient({ url, authToken });
  return client;
}

async function db() {
  const c = await getClient();
  if (!ready) {
    ready = c
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS lists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS subscribers (
            id TEXT PRIMARY KEY,
            list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
            email TEXT NOT NULL COLLATE NOCASE,
            name TEXT,
            token TEXT NOT NULL UNIQUE,
            unsubscribed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (list_id, email)
          )`,
          `CREATE TABLE IF NOT EXISTS newsletters (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'draft',
            topic TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            data TEXT NOT NULL,
            html TEXT,
            list_id TEXT,
            recipients INTEGER,
            sent_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS usage_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            edition_id TEXT,
            provider TEXT NOT NULL,
            kind TEXT NOT NULL,
            model TEXT,
            units REAL NOT NULL DEFAULT 0,
            unit_label TEXT NOT NULL,
            cost_usd REAL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS usage_by_edition ON usage_events (edition_id)`,
          `CREATE INDEX IF NOT EXISTS usage_by_time ON usage_events (created_at)`,
        ],
        "write",
      )
      .then(() => undefined)
      .catch((e: Error) => {
        ready = null; // don't cache a failure; retry on the next request
        client = null;
        throw new SetupError(`Couldn't connect to the database: ${e.message}`);
      });
  }
  await ready;
  return c;
}

// ---------- Lists ----------

export interface ListRow {
  id: string;
  name: string;
  active: number;
  total: number;
}

export async function getLists(): Promise<ListRow[]> {
  const c = await db();
  const r = await c.execute(`
    SELECT l.id, l.name,
      COUNT(s.id) AS total,
      SUM(CASE WHEN s.id IS NOT NULL AND s.unsubscribed_at IS NULL THEN 1 ELSE 0 END) AS active
    FROM lists l LEFT JOIN subscribers s ON s.list_id = l.id
    GROUP BY l.id ORDER BY l.name COLLATE NOCASE`);
  return r.rows.map((x) => ({
    id: String(x.id),
    name: String(x.name),
    total: Number(x.total ?? 0),
    active: Number(x.active ?? 0),
  }));
}

export async function createList(name: string) {
  const c = await db();
  const id = randomUUID();
  await c.execute({ sql: "INSERT INTO lists (id, name) VALUES (?, ?)", args: [id, name.trim()] });
  return id;
}

export async function renameList(id: string, name: string) {
  const c = await db();
  await c.execute({ sql: "UPDATE lists SET name = ? WHERE id = ?", args: [name.trim(), id] });
}

export async function deleteList(id: string) {
  const c = await db();
  await c.batch(
    [
      { sql: "DELETE FROM subscribers WHERE list_id = ?", args: [id] },
      { sql: "DELETE FROM lists WHERE id = ?", args: [id] },
    ],
    "write",
  );
}

export interface SubscriberRow {
  id: string;
  email: string;
  name: string | null;
  token: string;
  unsubscribed_at: string | null;
}

export async function getSubscribers(listId: string, activeOnly = false): Promise<SubscriberRow[]> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT id, email, name, token, unsubscribed_at FROM subscribers
          WHERE list_id = ? ${activeOnly ? "AND unsubscribed_at IS NULL" : ""}
          ORDER BY email`,
    args: [listId],
  });
  return r.rows.map((x) => ({
    id: String(x.id),
    email: String(x.email),
    name: x.name == null ? null : String(x.name),
    token: String(x.token),
    unsubscribed_at: x.unsubscribed_at == null ? null : String(x.unsubscribed_at),
  }));
}

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]{2,}$/;

/** Accepts "a@b.com", "Name <a@b.com>", or CSV lines "email,name". */
export function parseRecipients(raw: string) {
  const out: { email: string; name: string | null }[] = [];
  const invalid: string[] = [];
  for (const line of raw.split(/[\n;]+/)) {
    const t = line.trim();
    if (!t) continue;
    let email = "";
    let name: string | null = null;
    const angle = t.match(/^(.*)<([^>]+)>\s*$/);
    if (angle) {
      email = angle[2].trim();
      name = angle[1].replace(/["',]/g, "").trim() || null;
    } else {
      const parts = t.split(/[,\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      const e = parts.find((p) => EMAIL_RE.test(p));
      if (e) {
        email = e;
        name = parts.filter((p) => p && p !== e).join(" ") || null;
      } else email = t;
    }
    if (EMAIL_RE.test(email)) out.push({ email: email.toLowerCase(), name });
    else if (!/^email\b/i.test(t)) invalid.push(t); // ignore a CSV header row
  }
  return { valid: out, invalid };
}

export async function addSubscribers(listId: string, raw: string) {
  const c = await db();
  const { valid, invalid } = parseRecipients(raw);
  let added = 0;
  let existing = 0;
  const optedOut: string[] = [];
  for (const s of valid) {
    const prev = await c.execute({
      sql: "SELECT unsubscribed_at FROM subscribers WHERE list_id = ? AND email = ?",
      args: [listId, s.email],
    });
    if (prev.rows[0]) {
      // Never silently re-subscribe someone who opted out.
      if (prev.rows[0].unsubscribed_at != null) optedOut.push(s.email);
      else existing++;
      continue;
    }
    await c.execute({
      sql: "INSERT INTO subscribers (id, list_id, email, name, token) VALUES (?, ?, ?, ?, ?)",
      args: [randomUUID(), listId, s.email, s.name, randomBytes(18).toString("base64url")],
    });
    added++;
  }
  return { added, existing, optedOut, invalid };
}

export async function removeSubscriber(id: string) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM subscribers WHERE id = ?", args: [id] });
}

export async function subscriberByToken(token: string) {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT s.email, s.unsubscribed_at, l.name AS list_name FROM subscribers s
          JOIN lists l ON l.id = s.list_id WHERE s.token = ?`,
    args: [token],
  });
  const x = r.rows[0];
  return x
    ? { email: String(x.email), listName: String(x.list_name), unsubscribed: x.unsubscribed_at != null }
    : null;
}

export async function unsubscribeByToken(token: string) {
  const c = await db();
  const r = await c.execute({
    sql: `UPDATE subscribers SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now'))
          WHERE token = ? RETURNING email`,
    args: [token],
  });
  return r.rows[0] ? String(r.rows[0].email) : null;
}

// ---------- Newsletters ----------

export interface NewsletterRow {
  id: string;
  status: "draft" | "sent";
  topic: string;
  title: string;
  subject: string;
  recipients: number | null;
  sent_at: string | null;
  updated_at: string;
  list_name: string | null;
  cost_usd: number | null;
  step: number | null;
  article_count: number;
}

export async function listNewsletters(): Promise<NewsletterRow[]> {
  const c = await db();
  const r = await c.execute(`
    SELECT n.id, n.status, n.topic, n.title, n.subject, n.recipients, n.sent_at, n.updated_at, l.name AS list_name,
      (SELECT SUM(cost_usd) FROM usage_events u WHERE u.edition_id = n.id) AS cost_usd,
      json_extract(n.data, '$.step') AS step,
      json_array_length(n.data, '$.articles') AS article_count
    FROM newsletters n LEFT JOIN lists l ON l.id = n.list_id
    ORDER BY COALESCE(n.sent_at, n.updated_at) DESC LIMIT 200`);
  return r.rows.map((x) => ({
    id: String(x.id),
    status: String(x.status) as "draft" | "sent",
    topic: String(x.topic),
    title: String(x.title),
    subject: String(x.subject),
    recipients: x.recipients == null ? null : Number(x.recipients),
    sent_at: x.sent_at == null ? null : String(x.sent_at),
    updated_at: String(x.updated_at),
    list_name: x.list_name == null ? null : String(x.list_name),
    cost_usd: x.cost_usd == null ? null : Number(x.cost_usd),
    step: x.step == null ? null : Number(x.step),
    article_count: Number(x.article_count ?? 0),
  }));
}

/**
 * Full article text is only needed until an article is summarised, so it's dropped
 * from ready articles but kept for the rest, letting a reopened draft carry on summarising.
 */
function slim(d: Draft): Draft {
  return { ...d, articles: d.articles.map(({ content, ...a }) => (a.status === "ready" ? a : { ...a, content })) };
}

export async function saveDraft(d: Draft): Promise<string> {
  const c = await db();
  const id = d.id || randomUUID();
  const data = JSON.stringify({ ...slim(d), id });
  await c.execute({
    sql: `INSERT INTO newsletters (id, topic, title, subject, data, list_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET topic = excluded.topic, title = excluded.title,
            subject = excluded.subject, data = excluded.data, list_id = excluded.list_id,
            updated_at = datetime('now')
          WHERE newsletters.status = 'draft'`,
    args: [id, d.settings.topic, d.title, d.subject, data, d.listId],
  });
  return id;
}

export async function getNewsletter(id: string) {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM newsletters WHERE id = ?", args: [id] });
  const x = r.rows[0];
  if (!x) return null;
  return {
    id: String(x.id),
    status: String(x.status) as "draft" | "sent",
    draft: JSON.parse(String(x.data)) as Draft,
    html: x.html == null ? null : String(x.html),
    sent_at: x.sent_at == null ? null : String(x.sent_at),
  };
}

/** Atomically move a draft to 'sending' so a double-click can't send twice. */
export async function claimForSending(id: string) {
  const c = await db();
  const r = await c.execute({
    sql: "UPDATE newsletters SET status = 'sending' WHERE id = ? AND status = 'draft'",
    args: [id],
  });
  return r.rowsAffected === 1;
}

export async function releaseClaim(id: string) {
  const c = await db();
  await c.execute({ sql: "UPDATE newsletters SET status = 'draft' WHERE id = ? AND status = 'sending'", args: [id] });
}

export async function markSent(id: string, html: string, listId: string, recipients: number) {
  const c = await db();
  await c.execute({
    sql: `UPDATE newsletters SET status = 'sent', html = ?, list_id = ?, recipients = ?,
            sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [html, listId, recipients, id],
  });
}

export async function deleteNewsletter(id: string) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM newsletters WHERE id = ?", args: [id] });
}

export async function duplicateNewsletter(id: string) {
  const n = await getNewsletter(id);
  if (!n) return null;
  // Keep the recipe (settings, theme, list), not last edition's content.
  const d = n.draft;
  return saveDraft({
    settings: d.settings,
    themeId: d.themeId,
    editionLabel: bumpEdition(d.editionLabel),
    listId: d.listId,
    articles: [],
    title: "",
    intro: "",
    execSummary: [],
    subject: "",
  });
}

/** "Edition 57" -> "Edition 58". Anything without a trailing number is kept as is. */
export function bumpEdition(label: string) {
  return (label || "").replace(/(\d+)(\D*)$/, (_, n, tail) => `${Number(n) + 1}${tail}`);
}

/** Used by /setup to check the connection. */
export async function checkDb(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- Cost meter ----------

export async function insertUsage(e: {
  editionId: string | null;
  provider: string;
  kind: string;
  model?: string;
  units: number;
  unitLabel: string;
  costUsd: number | null;
}) {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO usage_events (edition_id, provider, kind, model, units, unit_label, cost_usd)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [e.editionId, e.provider, e.kind, e.model ?? null, e.units, e.unitLabel, e.costUsd],
  });
}

export interface UsageLine {
  provider: string;
  kind: string;
  model: string | null;
  calls: number;
  units: number;
  unitLabel: string;
  costUsd: number;
  unpriced: number; // calls whose price we don't know
}

export interface UsageReport {
  totalUsd: number;
  calls: number;
  unpriced: number;
  lines: UsageLine[];
}

function toReport(rows: Record<string, unknown>[]): UsageReport {
  const lines = rows.map((x) => ({
    provider: String(x.provider),
    kind: String(x.kind),
    model: x.model == null ? null : String(x.model),
    calls: Number(x.calls),
    units: Number(x.units ?? 0),
    unitLabel: String(x.unit_label),
    costUsd: Number(x.cost ?? 0),
    unpriced: Number(x.unpriced ?? 0),
  }));
  return {
    totalUsd: lines.reduce((a, l) => a + l.costUsd, 0),
    calls: lines.reduce((a, l) => a + l.calls, 0),
    unpriced: lines.reduce((a, l) => a + l.unpriced, 0),
    lines,
  };
}

const GROUPED = `SELECT provider, kind, model, unit_label, COUNT(*) AS calls, SUM(units) AS units,
    SUM(COALESCE(cost_usd, 0)) AS cost, SUM(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) AS unpriced
  FROM usage_events`;

export async function usageForEdition(editionId: string): Promise<UsageReport> {
  const c = await db();
  const r = await c.execute({
    sql: `${GROUPED} WHERE edition_id = ? GROUP BY provider, kind, model, unit_label ORDER BY cost DESC`,
    args: [editionId],
  });
  return toReport(r.rows as unknown as Record<string, unknown>[]);
}

/** Spend since the first of this month (UTC). */
export async function usageThisMonth(): Promise<UsageReport> {
  const c = await db();
  const r = await c.execute(
    `${GROUPED} WHERE created_at >= strftime('%Y-%m-01 00:00:00', 'now') GROUP BY provider, kind, model, unit_label ORDER BY cost DESC`,
  );
  return toReport(r.rows as unknown as Record<string, unknown>[]);
}
