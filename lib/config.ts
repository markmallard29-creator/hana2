import "server-only";
import type { SearchEngine, SearchOptions } from "./types";

const env = (k: string) => (process.env[k] ?? "").trim();

export const config = {
  tavilyKey: env("TAVILY_API_KEY"),
  exaKey: env("EXA_API_KEY"),
  /** "tavily" | "exa". Default: Tavily if its key is set, otherwise Exa. */
  searchProvider: env("SEARCH_PROVIDER").toLowerCase(),
  anthropicKey: env("ANTHROPIC_API_KEY"),
  openaiKey: env("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL") || "gpt-6.2-sol",
  openaiFastModel: env("OPENAI_FAST_MODEL") || "gpt-6-luna",
  /** "anthropic" | "openai". Default: Anthropic if its key is set, otherwise OpenAI. */
  llmProvider: env("LLM_PROVIDER").toLowerCase(),
  model: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
  fastModel: env("ANTHROPIC_FAST_MODEL") || "claude-haiku-5-5",
  resendKey: env("RESEND_API_KEY"),
  emailFrom: env("EMAIL_FROM") || "HANA <newsletter@hana.news>",
  emailReplyTo: env("EMAIL_REPLY_TO"),
  testEmail: env("TEST_EMAIL"),
  // Public address for unsubscribe/view links. Falls back to the host's own address.
  appUrl: (
    env("APP_URL") ||
    env("RENDER_EXTERNAL_URL") ||
    (env("RAILWAY_PUBLIC_DOMAIN") ? `https://${env("RAILWAY_PUBLIC_DOMAIN")}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  senderAddress: env("SENDER_ADDRESS"),
};

export const llmProvider: "anthropic" | "openai" | null =
  config.llmProvider === "openai" && config.openaiKey
    ? "openai"
    : config.llmProvider === "anthropic" && config.anthropicKey
      ? "anthropic"
      : config.anthropicKey
        ? "anthropic"
        : config.openaiKey
          ? "openai"
          : null;

export const searchProviderName: "tavily" | "exa" | null =
  config.searchProvider === "exa" && config.exaKey
    ? "exa"
    : config.searchProvider === "tavily" && config.tavilyKey
      ? "tavily"
      : config.tavilyKey
        ? "tavily"
        : config.exaKey
          ? "exa"
          : null;

/** Use the engine this newsletter asked for if its key is set, else the server default. */
export function resolveSearch(want?: string | null): SearchEngine | null {
  if (want === "exa" && config.exaKey) return "exa";
  if (want === "tavily" && config.tavilyKey) return "tavily";
  return searchProviderName;
}

/** Demo mode for research/writing: no search key or no AI key, so use sample data. */
export const demoResearch = !searchProviderName || !llmProvider;
/** Demo mode for sending: no Resend key, so log instead of sending. */
export const demoSend = !config.resendKey;

export function searchOptions(): SearchOptions {
  if (demoResearch) return { available: { tavily: true, exa: true }, default: searchProviderName ?? "tavily", demo: true };
  return {
    available: { tavily: !!config.tavilyKey, exa: !!config.exaKey },
    default: searchProviderName ?? "tavily",
    demo: false,
  };
}
