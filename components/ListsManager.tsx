"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Notice, Textarea, api, cx } from "./ui";

interface List {
  id: string;
  name: string;
  active: number;
  total: number;
}
interface Sub {
  id: string;
  email: string;
  name: string | null;
  unsubscribed_at: string | null;
}

export interface AddResult {
  added: number;
  existing: number;
  optedOut: string[];
  invalid: string[];
}

export function describeAdd(r: AddResult) {
  const bits = [`Added ${r.added}.`];
  if (r.existing) bits.push(`${r.existing} already on the list.`);
  if (r.optedOut.length) bits.push(`Skipped ${r.optedOut.length} who unsubscribed (${r.optedOut.slice(0, 3).join(", ")}); they'll need to re-subscribe themselves.`);
  if (r.invalid.length) bits.push(`Not valid: ${r.invalid.slice(0, 5).join(", ")}.`);
  return bits.join(" ");
}

export function ListsManager() {
  const [lists, setLists] = useState<List[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [newName, setNewName] = useState("");
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warn"; text: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const { lists } = await api<{ lists: List[] }>("/api/lists");
    setLists(lists);
    return lists;
  }, []);

  const loadSubs = useCallback(async (id: string) => {
    setSubs(null);
    const { subscribers } = await api<{ subscribers: Sub[] }>(`/api/lists/${id}/subscribers`);
    setSubs(subscribers);
  }, []);

  useEffect(() => {
    load().then((ls) => ls[0] && setSel(ls[0].id));
  }, [load]);
  useEffect(() => {
    if (sel) void loadSubs(sel);
  }, [sel, loadSubs]);

  const current = lists?.find((l) => l.id === sel);
  const shown = subs?.filter((s) => !filter || s.email.includes(filter.toLowerCase()) || (s.name ?? "").toLowerCase().includes(filter.toLowerCase()));

  async function run<T>(fn: () => Promise<T>, ok?: (r: T) => string) {
    setMsg(null);
    try {
      const r = await fn();
      if (ok) setMsg({ tone: "success", text: ok(r) });
      return r;
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-[300px_1fr]">
      <div>
        <Card className="divide-y divide-gray-100">
          {lists === null && <div className="p-4 text-sm text-gray-400">Loading…</div>}
          {lists?.length === 0 && <div className="p-4 text-sm text-gray-500">No lists yet.</div>}
          {lists?.map((l) => (
            <div key={l.id} className={cx("group flex items-center", sel === l.id && "bg-brand-light")}>
              {renaming === l.id ? (
                <form
                  className="flex flex-1 gap-1 p-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = (new FormData(e.currentTarget).get("name") as string) ?? "";
                    await run(() => api(`/api/lists/${l.id}`, { name }, "PATCH"));
                    setRenaming(null);
                    await load();
                  }}
                >
                  <Input name="name" defaultValue={l.name} autoFocus className="h-9 text-sm" />
                  <Button size="sm" type="submit">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <button onClick={() => setSel(l.id)} className="flex-1 px-4 py-3 text-left">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-sm text-gray-500">
                      {l.active} active{l.total > l.active ? ` · ${l.total - l.active} unsubscribed` : ""}
                    </div>
                  </button>
                  <button
                    onClick={() => setRenaming(l.id)}
                    aria-label={`Rename ${l.name}`}
                    className="p-2 text-gray-400 opacity-0 hover:text-gray-900 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </Card>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => api<{ id: string }>("/api/lists", { name: newName }));
            if (r) {
              setNewName("");
              await load();
              setSel(r.id);
            }
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list name" className="h-10 text-[15px]" />
          <Button type="submit" size="sm" className="h-10" disabled={!newName.trim()}>
            Create
          </Button>
        </form>
      </div>

      <div className="space-y-6">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {current && (
          <>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{current.name}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={async () => {
                    if (!confirm(`Delete "${current.name}" and its ${current.total} subscribers? This can't be undone.`)) return;
                    await run(() => api(`/api/lists/${current.id}`, undefined, "DELETE"), () => "List deleted.");
                    const ls = await load();
                    setSel(ls[0]?.id ?? null);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete list
                </Button>
              </div>
              <p className="mt-4 text-sm font-medium">Add subscribers</p>
              <p className="text-sm text-gray-500">
                One per line. <code>Name &lt;email&gt;</code> or a pasted CSV (<code>email,name</code>) both work. Duplicates are skipped.
              </p>
              <Textarea rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} className="mt-2 font-mono text-sm" placeholder={"jane@example.com\nJohn Smith <john@example.com>"} />
              <div className="mt-2 flex justify-end">
                <Button
                  disabled={!raw.trim()}
                  onClick={async () => {
                    const r = await run(
                      () => api<AddResult>(`/api/lists/${current.id}/subscribers`, { raw }),
                      describeAdd,
                    );
                    if (r) {
                      setRaw("");
                      await Promise.all([load(), loadSubs(current.id)]);
                    }
                  }}
                >
                  Add to {current.name}
                </Button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-4">
                <span className="text-sm text-gray-500">{subs ? `${subs.length} subscribers` : "Loading…"}</span>
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search" className="h-9 max-w-xs text-sm" />
              </div>
              <ul className="max-h-[520px] divide-y divide-gray-100 overflow-auto">
                {shown?.map((s) => (
                  <li key={s.id} className="group flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className={cx(s.unsubscribed_at && "text-gray-400 line-through")}>{s.email}</span>
                      {s.name && <span className="ml-2 text-sm text-gray-500">{s.name}</span>}
                      {s.unsubscribed_at && <span className="ml-2 text-xs text-gray-400">unsubscribed</span>}
                    </div>
                    <button
                      aria-label={`Remove ${s.email}`}
                      onClick={async () => {
                        await run(() => api(`/api/lists/${current.id}/subscribers?sid=${s.id}`, undefined, "DELETE"));
                        await Promise.all([load(), loadSubs(current.id)]);
                      }}
                      className="rounded p-1 text-gray-400 opacity-0 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
