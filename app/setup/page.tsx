import { checkDb, onRailway, onRender, onServerless, RENDER_DISK, storageKind } from "@/lib/db";
import { config, llmProvider } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Configuration check. Shows only whether each setting is present, never its value. */
export default async function Setup() {
  const has = (k: string) => !!(process.env[k] ?? "").trim();
  const db = await checkDb();
  const appUrl = config.appUrl;

  const rows: { name: string; ok: boolean; need: string; note?: string }[] = [
    { name: "Database", ok: db.ok, need: "required", note: db.ok ? `Connected · ${storageKind()}` : db.error },
    ...(onServerless
      ? [
          { name: "DATABASE_URL", ok: has("DATABASE_URL"), need: "required" },
          { name: "DATABASE_AUTH_TOKEN", ok: has("DATABASE_AUTH_TOKEN"), need: "required" },
        ]
      : []),
    ...(onRailway
      ? [
          {
            name: "Railway volume",
            ok: has("RAILWAY_VOLUME_MOUNT_PATH") || (has("DATABASE_URL") && !process.env.DATABASE_URL!.startsWith("file:")),
            need: "required",
            note: has("RAILWAY_VOLUME_MOUNT_PATH") ? `Mounted at ${process.env.RAILWAY_VOLUME_MOUNT_PATH}` : "Attach a volume so data survives deploys",
          },
        ]
      : []),
    { name: "TAVILY_API_KEY", ok: has("TAVILY_API_KEY"), need: "for live research", note: has("TAVILY_API_KEY") ? undefined : "Demo articles until set" },
    {
      name: "AI provider (ANTHROPIC_API_KEY or OPENAI_API_KEY)",
      ok: !!llmProvider,
      need: "for live research",
      note: llmProvider === "anthropic" ? `Using Claude (${config.model} / ${config.fastModel})` : llmProvider === "openai" ? `Using OpenAI (${config.openaiModel} / ${config.openaiFastModel})` : "Demo summaries until one is set",
    },
    { name: "RESEND_API_KEY", ok: has("RESEND_API_KEY"), need: "for sending", note: has("RESEND_API_KEY") ? undefined : "Sends are logged, not emailed" },
    { name: "EMAIL_FROM", ok: has("EMAIL_FROM"), need: "for sending", note: "Must be on a domain verified in Resend" },
    {
      name: "APP_URL",
      ok: !/localhost/.test(appUrl),
      need: "for unsubscribe links",
      note: /localhost/.test(appUrl) ? "Set to this site's public address, e.g. https://hana.onrender.com" : `${appUrl}${has("APP_URL") ? "" : " (detected automatically)"}`,
    },
    { name: "APP_PASSWORD", ok: has("APP_PASSWORD"), need: "recommended", note: has("APP_PASSWORD") ? "Login is on" : "Anyone with the link can use the app" },
    { name: "SENDER_ADDRESS", ok: has("SENDER_ADDRESS"), need: "recommended", note: "Postal address in the email footer (PECR / CAN-SPAM)" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Setup check</h1>
      <p className="mt-1 text-gray-500">
        Running {onRender ? `on Render (data disk expected at ${RENDER_DISK})` : onRailway ? "on Railway" : onServerless ? "on a serverless host" : "locally"}. Values are never shown, only whether they&apos;re set.
        After changing environment variables, redeploy.
      </p>
      <div className="mt-8 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-[15px]">
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="w-10 px-4 py-3 text-lg">{r.ok ? "✅" : r.need === "required" ? "❌" : "⚠️"}</td>
                <td className="px-2 py-3">
                  <div className="font-mono text-sm font-medium">{r.name}</div>
                  {r.note && <div className="text-sm text-gray-500">{r.note}</div>}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-500">{r.need}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
