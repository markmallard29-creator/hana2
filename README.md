HANA replacement: build notes (19 Nov 2026)

What was built: a Next.js 15 production web app replicating app.hana.news's 6-step flow (topic → articles → customise → preview → send → done), plus a dashboard and email-list management. Delivered as hana-newsletter.zip.

Decisions (Mark):

Production web app; reasons for replacing are cost/maintenance and article quality.
Tavily for search, Claude for writing, Resend for sending.
Host on Railway. Netlify: requests time out after 10–26s. Vercel: blocked at the two-factor login step.
Database: SQLite on a Railway volume (mount /app/data). Turso isn't needed on Railway.

Stack: Next.js + Tailwind · Tavily · Claude (Sonnet for ranking and copy, Haiku for summaries) · Resend · SQLite (Railway volume, or Turso on serverless hosts). Demo mode runs with no keys.

Deployment history:

Netlify deploy (fastidious-paprenjak-a7e333.netlify.app) crashed on load: no hosted database, so the app tried to write a file on a read-only disk.
Fixed: production uses the pure-fetch libsql client for remote databases; there's a clear setup message and a /setup page.
Railway-ready: the app uses RAILWAY_VOLUME_MOUNT_PATH automatically and refuses to store data if no volume is attached. Research streams NDJSON progress (avoids Railway's reported ~60s idle first-byte cut-off). There's a /api/health health check and a railway.json.

Changes from the old HANA:

Test send before every real send; the confirm dialog shows the exact recipient count.
Titles no longer wrapped in quote marks.
List names must be unique (the old app had duplicate "Main Email List" / "Colleagues").
"Read more at" names the real publication.
Article cards become editable as each summary finishes.
Article count capped at 1–20 (the old slider went to 25).
Ranking favours long reads: full text and word count from Tavily, Claude ranks for substance, at most 2 articles per publication.
Unsubscribe needs a button click (safe from Microsoft Safe Links scanners); one-click unsubscribe headers included; opted-out people are never re-added by an import.
Double-send lock; partial-failure recording.
Style presets: HANA Blue, Bristol (dark + gold), Oxford (black + yellow), Media Morph.
"New edition with these settings" reuses last week's settings and bumps the edition number.

Open risks:

Tavily is news-leaning; the search layer is swappable (lib/search.ts) if long-read quality disappoints. Exa is the alternative.
The Railway volume is a single disk with no automatic backups; download hana.db periodically.

Not yet built: scheduling, open/click tracking, per-user accounts.
