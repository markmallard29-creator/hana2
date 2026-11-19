"use client";

import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NewsletterRow } from "@/lib/db";
import { api, cx } from "./ui";
import { formatUsd } from "@/lib/format";

function when(iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function NewsletterTable({ rows }: { rows: NewsletterRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function reuse(id: string) {
    setBusy(id);
    const r = await api<{ id: string }>(`/api/newsletters/${id}/duplicate`, {});
    router.push(`/new?id=${r.id}`);
  }

  async function remove(n: NewsletterRow) {
    if (!confirm(`Delete "${n.title || n.topic}"?${n.status === "sent" ? " The browser view link will stop working." : ""}`)) return;
    setBusy(n.id);
    await api(`/api/newsletters/${n.id}`, undefined, "DELETE");
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-left text-[15px]">
        <thead className="bg-gray-50 text-sm text-gray-500">
          <tr>
            <th className="px-5 py-3 font-medium">Newsletter</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="hidden px-5 py-3 font-medium md:table-cell">List</th>
            <th className="hidden px-5 py-3 font-medium sm:table-cell">Date</th>
            <th className="hidden px-5 py-3 text-right font-medium lg:table-cell" title="Estimated API cost of researching and writing this edition">
              API cost
            </th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((n) => (
            <tr key={n.id} className={cx("hover:bg-gray-50", busy === n.id && "opacity-50")}>
              <td className="px-5 py-4">
                <div className="font-medium">{n.title || <span className="text-gray-400">Untitled</span>}</div>
                <div className="text-sm text-gray-500">{n.topic}</div>
              </td>
              <td className="px-5 py-4">
                <span
                  className={cx(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    n.status === "sent" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {n.status === "sent" ? `Sent to ${n.recipients ?? 0}` : n.status === "draft" ? "Draft" : "Sending"}
                </span>
              </td>
              <td className="hidden px-5 py-4 text-gray-600 md:table-cell">{n.list_name ?? "-"}</td>
              <td className="hidden px-5 py-4 text-gray-600 sm:table-cell">{when(n.sent_at ?? n.updated_at)}</td>
              <td className="hidden px-5 py-4 text-right tabular-nums text-gray-600 lg:table-cell">
                {n.cost_usd == null ? "-" : formatUsd(n.cost_usd)}
              </td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-1">
                  {n.status === "draft" ? (
                    <IconLink href={`/new?id=${n.id}`} label="Continue editing" icon={<Pencil className="h-4 w-4" />} />
                  ) : (
                    <IconLink href={`/view/${n.id}`} label="View" icon={<ExternalLink className="h-4 w-4" />} external />
                  )}
                  <IconBtn label="New edition with these settings" onClick={() => reuse(n.id)} icon={<Copy className="h-4 w-4" />} />
                  <IconBtn label="Delete" onClick={() => remove(n)} icon={<Trash2 className="h-4 w-4" />} danger />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconLink({ href, label, icon, external }: { href: string; label: string; icon: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      target={external ? "_blank" : undefined}
      className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    >
      {icon}
    </a>
  );
}

function IconBtn({ label, onClick, icon, danger }: { label: string; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx("rounded p-2 text-gray-500 hover:bg-gray-100", danger ? "hover:text-red-600" : "hover:text-gray-900")}
    >
      {icon}
    </button>
  );
}
