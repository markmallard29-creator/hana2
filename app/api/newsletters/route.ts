import { ok, route } from "@/lib/api";
import { listNewsletters, saveDraft } from "@/lib/db";
import type { Draft } from "@/lib/types";

export const GET = route(async () => ok({ newsletters: await listNewsletters() }));

export const POST = route(async (req: Request) => {
  const draft = (await req.json()) as Draft;
  return ok({ id: await saveDraft(draft) });
});
