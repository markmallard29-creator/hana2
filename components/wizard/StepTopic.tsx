"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";
import { TONES, type Settings, type Tone } from "@/lib/types";
import { Input, Label, Select, Slider, Textarea, api, cx } from "../ui";

const PRESETS = ["AI News", "Cybersecurity", "Stem cell research"];

export function StepTopic({ settings: s, onChange }: { settings: Settings; onChange: (s: Partial<Settings>) => void }) {
  const [refining, setRefining] = useState(false);
  const [refineErr, setRefineErr] = useState<string | null>(null);

  async function refine() {
    setRefining(true);
    setRefineErr(null);
    try {
      const r = await api<{ topic: string }>("/api/topic", { topic: s.topic, audience: s.audience });
      onChange({ topic: r.topic });
    } catch (e) {
      setRefineErr((e as Error).message);
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap justify-center gap-5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange({ topic: p })}
            className={cx(
              "rounded-lg border px-8 py-6 text-[30px] font-bold tracking-tight shadow-sm transition-colors",
              s.topic === p ? "border-brand bg-brand-light" : "border-gray-200 bg-white hover:border-gray-300",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="topic">Newsletter Topic</Label>
        <div className="flex gap-3">
          <Input
            id="topic"
            value={s.topic}
            autoFocus
            placeholder="Enter a topic or describe what you're interested in"
            onChange={(e) => onChange({ topic: e.target.value })}
            className={s.topic ? "bg-brand-light/60" : ""}
          />
          <button
            type="button"
            onClick={refine}
            disabled={refining}
            title="Sharpen this topic with AI"
            aria-label="Sharpen this topic with AI"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Wand2 className={cx("h-5 w-5", refining && "animate-pulse")} />
          </button>
        </div>
        {refineErr && <p className="mt-2 text-sm text-red-700">{refineErr}</p>}
      </div>

      <div>
        <Label htmlFor="num">Number of Articles</Label>
        <Slider id="num" min={1} max={20} value={s.numArticles} onChange={(v) => onChange({ numArticles: v })} />
      </div>

      <div>
        <Label htmlFor="days">Number of Days Back</Label>
        <Slider id="days" min={1} max={30} value={s.daysBack} onChange={(v) => onChange({ daysBack: v })} />
      </div>

      <div>
        <Label htmlFor="urls">Custom URLs</Label>
        <Textarea
          id="urls"
          rows={3}
          value={s.customUrls}
          placeholder="Enter URLs for any blog posts or news items you'd like to include, one per line"
          onChange={(e) => onChange({ customUrls: e.target.value })}
        />
        <p className="mt-2 text-sm text-gray-500">These are added on top of the {s.numArticles} researched articles.</p>
      </div>

      <div>
        <Label htmlFor="tone">Tone of Voice</Label>
        <Select id="tone" value={s.tone} onChange={(e) => onChange({ tone: e.target.value as Tone })}>
          {TONES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="aud">Target Audience</Label>
        <Input id="aud" value={s.audience} onChange={(e) => onChange({ audience: e.target.value })} />
      </div>
    </div>
  );
}
