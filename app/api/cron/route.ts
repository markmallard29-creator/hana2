import { fail, ok, route } from "@/lib/api";
import { runDueSchedules } from "@/lib/scheduler";

export const maxDuration = 300;

/**
 * Runs due schedules. Called every minute by HANA's own timer (instrumentation.ts) and,
 * optionally, by an external cron as a backup: POST /api/cron with
 * "authorization: Bearer <CRON_SECRET>".
 */
async function handle(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const keys = [process.env.HANA_INTERNAL_CRON_TOKEN, process.env.CRON_SECRET].filter((k): k is string => !!k && k.length >= 16);
  if (!keys.length || !keys.includes(auth)) return fail("Not allowed", 401);
  const ran = await runDueSchedules();
  return ok({ ran });
}

export const POST = route(handle);
export const GET = route(handle);
