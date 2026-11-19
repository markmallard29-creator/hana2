"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stepper } from "../Stepper";
import { Button, Notice, api, apiStream } from "../ui";
import { Footer, type NextBtn } from "./Footer";
import { DEFAULT_SETTINGS, type Article, type Draft, type SearchOptions, type Settings } from "@/lib/types";
import { StepTopic } from "./StepTopic";
import { StepArticles } from "./StepArticles";
import { StepCustomise } from "./StepCustomise";
import { StepPreview } from "./StepPreview";
import { StepSend } from "./StepSend";
import { StepDone } from "./StepDone";

export function emptyDraft(search?: SearchOptions): Draft {
  return {
    settings: { ...DEFAULT_SETTINGS, search: search?.default },
    articles: [],
    title: "",
    intro: "",
    execSummary: [],
    subject: "",
    themeId: "hana",
    editionLabel: "",
    listId: null,
  };
}

const researchKey = (s: Settings) => JSON.stringify([s.topic.trim(), s.numArticles, s.daysBack, s.customUrls.trim(), s.search ?? ""]);
const SUMMARY_CONCURRENCY = 3;

export function Wizard({ initial, testEmail, search }: { initial: Draft | null; testEmail: string; search?: SearchOptions }) {
  const [draft, setDraft] = useState<Draft>(() => {
    const d = initial ?? emptyDraft(search);
    // Older drafts (or an engine whose key was removed) fall back to the server default.
    const engine = d.settings.search && search?.available[d.settings.search] ? d.settings.search : search?.default;
    return { ...d, settings: { ...d.settings, search: engine } };
  });
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(initial?.articles.length ? 5 : 1);
  const [phase, setPhase] = useState<string | null>(null); // progress label on step 2
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const lastResearch = useRef<string | null>(initial?.articles.length ? researchKey(initial.settings) : null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const setArticles = useCallback(
    (fn: (a: Article[]) => Article[]) => setDraft((d) => ({ ...d, articles: fn(d.articles) })),
    [],
  );
  const patchArticle = useCallback(
    (id: string, patch: Partial<Article>) => setArticles((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    [setArticles],
  );

  // ---- Persistence: save on step change, keep the id in the URL so refresh resumes ----
  const save = useCallback(async () => {
    const d = draftRef.current;
    if (!d.settings.topic.trim()) return;
    try {
      const { id } = await api<{ id: string }>("/api/newsletters", d);
      if (!d.id) {
        setDraft((x) => ({ ...x, id }));
        window.history.replaceState(null, "", `/new?id=${id}`);
      }
    } catch {
      /* autosave is best-effort */
    }
  }, []);

  // ---- Summaries: whenever there are pending articles, run up to N at a time.
  // Each card updates as soon as its summary lands; editing other cards is never blocked.
  const running = useRef(new Set<string>());
  const [kickN, setKickN] = useState(0);
  const kick = useCallback(() => setKickN((n) => n + 1), []);
  useEffect(() => {
    const pending = draft.articles.filter((a) => a.status === "pending" && !running.current.has(a.id));
    for (const next of pending) {
      if (running.current.size >= SUMMARY_CONCURRENCY) break;
      running.current.add(next.id);
      patchArticle(next.id, { status: "summarising" });
      const s = draftRef.current.settings;
      api<{ headline: string; summary: string }>("/api/summarise", {
        article: { title: next.title, source: next.source, url: next.url, content: next.content },
        settings: { tone: s.tone, audience: s.audience, topic: s.topic },
      })
        .then((r) =>
          patchArticle(next.id, { title: r.headline || next.title, summary: r.summary, status: "ready", content: undefined }),
        )
        .catch(() => patchArticle(next.id, { status: "error" }))
        .finally(() => {
          running.current.delete(next.id);
          kick();
        });
    }
  }, [draft.articles, kickN, patchArticle, kick]);

  const runResearch = useCallback(async () => {
    const s = draftRef.current.settings;
    setError(null);
    setPhase(`Searching the web for “${s.topic.trim()}”…`);
    update({ articles: [], execSummary: [], title: "", subject: "" });
    const urls = s.customUrls
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    try {
      const [found, ...custom] = await Promise.all([
        apiStream<{ articles: Article[] }>("/api/research", { settings: s, excludeUrls: urls }, (o) => {
          if (typeof o.progress === "string") setPhase(o.progress);
        }),
        ...urls.map((url) =>
          api<{ article: Article }>("/api/article", { url, search: s.search }).then(
            (r) => r.article,
            (e: Error) => ({ error: `${url}: ${e.message}` }),
          ),
        ),
      ]);
      const customOk = custom.filter((c): c is Article => !("error" in c));
      const customErr = custom.filter((c): c is { error: string } => "error" in c).map((c) => c.error);
      const all = [...customOk, ...found.articles];
      if (!all.length) {
        setError("No articles found for that topic and time window. Try a broader topic or more days back.");
      } else if (customErr.length) {
        setError(`Couldn't add: ${customErr.join("; ")}`);
      } else if (found.articles.length < s.numArticles) {
        setError(`Only found ${found.articles.length} good articles in the last ${s.daysBack} days. Try more days back for more.`);
      }
      lastResearch.current = researchKey(s);
      update({ articles: all });
      kick();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase(null);
    }
  }, [update, kick]);

  const addArticles = useCallback(
    async (opts: { url?: string; more?: number }) => {
      const d = draftRef.current;
      if (opts.url) {
        const { article } = await api<{ article: Article }>("/api/article", { url: opts.url, search: d.settings.search });
        setArticles((as) => [...as, article]);
      } else {
        const { articles } = await apiStream<{ articles: Article[] }>(
          "/api/research",
          { settings: d.settings, excludeUrls: d.articles.map((a) => a.url), count: opts.more ?? 3 },
          () => {},
        );
        if (!articles.length) throw new Error("No more articles found. Try more days back.");
        setArticles((as) => [...as, ...articles]);
      }
      kick();
    },
    [setArticles, kick],
  );

  // ---- Navigation ----
  const go = useCallback(
    (n: number) => {
      setError(null);
      setStep(n);
      setMaxReached((m) => Math.max(m, n));
      window.scrollTo({ top: 0 });
      void save();
      if (n === 2 && lastResearch.current !== researchKey(draftRef.current.settings)) void runResearch();
    },
    [save, runResearch],
  );

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (step > 1 && step < 6) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [step]);

  const a = draft.articles;
  const busy = phase !== null || a.some((x) => x.status === "pending" || x.status === "summarising");
  const hasErrors = a.some((x) => x.status === "error");

  let next: NextBtn | null = null;
  if (step === 1)
    next = { label: "Next: review content", disabled: !draft.settings.topic.trim(), reason: "Enter a topic first" };
  if (step === 2)
    next = {
      label: "Next: customise email",
      disabled: busy || hasErrors || !a.length,
      reason: busy ? "Waiting for summaries" : hasErrors ? "Retry or remove the failed articles" : "Add at least one article",
    };
  if (step === 3) next = { label: "Next: preview email", disabled: !draft.title.trim(), reason: "Add a title" };
  if (step === 4) next = { label: "Next: configure send" };

  return (
    <div className="pb-32">
      <div className="pt-12">
        <Stepper step={step} maxReached={maxReached} onJump={go} />
      </div>
      <div className="mx-auto mt-12 max-w-[1150px] px-6">
        {error && (
          <div className="mb-6">
            <Notice tone={step === 2 && a.length ? "warn" : "error"}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                {step === 2 && !a.length && !phase && (
                  <Button size="sm" variant="outline" onClick={() => void runResearch()}>
                    Try again
                  </Button>
                )}
              </div>
            </Notice>
          </div>
        )}
        {step === 1 && (
          <StepTopic settings={draft.settings} search={search} onChange={(s) => update({ settings: { ...draft.settings, ...s } })} />
        )}
        {step === 2 && (
          <StepArticles
            articles={a}
            phase={phase}
            setArticles={setArticles}
            patchArticle={patchArticle}
            retry={(id) => {
              patchArticle(id, { status: "pending" });
              kick();
            }}
            addArticles={addArticles}
            rerun={() => void runResearch()}
          />
        )}
        {step === 3 && <StepCustomise draft={draft} update={update} />}
        {step === 4 && <StepPreview draft={draft} />}
        {step === 5 && (
          <StepSend
            draft={draft}
            update={update}
            defaultTestEmail={testEmail}
            onSent={(n, id) => {
              setSentCount(n);
              update({ id });
              setStep(6);
              setMaxReached(6);
            }}
            onError={setError}
            onBack={() => go(4)}
          />
        )}
        {step === 6 && <StepDone count={sentCount} />}
      </div>

      {step >= 1 && step <= 4 && (
        <Footer onBack={step > 1 ? () => go(step - 1) : undefined} next={next} onNext={() => go(step + 1)} />
      )}
    </div>
  );
}
