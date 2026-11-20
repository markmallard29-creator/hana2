"use client";

import { ChevronDown, Gauge } from "lucide-react";
import { useEffect, useState } from "react";
import type { UsageReport } from "@/lib/db";
import { api, cx } from "../ui";
import { formatUsd } from "@/lib/format";


const LABELS: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", tavily: "Tavily", exa: "Exa", resend: "Resend" };

/** "API cost so far" for this newsletter, with a breakdown on click. */
export function CostMeter({ editionId, refreshKey }: { editionId: string; refreshKey: string }) {
  const [r, setR] = useState<UsageReport | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // small delay so spend recorded at the end of a request is included
    const t = setTimeout(() => {
      api<UsageReport>(`/api/usage?edition=${editionId}`).then(setR, () => {});
    }, 400);
    return () => clearTimeout(t);
  }, [editionId, refreshKey]);

  if (!r || r.calls === 0) return null;
  // Resend is plan-priced, so it's not "unknown" in a worrying way.
  const unknown = r.lines.filter((l) => l.provider !== "resend").reduce((a, l) => a + l.unpriced, 0);

  return (
    <div>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Gauge className="h-4 w-4" />
          API cost so far: <strong className="font-semibold text-gray-900">{formatUsd(r.totalUsd)}</strong>
          {unknown > 0 && <span className="text-amber-700">+ {unknown} unpriced</span>}
          <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute right-0 z-30 mt-2 w-[380px] rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-lg">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {r.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-2">
                      <div className="font-medium">
                        {LABELS[l.provider] ?? l.provider} · {l.kind}
                      </div>
                      <div className="text-xs text-gray-500">
                        {l.calls} call{l.calls === 1 ? "" : "s"} · {Math.round(l.units).toLocaleString("en-GB")} {l.unitLabel}
                        {l.model ? ` · ${l.model}` : ""}
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {l.unpriced === l.calls ? <span className="text-gray-400">{l.provider === "resend" ? "plan" : "unpriced"}</span> : formatUsd(l.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">
              Estimates from list prices, in US dollars (what the providers bill in). Your provider dashboards are the source of truth.
              {unknown > 0 && " Unpriced calls use a model with no price set; add it with MODEL_PRICES in Render."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
