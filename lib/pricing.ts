import "server-only";

/**
 * List prices used by the cost meter (USD). These are estimates for visibility and
 * margins; the providers' own dashboards are the source of truth for billing.
 *
 * Override or add models with MODEL_PRICES, e.g.
 *   MODEL_PRICES={"gpt-6.2-sol":[1.25,10]}
 * (USD per million input tokens, per million output tokens).
 */
const BUILT_IN: Record<string, [number, number]> = {
  // Anthropic list prices (Nov 2026)
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5], // prompts up to 100k tokens, which HANA stays under
  "claude-opus-5-5": [4, 20],
  // OpenAI: Luna is priced the same as Haiku 5.5. Sol isn't listed here yet; set it via MODEL_PRICES.
  "gpt-6-luna": [0.1, 0.5],
};

function overrides(): Record<string, [number, number]> {
  try {
    const raw = process.env.MODEL_PRICES;
    return raw ? (JSON.parse(raw) as Record<string, [number, number]>) : {};
  } catch {
    return {};
  }
}

/** Cost of one AI call, or null if we don't know this model's price. */
export function tokenCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = overrides()[model] ?? BUILT_IN[model];
  if (!p) return null;
  return (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000;
}

/** Tavily pay-as-you-go is $0.008 per credit; monthly plans are cheaper per credit. */
export const tavilyCreditUsd = () => Number(process.env.TAVILY_CREDIT_USD) || 0.008;

/** Resend is plan-priced; set RESEND_EMAIL_USD if you want a per-email figure in the meter. */
export const resendEmailUsd = () => (process.env.RESEND_EMAIL_USD ? Number(process.env.RESEND_EMAIL_USD) : null);
