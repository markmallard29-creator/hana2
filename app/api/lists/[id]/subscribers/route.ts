import { fail, ok, route } from "@/lib/api";
import { addSubscribers, getSubscribers, removeSubscriber } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) =>
  ok({ subscribers: await getSubscribers((await params).id) }),
);

/** Body: { raw } — one address per line; "Name <a@b.com>" and "email,name" CSV both work. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { raw } = (await req.json()) as { raw: string };
  if (!raw?.trim()) return fail("Paste at least one email address.");
  return ok(await addSubscribers((await params).id, raw));
});

export const DELETE = route(async (req: Request) => {
  const sid = new URL(req.url).searchParams.get("sid");
  if (!sid) return fail("Missing subscriber id");
  await removeSubscriber(sid);
  return ok({ ok: true });
});
