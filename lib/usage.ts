import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { insertUsage } from "./db";

/**
 * Cost meter. Every paid call (search, AI, email) records an event, tagged with the
 * newsletter it was made for. The browser sends that id in an `x-hana-edition` header;
 * route() puts it in this request-scoped store so deep library code can read it.
 */
const store = new AsyncLocalStorage<{ editionId: string | null }>();

export function withEdition<T>(editionId: string | null, fn: () => T): T {
  return store.run({ editionId }, fn);
}

export interface UsageEvent {
  provider: "tavily" | "exa" | "anthropic" | "openai" | "resend";
  /** What it was for: plan, rank, summary, compose, topic, search, extract, email… */
  kind: string;
  model?: string;
  units: number;
  unitLabel: "tokens" | "credits" | "requests" | "emails";
  costUsd: number | null;
}

/** Best-effort: a failed write must never break the edition. */
export async function recordUsage(e: UsageEvent) {
  try {
    await insertUsage({ ...e, editionId: store.getStore()?.editionId ?? null });
  } catch (err) {
    console.warn("[usage] not recorded:", (err as Error).message);
  }
}
