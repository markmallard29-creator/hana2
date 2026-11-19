"use client";

import { cx } from "./ui";

const LABELS = ["Topic", "Articles", "Customise", "Preview", "Send", "Done"];

/** Numbered circles joined by lines; completed steps can be clicked to jump back. */
export function Stepper({ step, maxReached, onJump }: { step: number; maxReached: number; onJump: (s: number) => void }) {
  return (
    <nav aria-label="Progress" className="mx-auto flex w-full max-w-[820px] items-center justify-between px-4">
      {LABELS.map((label, i) => {
        const n = i + 1;
        const active = n <= step;
        const clickable = n <= maxReached && n !== step && step !== 6 && n !== 6;
        return (
          <div key={n} className={cx("flex items-center", n < LABELS.length && "flex-1")}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onJump(n)}
              title={label}
              aria-label={`Step ${n}: ${label}`}
              aria-current={n === step ? "step" : undefined}
              className={cx(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold transition-colors",
                active ? "bg-brand text-white" : "bg-slate-100 text-slate-400",
                clickable && "cursor-pointer hover:ring-4 hover:ring-brand/20",
              )}
            >
              {n}
            </button>
            {n < LABELS.length && (
              <div className={cx("mx-3 h-px flex-1", n < step ? "bg-gray-300" : "bg-transparent")} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
