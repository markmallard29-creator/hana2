export {};
// Next-run maths, including the UK clock changes (2026: 29 Mar forward, 25 Oct back).
import { nextRun, describeCadence, validCadence, type Cadence } from "../lib/cadence";
let fail = 0;
const t = (name: string, c: Cadence, after: string, want: string) => {
  const got = nextRun(c, new Date(after)).toISOString();
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (want ${want})`}`);
};
const L = "Europe/London";
t("weekly Mon 07:00, from Fri (winter, UTC+0)", { freq: "weekly", day: 1, time: "07:00", tz: L }, "2026-11-20T15:00:00Z", "2026-11-23T07:00:00.000Z");
t("weekly Mon 07:00, on Mon 06:59", { freq: "weekly", day: 1, time: "07:00", tz: L }, "2026-11-23T06:59:00Z", "2026-11-23T07:00:00.000Z");
t("weekly Mon 07:00, on Mon 07:00 exactly → next week", { freq: "weekly", day: 1, time: "07:00", tz: L }, "2026-11-23T07:00:00Z", "2026-11-30T07:00:00.000Z");
t("daily 07:00 in summer (BST) = 06:00 UTC", { freq: "daily", time: "07:00", tz: L }, "2026-07-01T12:00:00Z", "2026-07-02T06:00:00.000Z");
t("daily across spring-forward (Sun 29 Mar)", { freq: "daily", time: "07:00", tz: L }, "2026-03-28T12:00:00Z", "2026-03-29T06:00:00.000Z");
t("daily across fall-back (Sun 25 Oct)", { freq: "daily", time: "07:00", tz: L }, "2026-10-24T12:00:00Z", "2026-10-25T07:00:00.000Z");
t("weekdays from Fri evening → Mon", { freq: "weekdays", time: "08:30", tz: L }, "2026-11-20T18:00:00Z", "2026-11-23T08:30:00.000Z");
t("weekdays from Sat → Mon", { freq: "weekdays", time: "08:30", tz: L }, "2026-11-21T09:00:00Z", "2026-11-23T08:30:00.000Z");
t("weekly Sun 23:30 from Sun 23:45", { freq: "weekly", day: 0, time: "23:30", tz: L }, "2026-11-22T23:45:00Z", "2026-11-29T23:30:00.000Z");
t("time in the spring-forward gap (01:30 on 29 Mar)", { freq: "daily", time: "01:30", tz: L }, "2026-03-29T00:00:00Z", "2026-03-29T01:30:00.000Z");
t("New York zone works too", { freq: "daily", time: "07:00", tz: "America/New_York" }, "2026-11-20T15:00:00Z", "2026-11-21T12:00:00.000Z");
console.log(describeCadence({ freq: "weekly", day: 1, time: "07:00", tz: L }), "|", describeCadence({ freq: "weekdays", time: "08:30", tz: L }));
const bad = [{ freq: "weekly", time: "07:00", tz: L }, { freq: "daily", time: "7am", tz: L }, { freq: "daily", time: "07:00", tz: "Mars/Olympus" }];
console.log("rejects bad cadences:", bad.every((b) => !validCadence(b as Cadence)));
if (fail) process.exit(1);
