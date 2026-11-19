"use client";

import { Check, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { renderEmail } from "@/lib/email";
import type { Draft } from "@/lib/types";
import { Button, Card, cx } from "../ui";

const DEVICES = { Desktop: 680, Tablet: 768, Mobile: 375 } as const;
type Device = keyof typeof DEVICES;

export function previewHtml(d: Draft) {
  return renderEmail({
    title: d.title,
    intro: d.intro,
    execSummary: d.execSummary,
    articles: d.articles,
    themeId: d.themeId,
    editionLabel: d.editionLabel,
    listName: "your list",
    unsubscribeUrl: "#",
    webUrl: "#",
  });
}

export function StepPreview({ draft }: { draft: Draft }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<Device>("Desktop");
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => previewHtml(draft), [draft]);
  const [frameH, setFrameH] = useState(900);
  // Grow the frame to the email's height (re-measured after images load and on device change).
  const fit = (f: HTMLIFrameElement) => {
    const doc = f.contentDocument;
    if (!doc) return;
    const measure = () => setFrameH(Math.max(400, doc.documentElement.scrollHeight + 4));
    measure();
    doc.querySelectorAll("img").forEach((img) => img.addEventListener("load", measure, { once: true }));
  };
  useEffect(() => {
    const f = document.querySelector<HTMLIFrameElement>("iframe[title='Email preview']");
    if (f) setTimeout(() => fit(f), 350);
  }, [device]);

  return (
    <div>
      <h2 className="text-[19px] font-medium">Review your newsletter</h2>
      <Segmented
        className="mt-2"
        value={tab}
        options={[
          ["preview", "Preview"],
          ["code", "Code"],
        ]}
        onChange={(v) => setTab(v as "preview" | "code")}
      />

      <Card className="mt-3 p-8">
        {tab === "preview" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-[30px] font-bold tracking-tight">Email Preview</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">View as:</span>
                <Segmented
                  value={device}
                  options={Object.keys(DEVICES).map((k) => [k, k])}
                  onChange={(v) => setDevice(v as Device)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-center overflow-x-auto">
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                style={{ width: DEVICES[device], height: frameH }}
                onLoad={(e) => fit(e.currentTarget)}
                className="max-w-full rounded-md border border-gray-200 bg-gray-100 transition-[width] duration-300"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-[30px] font-bold tracking-tight">HTML</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(html);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${(draft.title || "newsletter").replace(/[^\w-]+/g, "-").toLowerCase()}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
            <pre className="mt-6 max-h-[800px] overflow-auto rounded-md bg-gray-950 p-5 text-xs leading-relaxed text-gray-100">
              {html}
            </pre>
          </>
        )}
      </Card>
    </div>
  );
}

export function Segmented({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: string[][];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-md bg-slate-100 p-1", className)}>
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cx(
            "rounded px-4 py-1.5 text-[15px] font-medium transition-colors",
            value === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
