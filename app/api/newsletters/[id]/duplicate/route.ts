import { fail, ok, route } from "@/lib/api";
import { duplicateNewsletter } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Start a new draft from an existing newsletter (e.g. reuse last week's settings). */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const id = await duplicateNewsletter((await params).id);
  return id ? ok({ id }) : fail("Not found", 404);
});
