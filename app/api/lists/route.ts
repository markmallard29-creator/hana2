import { fail, ok, route } from "@/lib/api";
import { createList, getLists } from "@/lib/db";

export const GET = route(async () => ok({ lists: await getLists() }));

export const POST = route(async (req: Request) => {
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return fail("Give the list a name.");
  const id = await createList(name);
  return ok({ id });
});
