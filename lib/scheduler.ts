import "server-only";
import { runScheduledEdition } from "./autorun";
import { nextRun } from "./cadence";
import { claimSchedule, dueScheduleIds, finishScheduleRun, getSchedule } from "./db";

/**
 * Runs schedules. Each run is claimed atomically first, so overlapping ticks, a "Run now"
 * click and an external cron call can never run the same schedule twice at once.
 * A missed run (server restarting at 07:00) runs once on the next tick, then the
 * schedule moves on to its next regular time.
 */

let ticking = false;

async function runOne(id: string, dueOnly: boolean) {
  const now = new Date();
  if (!(await claimSchedule(id, now.toISOString(), dueOnly))) return null;
  const sch = await getSchedule(id);
  if (!sch) return null;
  const result = await runScheduledEdition(sch);
  const ranAt = new Date();
  // Manual runs don't change the regular timetable; scheduled ones move to the next slot.
  const nextRunAt = dueOnly && sch.enabled ? nextRun(sch.cadence, ranAt).toISOString() : null;
  await finishScheduleRun(id, { ...result, nextRunAt, ranAt: ranAt.toISOString() });
  return result;
}

/** Run everything that's due. Returns how many ran. */
export async function runDueSchedules() {
  if (ticking) return 0; // previous tick still working
  ticking = true;
  try {
    let n = 0;
    for (const id of await dueScheduleIds(new Date().toISOString())) {
      if (await runOne(id, true)) n++;
    }
    return n;
  } finally {
    ticking = false;
  }
}

/** "Run now": starts in the background; returns false if it's already running. */
export async function runScheduleNow(id: string) {
  const sch = await getSchedule(id);
  if (!sch) return false;
  const stuck = sch.running_since && Date.now() - new Date(sch.running_since).getTime() < 20 * 60_000;
  if (stuck) return false;
  void runOne(id, false).catch((e) => console.error("[schedule] run now failed:", e));
  return true;
}
