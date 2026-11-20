import { fail, ok, route } from "@/lib/api";
import { runScheduleNow } from "@/lib/scheduler";

type Ctx = { params: Promise<{ id: string }> };

/** Run a schedule now, in the background. Its regular timetable is unchanged. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const started = await runScheduleNow((await params).id);
  return started ? ok({ started: true }, 202) : fail("It's already running, or the schedule no longer exists.", 409);
});
