import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config, llmProvider } from "./config";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: config.anthropicKey, maxRetries: 4 });
  return client;
}

export const HOUSE_STYLE = `Write in British English. Be specific and concrete: names, numbers, places, dates.
Never invent facts that are not in the source material. Avoid hype and filler words such as
"remarkable", "pivotal", "game-changing", "groundbreaking", "underscoring", "landscape", "delve".`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("No JSON in model response");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Ask Claude for JSON. `shape` is a plain-English/TS description of the expected output.
 * Retries once if the reply doesn't parse.
 */
export async function askJson<T>(opts: {
  system: string;
  prompt: string;
  shape: string;
  fast?: boolean;
  maxTokens?: number;
}): Promise<T> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `${opts.prompt}\n\nRespond with JSON only, no commentary, matching exactly:\n${opts.shape}`,
    },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const system = `${opts.system}\n\n${HOUSE_STYLE}`;
    const text = await withFallback(system, messages, opts.fast, opts.maxTokens ?? 2000);
    try {
      return extractJson(text) as T;
    } catch (e) {
      if (attempt === 1) throw e;
      messages.push({ role: "assistant", content: text || "(empty)" });
      messages.push({ role: "user", content: "That was not valid JSON. Reply again with only the JSON." });
    }
  }
  throw new Error("unreachable");
}

/** Overloaded / rate-limited / flaky upstream: worth retrying. */
export class TransientAIError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call the chosen provider. If it's overloaded even after retries and the other
 * provider has a key, use that instead, so one outage doesn't stop an edition.
 */
async function withFallback(system: string, messages: Anthropic.MessageParam[], fast: boolean | undefined, maxTokens: number) {
  const primary = llmProvider;
  const other = primary === "openai" ? (config.anthropicKey ? "anthropic" : null) : config.openaiKey ? "openai" : null;
  const call = (p: "openai" | "anthropic") =>
    // With a backup provider, give up on OpenAI sooner (~4s) and switch.
    p === "openai" ? openaiText(system, messages, fast, maxTokens, other ? 3 : 5) : anthropicText(system, messages, fast, maxTokens);
  try {
    return await call(primary === "openai" ? "openai" : "anthropic");
  } catch (e) {
    const transient =
      e instanceof TransientAIError ||
      (e instanceof Anthropic.APIError && (e.status === 429 || e.status === 529 || (e.status ?? 0) >= 500)) ||
      e instanceof Anthropic.APIConnectionError;
    if (!transient || !other) throw e;
    console.warn(`[llm] ${primary} unavailable (${(e as Error).message}); falling back to ${other}`);
    return call(other);
  }
}

async function anthropicText(system: string, messages: Anthropic.MessageParam[], fast: boolean | undefined, maxTokens: number) {
  const res = await anthropic().messages.create({
    model: fast ? config.fastModel : config.model,
    max_tokens: maxTokens,
    system,
    messages,
  });
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

/** OpenAI via the Responses API (plain fetch, no extra dependency). */
async function openaiText(
  system: string,
  messages: Anthropic.MessageParam[],
  fast: boolean | undefined,
  maxTokens: number,
  attempts = 5,
) {
  const body = JSON.stringify({
    model: fast ? config.openaiFastModel : config.openaiModel,
    instructions: system,
    input: messages.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })),
    // reasoning models spend part of this budget thinking, so leave headroom
    max_output_tokens: maxTokens * 3 + 2000,
  });
  // Retry overloads, rate limits and network blips: about 1s, 3s, 7s, 15s, with a little jitter.
  let res: Response | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await sleep((2 ** attempt - 1) * 1000 + Math.random() * 500);
    try {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.openaiKey}` },
        body,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      lastErr = (e as Error).message;
      res = null;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = `${res.status}: ${((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? "unavailable"}`;
      // a 429 for running out of credit won't fix itself; stop retrying
      if (res.status === 429 && /quota|billing|credit/i.test(lastErr)) throw new Error(`OpenAI ${lastErr}`);
      continue;
    }
    break;
  }
  if (!res || res.status === 429 || res.status >= 500) {
    throw new TransientAIError(`OpenAI is busy right now (${lastErr || "no response"}). Please try again in a minute.`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message ?? "request failed"}`);
  if (typeof data.output_text === "string") return data.output_text.trim();
  return (data.output ?? [])
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text" && c.text)
    .map((c) => c.text)
    .join("")
    .trim();
}

/** Strip wrapping quotes and trailing site names the model or the page title might add. */
export function cleanTitle(s: string) {
  return s
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
