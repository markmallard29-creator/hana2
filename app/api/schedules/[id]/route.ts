import { fail, ok, route } from "@/lib/api";
import { nextRun } from "@/lib/cadence";
import { deleteSchedule, getSchedule, saveSchedule } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { enabled } — pause or resume. Resuming picks the next regular time from now. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const sch = await getSchedule((await params).id);
  if (!sch) return fail("Not found", 404);
  const { enabled } = (await req.json()) as { enabled: boolean };
  await saveSchedule({ ...sch, enabled, next_run_at: enabled ? nextRun(sch.cadence).toISOString() : null });
  return ok({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  await deleteSchedule((await params).id);
  return ok({ ok: true });
});
