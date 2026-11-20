export {};
// Simulates OpenAI overloads: recovers after retries, falls back to Claude, or fails cleanly.
const MODE = process.env.SIM_MODE || "recover"; // recover | fallback | down
process.env.OPENAI_API_KEY = "sk-openai-test";
if (MODE === "fallback") process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.LLM_PROVIDER = "openai";
let openaiCalls = 0, anthropicCalls = 0;
const reply = (text: string) => ({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
globalThis.fetch = (async (input: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("api.openai.com")) {
    openaiCalls++;
    if (MODE !== "recover" || openaiCalls <= 2)
      return Response.json({ error: { message: "Our servers are currently overloaded. Please try again later." } }, { status: 503 });
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: '{"topic":"from openai"}' }] }] });
  }
  if (url.includes("api.anthropic.com")) { anthropicCalls++; return Response.json(reply('{"topic":"from claude"}')); }
  return new Response("nope", { status: 404 });
}) as any;
(async () => {
  const { refineTopic } = await import("../lib/research");
  const t0 = Date.now();
  try {
    const r = await refineTopic("Bristol", "locals");
    console.log(`${MODE}: OK "${r}" | openai calls ${openaiCalls}, claude calls ${anthropicCalls}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(`${MODE}: ERROR "${(e as Error).message}" | openai calls ${openaiCalls}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
})();
