"use client";

import { ArrowRight, ExternalLink, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Draft } from "@/lib/types";
import { Button, Card, Input, Label, Notice, Select, api } from "../ui";
import { Footer } from "./Footer";
import { describeAdd, type AddResult } from "../ListsManager";

interface List {
  id: string;
  name: string;
  active: number;
  total: number;
}

export function StepSend({
  draft,
  update,
  defaultTestEmail,
  onSent,
  onError,
  onBack,
}: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  defaultTestEmail: string;
  onSent: (count: number, id: string) => void;
  onError: (e: string | null) => void;
  onBack: () => void;
}) {
  const [lists, setLists] = useState<List[] | null>(null);
  const [testTo, setTestTo] = useState(defaultTestEmail);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">("idle");
  const [adding, setAdding] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [newList, setNewList] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [subjBusy, setSubjBusy] = useState(false);

  const load = useCallback(async () => {
    const { lists } = await api<{ lists: List[] }>("/api/lists");
    setLists(lists);
    return lists;
  }, []);

  useEffect(() => {
    load()
      .then((ls) => {
        if (!draft.listId && ls[0]) update({ listId: ls[0].id });
      })
      .catch((e) => onError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = lists?.find((l) => l.id === draft.listId) ?? null;

  async function rewriteSubject() {
    setSubjBusy(true);
    try {
      const r = await api<{ subject: string }>("/api/compose", {
        articles: draft.articles.map((a) => ({ title: a.title, summary: a.summary, source: a.source })),
        settings: draft.settings,
        parts: ["subject"],
      });
      if (r.subject) update({ subject: r.subject });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSubjBusy(false);
    }
  }

  async function sendTest() {
    setTestState("sending");
    onError(null);
    try {
      const r = await api<{ id: string }>("/api/send", { draft, testEmail: testTo });
      update({ id: r.id });
      setTestState("sent");
    } catch (e) {
      onError((e as Error).message);
      setTestState("idle");
    }
  }

  async function addRecipient() {
    if (!list) return;
    setAddMsg(null);
    try {
      const r = await api<AddResult>(`/api/lists/${list.id}/subscribers`, { raw: recipient });
      setAddMsg(describeAdd(r));
      setRecipient("");
      await load();
    } catch (e) {
      setAddMsg((e as Error).message);
    }
  }

  async function createList() {
    if (!newList?.trim()) return;
    try {
      const { id } = await api<{ id: string }>("/api/lists", { name: newList });
      await load();
      update({ listId: id });
      setNewList(null);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function sendAll() {
    if (!list) return;
    setSending(true);
    onError(null);
    try {
      const r = await api<{ id: string; sent: number }>("/api/send", { draft, listId: list.id, confirm: list.active });
      onSent(r.sent, r.id);
    } catch (e) {
      onError((e as Error).message);
      setConfirming(false);
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-none">
      <h2 className="text-[19px] font-medium">Send your newsletter</h2>

      <div className="mt-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="subject" className="text-[17px] font-semibold">
            Subject
          </Label>
          <Button size="sm" variant="ghost" onClick={rewriteSubject} loading={subjBusy}>
            {!subjBusy && <RefreshCw className="h-3.5 w-3.5" />} Rewrite
          </Button>
        </div>
        <Input id="subject" value={draft.subject} onChange={(e) => update({ subject: e.target.value })} />
        <p className="mt-1 text-right text-xs text-gray-400">{draft.subject.length} characters (keep it under 70)</p>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <Label htmlFor="list" className="text-[17px] font-semibold">
            Email List
          </Label>
          <a href="/lists" target="_blank" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            Manage lists <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {lists === null ? (
          <div className="h-[52px] animate-pulse rounded-md bg-slate-100" />
        ) : lists.length === 0 ? (
          <Notice tone="info">You don&apos;t have any email lists yet. Create one below.</Notice>
        ) : (
          <Select id="list" value={draft.listId ?? ""} onChange={(e) => update({ listId: e.target.value })}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.active} subscriber{l.active === 1 ? "" : "s"})
              </option>
            ))}
          </Select>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          {list && (
            <Button variant="outline" onClick={() => setAdding((v) => !v)}>
              <UserPlus className="h-4 w-4" /> Add new recipient
            </Button>
          )}
          <Button variant="ghost" onClick={() => setNewList(newList === null ? "" : null)}>
            + New list
          </Button>
        </div>

        {adding && list && (
          <Card className="mt-3 p-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addRecipient();
              }}
            >
              <Input
                autoFocus
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={`Email address to add to ${list.name}`}
              />
              <Button type="submit" disabled={!recipient.trim()}>
                Add
              </Button>
            </form>
            {addMsg && <p className="mt-2 text-sm text-gray-600">{addMsg}</p>}
          </Card>
        )}

        {newList !== null && (
          <Card className="mt-3 p-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void createList();
              }}
            >
              <Input autoFocus value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="List name" />
              <Button type="submit" disabled={!newList.trim()}>
                Create
              </Button>
            </form>
          </Card>
        )}
      </div>

      <Card className="mt-10 p-6">
        <h3 className="font-semibold">Send a test first</h3>
        <p className="mt-1 text-sm text-gray-500">
          A copy marked [TEST] goes to this address. Nothing goes to your list.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendTest();
          }}
        >
          <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
          <Button type="submit" variant="outline" loading={testState === "sending"} disabled={!testTo.trim()}>
            <Send className="h-4 w-4" /> Send test
          </Button>
        </form>
        {testState === "sent" && <p className="mt-2 text-sm text-green-700">Test sent to {testTo}. Check your inbox.</p>}
      </Card>

      <Footer
        onBack={onBack}
        right={
          <Button size="lg" disabled={!list || !list.active || !draft.subject.trim()} onClick={() => setConfirming(true)}>
            Send newsletter <ArrowRight className="h-5 w-5" />
          </Button>
        }
      />

      {confirming && list && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <Card className="w-full max-w-md p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 id="confirm-title" className="text-lg font-semibold">
                Send to {list.active} {list.active === 1 ? "person" : "people"}?
              </h3>
              <button onClick={() => setConfirming(false)} aria-label="Cancel" className="rounded p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-gray-600">
              <strong>{draft.subject}</strong> will go to everyone on <strong>{list.name}</strong>. This can&apos;t be undone.
            </p>
            {testState !== "sent" && (
              <div className="mt-4">
                <Notice tone="warn">You haven&apos;t sent yourself a test of this version.</Notice>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button onClick={sendAll} loading={sending}>
                Send now
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
