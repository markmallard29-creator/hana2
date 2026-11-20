"use client";

import { CalendarClock, Loader2, Pause, Pencil, Play, Plus, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DAYS, describeCadence, formatRunTime, type Cadence, type Freq } from "@/lib/cadence";
import type { Recipe, ScheduleRow } from "@/lib/db";
import { DEFAULT_SETTINGS, REGIONS, SEARCH_ENGINES, THEMES, TONES, type SearchOptions, type Tone } from "@/lib/types";
import { Button, Card, Input, Label, Notice, Select, Textarea, api, cx } from "./ui";

interface FormState {
  id?: string;
  name: string;
  recipe: Recipe;
  cadence: Cadence;
  recipient: string;
  enabled: boolean;
}

const TZ = "Europe/London";

function blankForm(seed: Recipe | null, recipient: string, search: SearchOptions): FormState {
  const settings = seed?.settings ?? { ...DEFAULT_SETTINGS, search: search.default };
  return {
    name: settings.topic || "",
    recipe: { settings: { ...settings, daysBack: Math.max(settings.daysBack, 7) }, themeId: seed?.themeId ?? "hana", editionLabel: seed?.editionLabel ?? "" },
    cadence: { freq: "weekly", day: 1, time: "07:00", tz: TZ },
    recipient,
    enabled: true,
  };
}

export function SchedulesManager({
  initial,
  search,
  defaultRecipient,
  seed,
}: {
  initial: ScheduleRow[];
  search: SearchOptions;
  defaultRecipient: string;
  seed: Recipe | null;
}) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState<FormState | null>(seed ? blankForm(seed, defaultRecipient, search) : null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ schedules: ScheduleRow[] }>("/api/schedules");
    setRows(r.schedules);
    return r.schedules;
  }, []);

  // While anything is running, refresh every few seconds so the result shows up.
  const anyRunning = rows.some((r) => r.running_since);
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [anyRunning, load]);

  async function act(id: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      await load();
      if (done) setMsg({ tone: "success", text: done });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {form ? (
        <ScheduleForm
          form={form}
          setForm={setForm}
          search={search}
          onCancel={() => setForm(null)}
          onSaved={async (text) => {
            setForm(null);
            await load();
            setMsg({ tone: "success", text });
            if (window.location.search) window.history.replaceState(null, "", "/schedules");
          }}
        />
      ) : (
        <Button onClick={() => setForm(blankForm(null, defaultRecipient, search))}>
          <Plus className="h-4 w-4" /> New schedule
        </Button>
      )}

      {rows.length === 0 && !form && (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          <CalendarClock className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 font-medium text-gray-700">No schedules yet</p>
          <p className="mt-1">Create one here, or use the clock icon next to any newsletter on the dashboard to reuse its settings.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-gray-50 text-sm text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Schedule</th>
                <th className="px-5 py-3 font-medium">Next run</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Last run</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className={cx(!r.enabled && "bg-gray-50/60")}>
                  <td className="px-5 py-4 align-top">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-gray-500">
                      {describeCadence(r.cadence)} · to {r.recipient}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.recipe.settings.numArticles} articles from the last {r.recipe.settings.daysBack} days
                      {r.recipe.settings.search ? ` · ${r.recipe.settings.search === "exa" ? "Exa" : "Tavily"}` : ""}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top text-gray-700">
                    {r.running_since ? (
                      <span className="flex items-center gap-1.5 text-brand">
                        <Loader2 className="h-4 w-4 animate-spin" /> Running now…
                      </span>
                    ) : r.enabled ? (
                      formatRunTime(r.next_run_at, r.cadence.tz)
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Paused</span>
                    )}
                  </td>
                  <td className="hidden px-5 py-4 align-top text-sm md:table-cell">
                    {r.last_run_at ? (
                      <>
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            r.last_status === "sent" && "bg-green-50 text-green-700",
                            r.last_status === "skipped" && "bg-amber-50 text-amber-800",
                            r.last_status === "failed" && "bg-red-50 text-red-700",
                          )}
                        >
                          {r.last_status === "sent" ? "Sent" : r.last_status === "skipped" ? "Skipped" : "Failed"}
                        </span>{" "}
                        <span className="text-gray-500">{formatRunTime(r.last_run_at, r.cadence.tz)}</span>
                        <div className="mt-1 text-gray-500">{r.last_message}</div>
                        {r.last_status === "sent" && r.last_newsletter_id && (
                          <a href={`/new?id=${r.last_newsletter_id}`} className="text-brand hover:underline">
                            Open that edition
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">Not run yet</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex justify-end gap-1">
                      <IconBtn
                        label="Run now (emails you an edition straight away)"
                        disabled={!!r.running_since || busy === r.id}
                        onClick={() =>
                          act(r.id, () => api(`/api/schedules/${r.id}/run`, {}), `Running "${r.name}" now. It'll email ${r.recipient} in a minute or two.`)
                        }
                        icon={<Zap className="h-4 w-4" />}
                      />
                      <IconBtn
                        label={r.enabled ? "Pause" : "Resume"}
                        disabled={busy === r.id}
                        onClick={() => act(r.id, () => api(`/api/schedules/${r.id}`, { enabled: !r.enabled }, "PATCH"))}
                        icon={r.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      />
                      <IconBtn
                        label="Edit"
                        onClick={() =>
                          setForm({ id: r.id, name: r.name, recipe: r.recipe, cadence: r.cadence, recipient: r.recipient, enabled: r.enabled })
                        }
                        icon={<Pencil className="h-4 w-4" />}
                      />
                      <IconBtn
                        label="Delete"
                        danger
                        disabled={busy === r.id}
                        onClick={() => {
                          if (confirm(`Delete the schedule "${r.name}"? Editions it already made stay on the dashboard.`)) {
                            void act(r.id, () => api(`/api/schedules/${r.id}`, undefined, "DELETE"), "Schedule deleted.");
                          }
                        }}
                        icon={<Trash2 className="h-4 w-4" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScheduleForm({
  form,
  setForm,
  search,
  onCancel,
  onSaved,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  search: SearchOptions;
  onCancel: () => void;
  onSaved: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const s = form.recipe.settings;
  const setS = (p: Partial<typeof s>) => setForm({ ...form, recipe: { ...form.recipe, settings: { ...s, ...p } } });
  const setC = (p: Partial<Cadence>) => setForm({ ...form, cadence: { ...form.cadence, ...p } });

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await api("/api/schedules", form);
      onSaved(`${form.id ? "Updated" : "Created"} "${form.name || s.topic}": ${describeCadence(form.cadence).toLowerCase()}, emailed to ${form.recipient}.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">{form.id ? "Edit schedule" : "New schedule"}</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="s-topic" className="text-[15px]">
            Topic
          </Label>
          <Input
            id="s-topic"
            value={s.topic}
            placeholder="e.g. Bristol UK News"
            onChange={(e) => setForm({ ...form, name: !form.name || form.name === s.topic ? e.target.value : form.name, recipe: { ...form.recipe, settings: { ...s, topic: e.target.value } } })}
          />
        </div>
        <div>
          <Label htmlFor="s-name" className="text-[15px]">
            Schedule name
          </Label>
          <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="s-to" className="text-[15px]">
            Email it to
          </Label>
          <Input id="s-to" type="email" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
        </div>

        <div>
          <Label htmlFor="s-freq" className="text-[15px]">
            How often
          </Label>
          <Select id="s-freq" value={form.cadence.freq} onChange={(e) => setC({ freq: e.target.value as Freq, day: form.cadence.day ?? 1 })}>
            <option value="weekly">Weekly</option>
            <option value="weekdays">Every weekday (Mon–Fri)</option>
            <option value="daily">Every day</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {form.cadence.freq === "weekly" && (
            <div>
              <Label htmlFor="s-day" className="text-[15px]">
                Day
              </Label>
              <Select id="s-day" value={form.cadence.day ?? 1} onChange={(e) => setC({ day: Number(e.target.value) })}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className={form.cadence.freq === "weekly" ? "" : "col-span-2"}>
            <Label htmlFor="s-time" className="text-[15px]">
              Time (UK)
            </Label>
            <Input id="s-time" type="time" value={form.cadence.time} onChange={(e) => setC({ time: e.target.value })} className="h-[52px]" />
          </div>
        </div>

        <div>
          <Label htmlFor="s-num" className="text-[15px]">
            Number of articles
          </Label>
          <Input id="s-num" type="number" min={1} max={20} value={s.numArticles} onChange={(e) => setS({ numArticles: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="s-days" className="text-[15px]">
            Days back
          </Label>
          <Input id="s-days" type="number" min={1} max={30} value={s.daysBack} onChange={(e) => setS({ daysBack: Number(e.target.value) })} />
          <p className="mt-1 text-xs text-gray-500">
            Match it to how often it runs: {form.cadence.freq === "weekly" ? "7 for weekly" : "1 for daily (3 covers Mondays after a weekend)"}.
          </p>
        </div>

        <div>
          <Label htmlFor="s-engine" className="text-[15px]">
            Research engine
          </Label>
          <Select id="s-engine" value={s.search ?? search.default} onChange={(e) => setS({ search: e.target.value as "tavily" | "exa" })}>
            {SEARCH_ENGINES.map((e) => (
              <option key={e.id} value={e.id} disabled={!search.available[e.id]}>
                {e.name}: {e.blurb}
                {!search.available[e.id] ? " (no key set)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="s-region" className="text-[15px]">
            Readers&apos; region
          </Label>
          <Select id="s-region" value={s.region ?? "United Kingdom"} onChange={(e) => setS({ region: e.target.value })}>
            {REGIONS.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="s-tone" className="text-[15px]">
            Tone
          </Label>
          <Select id="s-tone" value={s.tone} onChange={(e) => setS({ tone: e.target.value as Tone })}>
            {TONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="s-aud" className="text-[15px]">
            Audience
          </Label>
          <Input id="s-aud" value={s.audience} onChange={(e) => setS({ audience: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="s-theme" className="text-[15px]">
            Style
          </Label>
          <Select id="s-theme" value={form.recipe.themeId} onChange={(e) => setForm({ ...form, recipe: { ...form.recipe, themeId: e.target.value } })}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="s-sources" className="text-[15px]">
            Favourite sources <span className="font-normal text-gray-400">(optional)</span>
          </Label>
          <Textarea id="s-sources" rows={2} value={s.sources ?? ""} placeholder={"bristolpost.co.uk\nbristol247.com"} onChange={(e) => setS({ sources: e.target.value })} />
        </div>
      </div>

      {err && (
        <div className="mt-5">
          <Notice tone="error">{err}</Notice>
        </div>
      )}
      <p className="mt-5 text-sm text-gray-500">
        Each run costs roughly the same as making an edition by hand (a few US cents). If fewer than 3 good articles turn up, HANA emails you a
        short note instead of a thin edition.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving} disabled={!s.topic.trim() || !form.recipient.trim()}>
          {form.id ? "Save changes" : "Create schedule"}
        </Button>
      </div>
    </Card>
  );
}

function IconBtn({
  label,
  onClick,
  icon,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx("rounded p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40", danger ? "hover:text-red-600" : "hover:text-gray-900")}
    >
      {icon}
    </button>
  );
}
