/**
 * Schedule cadence maths. Times are wall-clock times in a named time zone
 * (Europe/London by default), so "07:00" stays 07:00 across the clock changes.
 * Pure functions: safe to use on the server and in the browser.
 */

export type Freq = "daily" | "weekdays" | "weekly";

export interface Cadence {
  freq: Freq;
  /** 0 = Sunday … 6 = Saturday (weekly only). */
  day?: number;
  /** "HH:MM", 24-hour. */
  time: string;
  tz: string;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function validCadence(c: Partial<Cadence>): c is Cadence {
  return (
    (c.freq === "daily" || c.freq === "weekdays" || c.freq === "weekly") &&
    typeof c.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(c.time) &&
    (c.freq !== "weekly" || (Number.isInteger(c.day) && c.day! >= 0 && c.day! <= 6)) &&
    typeof c.tz === "string" &&
    isTimeZone(c.tz)
  );
}

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function describeCadence(c: Cadence) {
  const when = c.freq === "daily" ? "Every day" : c.freq === "weekdays" ? "Every weekday" : `Every ${DAYS[c.day ?? 1]}`;
  return `${when} at ${c.time}${c.tz === "Europe/London" ? " (UK time)" : ` (${c.tz})`}`;
}

/** Wall-clock parts of an instant in a time zone. */
function partsIn(ts: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset of the zone from UTC at an instant, in ms (e.g. +1h for London in summer). */
function offsetMs(ts: number, tz: string) {
  const p = partsIn(ts, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
}

/** The UTC instant for a wall-clock time in a zone. Times inside a spring-forward gap move forward. */
export function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ts = guess - offsetMs(guess, tz);
  const again = guess - offsetMs(ts, tz);
  if (again !== ts) ts = again;
  return new Date(ts);
}

/** First run strictly after `after`. */
export function nextRun(c: Cadence, after: Date = new Date()): Date {
  const [hh, mm] = c.time.split(":").map(Number);
  const today = partsIn(after.getTime(), c.tz);
  for (let i = 0; i < 15; i++) {
    // step through calendar days in the zone (pure date arithmetic, no DST involved)
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const dow = cal.getUTCDay();
    const ok = c.freq === "daily" || (c.freq === "weekdays" && dow >= 1 && dow <= 5) || (c.freq === "weekly" && dow === c.day);
    if (!ok) continue;
    const at = zonedToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), hh, mm, c.tz);
    if (at.getTime() > after.getTime()) return at;
  }
  throw new Error("Couldn't work out the next run time");
}

/** "Mon 24 Nov, 07:00" in the schedule's zone. */
export function formatRunTime(iso: string | null, tz = "Europe/London") {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
