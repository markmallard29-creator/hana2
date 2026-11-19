"use client";

/** Shown instead of Next's blank "Application error" screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-gray-600">
        This is usually a missing setting. The <a href="/setup" className="text-brand underline">setup check</a> shows
        which environment variables are set and whether the database connects.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-gray-400">Error reference: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-md bg-brand px-4 py-2 font-medium text-white">
          Try again
        </button>
        <a href="/setup" className="rounded-md border border-gray-200 px-4 py-2 font-medium">
          Open setup check
        </a>
      </div>
    </main>
  );
}
