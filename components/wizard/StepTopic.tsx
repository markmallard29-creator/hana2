"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";
import { REGIONS, SEARCH_ENGINES, TONES, type SearchOptions, type Settings, type Tone } from "@/lib/types";
import { Input, Label, Select, Slider, Textarea, api, cx } from "../ui";

const PRESETS = ["AI News", "Cybersecurity", "Stem cell research"];

export function StepTopic({
  settings: s,
  search,
  onChange,
}: {
  settings: Settings;
  search?: SearchOptions;
  onChange: (s: Partial<Settings>) => void;
}) {
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

      {search && (
        <div>
          <Label>Research engine</Label>
          <div role="radiogroup" aria-label="Research engine" className="grid gap-3 sm:grid-cols-2">
            {SEARCH_ENGINES.map((e) => {
              const available = search.available[e.id];
              const selected = (s.search ?? search.default) === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!available}
                  onClick={() => onChange({ search: e.id })}
                  className={cx(
                    "flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                    selected ? "border-brand bg-brand-light/60 ring-1 ring-brand" : "border-gray-200 hover:border-gray-300",
                    !available && "cursor-not-allowed opacity-50 hover:border-gray-200",
                  )}
                >
                  <span
                    className={cx(
                      "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-brand" : "border-gray-300",
                    )}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                  <span>
                    <span className="block text-[17px] font-medium">{e.name}</span>
                    <span className="block text-sm text-gray-500">
                      {available ? e.blurb : `Add ${e.id === "exa" ? "EXA_API_KEY" : "TAVILY_API_KEY"} in Render to enable`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      <div>
        <Label htmlFor="region">Readers&apos; region</Label>
        <Select id="region" value={s.region ?? "United Kingdom"} onChange={(e) => onChange({ region: e.target.value })}>
          {REGIONS.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </Select>
        <p className="mt-2 text-sm text-gray-500">
          Focuses the search on this country and tells HANA which place you mean, e.g. Bristol, England, not Bristol, Connecticut.
        </p>
      </div>

      <div>
        <Label htmlFor="sources">
          Favourite sources <span className="font-normal text-gray-400">(optional)</span>
        </Label>
        <Textarea
          id="sources"
          rows={2}
          value={s.sources ?? ""}
          placeholder={"bristolpost.co.uk\nbristol247.com\nbbc.co.uk"}
          onChange={(e) => onChange({ sources: e.target.value })}
        />
        <p className="mt-2 text-sm text-gray-500">
          One website per line. HANA looks there first but still searches everywhere else.
        </p>
      </div>
    </div>
  );
}
