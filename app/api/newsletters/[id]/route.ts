import { fail, ok, route } from "@/lib/api";
import { deleteNewsletter, getNewsletter } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const n = await getNewsletter((await params).id);
  return n ? ok(n) : fail("Not found", 404);
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  await deleteNewsletter((await params).id);
  return ok({ ok: true });
});
