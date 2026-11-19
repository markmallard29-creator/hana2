import "server-only";

const env = (k: string) => (process.env[k] ?? "").trim();

export const config = {
  tavilyKey: env("TAVILY_API_KEY"),
  anthropicKey: env("ANTHROPIC_API_KEY"),
  model: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
  fastModel: env("ANTHROPIC_FAST_MODEL") || "claude-haiku-5-5",
  resendKey: env("RESEND_API_KEY"),
  emailFrom: env("EMAIL_FROM") || "HANA <newsletter@hana.news>",
  emailReplyTo: env("EMAIL_REPLY_TO"),
  testEmail: env("TEST_EMAIL"),
  appUrl: (env("APP_URL") || "http://localhost:3000").replace(/\/$/, ""),
  senderAddress: env("SENDER_ADDRESS"),
};

/** Demo mode for research/writing: no keys, so use sample data. */
export const demoResearch = !config.tavilyKey || !config.anthropicKey;
/** Demo mode for sending: no Resend key, so log instead of sending. */
export const demoSend = !config.resendKey;
