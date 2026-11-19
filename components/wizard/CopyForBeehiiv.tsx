"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { renderFragment } from "@/lib/email";
import type { Draft } from "@/lib/types";
import { Button } from "../ui";

/**
 * Copies the edition as content-only HTML (no masthead, no footer, inline styles)
 * for pasting into a beehiiv HTML snippet block. beehiiv adds its own header,
 * branding and unsubscribe footer.
 */
export function CopyForBeehiiv({ draft, size = "md", withHint = false }: { draft: Draft; size?: "sm" | "md"; withHint?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    const html = renderFragment({
      title: draft.title,
      intro: draft.intro,
      execSummary: draft.execSummary,
      articles: draft.articles,
      themeId: draft.themeId,
      editionLabel: draft.editionLabel,
    });
    try {
      await navigator.clipboard.writeText(html);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("failed");
    }
  }
  return (
    <div>
      <Button variant="outline" size={size} onClick={copy}>
        {state === "copied" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        {state === "copied" ? "Copied for beehiiv" : "Copy for beehiiv"}
      </Button>
      {state === "failed" && <p className="mt-2 text-sm text-red-700">Your browser blocked the copy. Use the Code tab on the preview step instead.</p>}
      {withHint && (
        <p className="mt-2 text-sm text-gray-500">
          In beehiiv, add an <strong>HTML snippet</strong> block to your post and paste. Copies the content only: beehiiv adds your
          publication&apos;s own header and unsubscribe footer. Set the title and subject line in beehiiv.
        </p>
      )}
    </div>
  );
}
