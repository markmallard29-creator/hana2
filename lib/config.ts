import "server-only";

const env = (k: string) => (process.env[k] ?? "").trim();

export const config = {
  tavilyKey: env("TAVILY_API_KEY"),
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

/** Demo mode for research/writing: no search key or no AI key, so use sample data. */
export const demoResearch = !config.tavilyKey || !llmProvider;
/** Demo mode for sending: no Resend key, so log instead of sending. */
export const demoSend = !config.resendKey;
