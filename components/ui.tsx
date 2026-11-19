"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-14 px-8 text-lg",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50",
        variant === "secondary" && "bg-slate-100 text-gray-900 hover:bg-slate-200 disabled:opacity-50",
        variant === "outline" && "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50",
        variant === "ghost" && "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx("mb-2 block text-[17px] font-medium text-gray-900", className)}>
      {children}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p },
  ref,
) {
  return (
    <input
      ref={ref}
      {...p}
      className={cx(
        "h-12 w-full rounded-md border border-gray-200 bg-white px-4 text-[17px] text-gray-900 placeholder:text-gray-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        className,
      )}
    />
  );
});

/** Textarea that grows with its content. */
export function Textarea({ className, autoGrow, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!autoGrow || !ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${ref.current.scrollHeight + 2}px`;
  }, [autoGrow, p.value]);
  return (
    <textarea
      ref={ref}
      {...p}
      className={cx(
        "w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-[17px] text-gray-900 placeholder:text-gray-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        autoGrow && "resize-none overflow-hidden",
        className,
      )}
    />
  );
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...p}
        className={cx(
          "h-[52px] w-full appearance-none rounded-md border border-gray-200 bg-white px-4 pr-10 text-[17px] text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          className,
        )}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="none">
        <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Slider({ id, value, min, max, onChange }: { id: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="hana-range w-full"
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      <div className="relative mt-2 h-6 text-[17px]">
        <span className="absolute left-0 text-gray-500">{min}</span>
        <span
          className="absolute -translate-x-1/2 font-medium text-gray-900"
          style={{ left: `calc(${pct}% + ${(50 - pct) * 0.24}px)` }}
        >
          {value}
        </span>
        <span className="absolute right-0 text-gray-500">{max}</span>
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-lg border border-gray-200 bg-white", className)}>{children}</div>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-md px-4 py-3 text-[15px]",
        tone === "info" && "bg-brand-light text-brand-dark",
        tone === "error" && "bg-red-50 text-red-800",
        tone === "warn" && "bg-amber-50 text-amber-900",
        tone === "success" && "bg-green-50 text-green-800",
      )}
    >
      {children}
    </div>
  );
}

/** The newsletter being worked on; sent with API calls so the cost meter can attribute spend. */
let currentEdition: string | null = null;
export function setCurrentEdition(id: string | null) {
  currentEdition = id;
}
function baseHeaders(json: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["content-type"] = "application/json";
  if (currentEdition) h["x-hana-edition"] = currentEdition;
  return h;
}

export async function api<T>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: baseHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/** POST and read a newline-delimited JSON stream: calls onLine for each object, returns the last one. */
export async function apiStream<T>(url: string, body: unknown, onLine: (o: Record<string, unknown>) => void): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: baseHeaders(true), body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let last: Record<string, unknown> | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const o = JSON.parse(line) as Record<string, unknown>;
      if (o.error) throw new Error(String(o.error));
      if (!o.ping) onLine(o);
      last = o;
    }
    if (done) break;
  }
  if (!last || !("articles" in last)) throw new Error("Research stopped before finishing. Please try again.");
  return last as T;
}
