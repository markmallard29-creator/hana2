import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

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
    const res = await anthropic().messages.create({
      model: opts.fast ? config.fastModel : config.model,
      max_tokens: opts.maxTokens ?? 2000,
      system: `${opts.system}\n\n${HOUSE_STYLE}`,
      messages,
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
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

/** Strip wrapping quotes and trailing site names the model or the page title might add. */
export function cleanTitle(s: string) {
  return s
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
