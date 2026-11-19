# HANA: newsletter builder

A rebuild of app.hana.news. Pick a topic, and HANA researches the web for the best recent reads (weighted towards substantive long-form pieces), pulls each article's image and publication name, summarises everything with Claude, lets you edit and reorder, and sends to your list through Resend.

**Stack:** Next.js 15 · Tailwind · Tavily (search) · Claude (ranking + writing) · Resend (email) · SQLite via libsql/Turso (storage).

## The six steps

1. **Topic**: topic (the wand sharpens it into a research brief), 1–20 articles, 1–30 days back, custom URLs, tone, audience.
2. **Articles**: cards fill in as each summary finishes. Edit headline, publication, summary or image; drag (or keyboard: Space, arrows, Space) to reorder; delete; add by URL or "find 3 more". Long reads are badged.
3. **Customise**: title, style (HANA Blue / Bristol / Oxford / Media Morph), edition label, intro (AI draft optional), executive summary bullets.
4. **Preview**: desktop / tablet / mobile, plus the raw HTML to copy or download.
5. **Send**: subject, list (with subscriber counts), add recipients, **send a test first**, then a confirm dialog with the exact recipient count.
6. **Done**.

The dashboard lists drafts and sent editions. "New edition with these settings" copies last week's recipe (topic, counts, tone, style, list) and bumps "Edition 57" to "Edition 58".

## How research works (lib/research.ts)

1. Claude plans 5 searches: 2 news-angle, 3 depth-angle (analysis, features, interviews, long reads).
2. Tavily runs them with `start_date`/`end_date` for the window and returns full article text.
3. Filters: drop social/video/aggregator domains, homepages and tag pages, stubs under 250 words, anything dated before the window, and duplicate URLs (tracking parameters ignored) or headlines.
4. Claude ranks what's left on relevance → substance → length (over 1,200 words favoured) → variety (max 2 per publication, no two on the same story).
5. Each pick's own page is fetched for `og:image`, the publication name and the real publish date; anything that turns out to be out of window is dropped and the next pick is used.
6. Summaries run 3 at a time on the fast model, using the article's full text.

The search provider sits behind an interface in `lib/search.ts`. If Tavily's picks are still too news-heavy, implement `SearchProvider` for Exa and change one line.

## Run locally

```bash
cp .env.example .env.local   # fill in keys, or leave blank for demo mode
npm install
npm run dev                  # http://localhost:3000
```

With no keys it runs in **demo mode**: sample articles, and sends are logged instead of emailed. A banner shows which parts are in demo mode.

## Deploy on Railway (recommended)

Railway runs HANA as a normal always-on server, so long research requests are fine, and the database can live on a Railway **volume**. You don't need Turso.

1. Install the CLI: `npm i -g @railway/cli` (or `brew install railway`), then `railway login`.
2. In this folder: `railway init` (creates the project), then `railway up` (builds and deploys).
3. In the Railway dashboard, on the project canvas:
   - **Volume:** right-click the canvas → *Volume* → attach it to the HANA service with mount path **`/app/data`**. The app finds it automatically through `RAILWAY_VOLUME_MOUNT_PATH`, and without it the app refuses to store data.
   - **Domain:** service → *Settings* → *Networking* → **Generate Domain** (or run `railway domain`).
   - **Variables:** service → *Variables*. Add `TAVILY_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` (the domain you just generated, with https://), `APP_PASSWORD`, `SENDER_ADDRESS`, `TEST_EMAIL`. Do **not** set `DATABASE_URL`.
4. Railway redeploys when variables change. If it doesn't, run `railway up` again.
5. Open **/setup** on your site. Every "required" row should be ticked, and Database should say *Railway volume*.

`railway.json` sets the start command and a health check on `/api/health`. Research streams progress to the browser, so Railway's proxy never sees an idle connection.

**Backups:** the volume is a single disk. Every so often, download `hana.db` with `railway volume browse`, or export your lists.

## Other hosts

- **Vercel:** works. Set `DATABASE_URL`/`DATABASE_AUTH_TOKEN` to a Turso database (turso.tech → Create database → copy URL, Create token).
- **Netlify:** not recommended. Requests stop after 10s (26s on request) and research takes 30–60s.

Tables are created automatically on first request, so there are no migrations to run.

## Moving your lists over from the old HANA

Export each list as CSV and paste it into **Email lists → Add subscribers**. `email,name` columns, `Name <email>` lines and plain addresses all work. List names must be unique.

## Safety rails

- A test send to yourself is offered on every send, and the confirm dialog warns if you skipped it.
- The send request must quote the recipient count you confirmed; if the list changed in between, it stops.
- A newsletter is locked while sending, so a double-click can't send twice. If a send fails partway, it records how many went out rather than letting you resend to everyone.
- Unsubscribe needs a button click (corporate link scanners like Microsoft Safe Links open every link and would otherwise unsubscribe people). Gmail/Apple one-click unsubscribe headers are included.
- People who unsubscribed are never re-added by an import.
- Every email has an unsubscribe link, a "view in browser" link and your postal address (`SENDER_ADDRESS`), as UK PECR and US CAN-SPAM require.
- The whole app sits behind `APP_PASSWORD` except the unsubscribe and browser-view pages.

## Known limits

- Images are hotlinked from the publisher. A few sites block that, so check the test email; swap or remove any broken image on step 2.
- Single shared password, no per-user accounts.
- No open or click tracking and no scheduling yet. Resend webhooks and a Vercel cron are the natural next steps.
- Paywalled sites (FT, some Telegraph) often return only a teaser. These are filtered out as stubs rather than summarised from a teaser.
