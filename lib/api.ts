import "server-only";
import { NextResponse } from "next/server";
import { withEdition } from "./usage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a route handler so thrown errors become JSON responses instead of HTML 500s. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const req = args[0] instanceof Request ? args[0] : null;
    const edition = req?.headers.get("x-hana-edition") ?? null;
    try {
      return await withEdition(edition && UUID.test(edition) ? edition : null, () => fn(...args));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[api]", msg);
      if (/UNIQUE constraint failed: lists\.name/.test(msg)) return fail("A list with that name already exists.", 409);
      return fail(msg, 500);
    }
  };
}
