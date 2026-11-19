"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, GripVertical, ImageOff, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Article } from "@/lib/types";
import { Button, Card, Input, Textarea, cx } from "../ui";

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function StepArticles({
  articles,
  phase,
  setArticles,
  patchArticle,
  retry,
  addArticles,
  rerun,
}: {
  articles: Article[];
  phase: string | null;
  setArticles: (fn: (a: Article[]) => Article[]) => void;
  patchArticle: (id: string, p: Partial<Article>) => void;
  retry: (id: string) => void;
  addArticles: (o: { url?: string; more?: number }) => Promise<void>;
  rerun: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [adding, setAdding] = useState(false);

  const total = articles.length;
  const done = articles.filter((a) => a.status === "ready" || a.status === "error").length;
  const summarising = !phase && done < total;

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setArticles((as) => {
      const from = as.findIndex((a) => a.id === e.active.id);
      const to = as.findIndex((a) => a.id === e.over!.id);
      return arrayMove(as, from, to);
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[19px] font-medium">Organise and edit articles</h2>
        {total > 0 && !phase && (
          <button onClick={rerun} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
            <RefreshCw className="h-3.5 w-3.5" /> Search again
          </button>
        )}
      </div>
      <p className="mt-4 h-6 text-center text-[17px] text-slate-500" aria-live="polite">
        {phase ?? (summarising ? `Summarising article ${Math.min(done + 1, total)} of ${total}…` : total ? `${total} articles. Drag to reorder.` : "")}
      </p>

      {phase && !total && (
        <div className="mt-6 space-y-6">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex animate-pulse gap-6 p-8">
              <div className="h-[200px] w-[300px] rounded-md bg-slate-100" />
              <div className="flex-1 space-y-3 py-2">
                <div className="h-5 w-3/4 rounded bg-slate-100" />
                <div className="h-4 w-1/3 rounded bg-slate-100" />
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={articles.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-6 space-y-10">
            {articles.map((a) => (
              <ArticleCard
                key={a.id}
                a={a}
                onChange={(p) => patchArticle(a.id, p)}
                onDelete={() => setArticles((as) => as.filter((x) => x.id !== a.id))}
                onRetry={() => retry(a.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {total > 0 && (
        <div className="mt-10 flex justify-center">
          {adding ? (
            <AddPanel onClose={() => setAdding(false)} addArticles={addArticles} />
          ) : (
            <Button variant="outline" size="lg" onClick={() => setAdding(true)} disabled={!!phase}>
              <Plus className="h-5 w-5" /> Add More Articles
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ArticleCard({
  a,
  onChange,
  onDelete,
  onRetry,
}: {
  a: Article;
  onChange: (p: Partial<Article>) => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
  const [editImage, setEditImage] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const date = fmtDate(a.publishedAt);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("relative", isDragging && "z-10")}
    >
      <Card className={cx("px-8 pb-10 pt-12", isDragging && "shadow-xl ring-2 ring-brand/30")}>
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="absolute left-3 top-3 cursor-grab touch-none select-none rounded p-1.5 text-gray-500 hover:bg-gray-100 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Remove article"
          className="absolute right-3 top-3 rounded p-1.5 text-gray-700 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-5 w-5" />
        </button>

        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full shrink-0 md:w-[340px]">
            {a.image && !imgBroken ? (
              <div className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.image}
                  alt=""
                  onError={() => setImgBroken(true)}
                  className="aspect-[3/2] w-full rounded-md object-cover"
                />
                <div className="absolute inset-x-2 bottom-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button onClick={() => setEditImage(true)} className="rounded bg-white/90 px-2 py-1 text-xs font-medium shadow">
                    Change image
                  </button>
                  <button onClick={() => onChange({ image: null })} className="rounded bg-white/90 px-2 py-1 text-xs font-medium shadow">
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditImage(true)}
                className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-50"
              >
                <ImageOff className="h-6 w-6" />
                {imgBroken ? "Image wouldn't load. Add another" : "No image. Add one"}
              </button>
            )}
            {editImage && (
              <ImageUrlEditor
                initial={a.image ?? ""}
                onSave={(url) => {
                  setImgBroken(false);
                  onChange({ image: url || null });
                  setEditImage(false);
                }}
                onCancel={() => setEditImage(false)}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <textarea
              value={a.title}
              rows={2}
              onChange={(e) => onChange({ title: e.target.value })}
              aria-label="Headline"
              className="-mx-1 w-full resize-none rounded px-1 text-[19px] leading-snug text-gray-900 hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-1 text-[17px] text-slate-500">
              {/* auto-width input: a hidden span sizes the grid cell to the text */}
              <span className="inline-grid align-baseline">
                <span className="invisible col-start-1 row-start-1 whitespace-pre px-0.5">{a.source || " "}</span>
                <input
                  size={1}
                  value={a.source}
                  onChange={(e) => onChange({ source: e.target.value })}
                  aria-label="Publication name"
                  className="col-start-1 row-start-1 w-full min-w-0 rounded px-0.5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </span>
              {date && <span> · {date}</span>}
              {a.wordCount >= 1200 && (
                <span className="ml-2 rounded bg-brand-light px-1.5 py-0.5 align-middle text-xs font-medium text-brand-dark">Long read</span>
              )}
              {a.custom && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 align-middle text-xs font-medium text-slate-600">Your link</span>}
            </p>

            <div className="mt-5">
              {a.status === "ready" ? (
                <Textarea
                  autoGrow
                  value={a.summary}
                  onChange={(e) => onChange({ summary: e.target.value })}
                  aria-label="Summary"
                  className="-mx-3 w-[calc(100%+1.5rem)] border-transparent px-3 text-[17px] leading-relaxed text-gray-700 hover:border-gray-200"
                />
              ) : a.status === "error" ? (
                <div className="flex items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-red-800">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span className="flex-1">Couldn&apos;t summarise this article.</span>
                  <Button size="sm" variant="outline" onClick={onRetry}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 px-3 py-2" aria-label="Summarising">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> {a.status === "summarising" ? "Summarising…" : "Queued"}
                  </div>
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                </div>
              )}
            </div>

            <a href={a.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[17px] text-brand hover:underline">
              Read more at {a.source} ({a.readMins} min{a.readMins === 1 ? "" : "s"})
            </a>
            {a.whyPicked && <p className="mt-2 text-xs text-gray-400">Picked for: {a.whyPicked}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ImageUrlEditor({ initial, onSave, onCancel }: { initial: string; onSave: (u: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial.startsWith("data:") ? "" : initial);
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v.trim());
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://…/image.jpg" className="h-9 text-sm" autoFocus />
      <Button size="sm" type="submit">
        Save
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={onCancel} aria-label="Cancel">
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

function AddPanel({ onClose, addArticles }: { onClose: () => void; addArticles: (o: { url?: string; more?: number }) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"url" | "more" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(kind: "url" | "more") {
    setBusy(kind);
    setErr(null);
    try {
      await addArticles(kind === "url" ? { url: url.trim() } : { more: 3 });
      setUrl("");
      if (kind === "more") onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="w-full max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">Add more articles</h3>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void run("url");
        }}
      >
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an article URL" />
        <Button type="submit" loading={busy === "url"} disabled={!url.trim() || !!busy}>
          Add
        </Button>
      </form>
      <div className="my-4 text-center text-sm text-gray-400">or</div>
      <Button variant="outline" className="w-full" onClick={() => run("more")} loading={busy === "more"} disabled={!!busy}>
        <Search className="h-4 w-4" /> Find 3 more on this topic
      </Button>
      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
    </Card>
  );
}
