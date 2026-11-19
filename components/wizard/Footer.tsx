"use client";

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui";

export interface NextBtn {
  label: string;
  disabled?: boolean;
  reason?: string;
}

/** Sticky bottom bar: Back on the left, the next action on the right. */
export function Footer({ onBack, next, onNext, right }: { onBack?: () => void; next?: NextBtn | null; onNext?: () => void; right?: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1250px] items-center justify-between gap-4 px-6 py-4">
        <div>
          {onBack && (
            <Button variant="secondary" size="lg" onClick={onBack}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {next?.disabled && next.reason && <span className="hidden text-sm text-gray-500 sm:inline">{next.reason}</span>}
          {next && (
            <Button size="lg" disabled={next.disabled} onClick={onNext}>
              {next.label} <ArrowRight className="h-5 w-5" />
            </Button>
          )}
          {right}
        </div>
      </div>
    </div>
  );
}
