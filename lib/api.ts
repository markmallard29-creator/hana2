import "server-only";
import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a route handler so thrown errors become JSON responses instead of HTML 500s. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[api]", msg);
      if (/UNIQUE constraint failed: lists\.name/.test(msg)) return fail("A list with that name already exists.", 409);
      return fail(msg, 500);
    }
  };
}
