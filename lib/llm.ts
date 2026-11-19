import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config, llmProvider } from "./config";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: config.anthropicKey });
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
    const text =
      llmProvider === "openai"
        ? await openaiText(system, messages, opts.fast, opts.maxTokens ?? 2000)
        : await anthropicText(system, messages, opts.fast, opts.maxTokens ?? 2000);
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
async function openaiText(system: string, messages: Anthropic.MessageParam[], fast: boolean | undefined, maxTokens: number) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.openaiKey}` },
    body: JSON.stringify({
      model: fast ? config.openaiFastModel : config.openaiModel,
      instructions: system,
      input: messages.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })),
      // reasoning models spend part of this budget thinking, so leave headroom
      max_output_tokens: maxTokens * 3 + 2000,
    }),
    signal: AbortSignal.timeout(120_000),
  });
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
