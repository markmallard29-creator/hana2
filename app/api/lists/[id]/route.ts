import { fail, ok, route } from "@/lib/api";
import { deleteList, renameList } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return fail("Give the list a name.");
  await renameList((await params).id, name);
  return ok({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  await deleteList((await params).id);
  return ok({ ok: true });
});
