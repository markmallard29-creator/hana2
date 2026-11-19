"use client";

import { Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEMES, type Draft, type ExecItem } from "@/lib/types";
import { Button, Card, Input, Label, Notice, Select, Textarea, api } from "../ui";

type Part = "title" | "subject" | "execSummary" | "intro";

export function StepCustomise({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  const [busy, setBusy] = useState<Part[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  async function generate(parts: Part[]) {
    setBusy(parts);
    setErr(null);
    try {
      const r = await api<Partial<Record<Part, unknown>>>("/api/compose", {
        articles: draft.articles.map((a) => ({ title: a.title, summary: a.summary, source: a.source })),
        settings: draft.settings,
        parts,
      });
      const patch: Partial<Draft> = {};
      if (r.title) patch.title = r.title as string;
      if (r.subject && (!draft.subject || parts.length === 1)) patch.subject = r.subject as string;
      if (r.execSummary) patch.execSummary = r.execSummary as ExecItem[];
      if (r.intro) patch.intro = r.intro as string;
      update(patch);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // First visit: write the title, subject and executive summary.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const parts: Part[] = [];
    if (!draft.title) parts.push("title");
    if (!draft.subject) parts.push("subject");
    if (!draft.execSummary.length) parts.push("execSummary");
    if (parts.length) void generate(parts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const execStale = draft.execSummary.length > 0 && draft.execSummary.length !== draft.articles.length;
  const is = (p: Part) => !!busy?.includes(p);

  const setItem = (i: number, p: Partial<ExecItem>) =>
    update({ execSummary: draft.execSummary.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  return (
    <div>
      <h2 className="text-[19px] font-medium">Customise your newsletter</h2>
      {err && (
        <div className="mt-4">
          <Notice tone="error">{err}</Notice>
        </div>
      )}

      <Card className="mt-3 space-y-6 p-8">
        <h3 className="text-[17px] font-medium">Email header</h3>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="title" className="text-[15px]">
              Title
            </Label>
            <RegenButton busy={is("title")} onClick={() => generate(["title"])} />
          </div>
          <Input
            id="title"
            value={draft.title}
            placeholder={is("title") ? "Writing a title…" : "Edition headline"}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="theme" className="text-[15px]">
              Style
            </Label>
            <Select id="theme" value={draft.themeId} onChange={(e) => update({ themeId: e.target.value })}>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="edition" className="text-[15px]">
              Edition label <span className="font-normal text-gray-400">(optional)</span>
            </Label>
            <Input
              id="edition"
              value={draft.editionLabel}
              placeholder="e.g. Edition 57"
              onChange={(e) => update({ editionLabel: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-8">
        <div className="flex items-center justify-between">
          <Label htmlFor="intro" className="text-[15px]">
            Intro content
          </Label>
          <Button size="sm" variant="ghost" onClick={() => generate(["intro"])} loading={is("intro")}>
            {!is("intro") && <Sparkles className="h-4 w-4" />} {draft.intro ? "Redraft" : "Draft with AI"}
          </Button>
        </div>
        <Textarea
          id="intro"
          autoGrow
          rows={3}
          value={draft.intro}
          placeholder="Enter your intro copy here"
          onChange={(e) => update({ intro: e.target.value })}
          className="mt-1 leading-relaxed"
        />
      </Card>

      <Card className="mt-6 p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Executive summary</h3>
          <RegenButton busy={is("execSummary")} onClick={() => generate(["execSummary"])} label="Regenerate" />
        </div>
        {execStale && (
          <div className="mt-3">
            <Notice tone="warn">
              You&apos;ve added or removed articles since this was written. Regenerate it so it matches.
            </Notice>
          </div>
        )}
        {is("execSummary") && !draft.execSummary.length ? (
          <div className="mt-4 space-y-3">
            {draft.articles.map((a) => (
              <div key={a.id} className="h-5 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {draft.execSummary.map((x, i) => (
              <li key={i} className="group flex items-start gap-3">
                <span className="mt-4 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-700" />
                <div className="flex-1">
                  <Input
                    value={x.heading}
                    onChange={(e) => setItem(i, { heading: e.target.value })}
                    aria-label={`Bullet ${i + 1} heading`}
                    className="h-10 border-transparent px-2 font-semibold hover:border-gray-200"
                  />
                  <Textarea
                    autoGrow
                    rows={1}
                    value={x.text}
                    onChange={(e) => setItem(i, { text: e.target.value })}
                    aria-label={`Bullet ${i + 1} text`}
                    className="-mt-1 border-transparent px-2 py-1 text-gray-700 hover:border-gray-200"
                  />
                </div>
                <button
                  onClick={() => update({ execSummary: draft.execSummary.filter((_, j) => j !== i) })}
                  aria-label="Remove bullet"
                  className="mt-2 rounded p-1.5 text-gray-400 opacity-0 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          onClick={() => update({ execSummary: [...draft.execSummary, { heading: "", text: "" }] })}
        >
          <Plus className="h-4 w-4" /> Add bullet
        </Button>
      </Card>
    </div>
  );
}

function RegenButton({ busy, onClick, label = "Rewrite" }: { busy: boolean; onClick: () => void; label?: string }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} loading={busy}>
      {!busy && <RefreshCw className="h-3.5 w-3.5" />} {label}
    </Button>
  );
}
