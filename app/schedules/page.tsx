import { config, searchOptions } from "@/lib/config";
import { getNewsletter, listSchedules, type Recipe } from "@/lib/db";
import { SchedulesManager } from "@/components/SchedulesManager";

export const dynamic = "force-dynamic";

/** ?from=<newsletter id> pre-fills a new schedule with that newsletter's settings. */
export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  let seed: Recipe | null = null;
  if (from) {
    const n = await getNewsletter(from);
    if (n) seed = { settings: n.draft.settings, themeId: n.draft.themeId, editionLabel: n.draft.editionLabel };
  }
  const schedules = await listSchedules();
  return (
    <main className="mx-auto max-w-[1150px] px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
      <p className="mt-1 text-gray-500">
        HANA researches and writes a fresh edition on a timetable and emails it to you. Nothing goes to a list: review it, then
        copy it into beehiiv or send it on from HANA.
      </p>
      <SchedulesManager initial={schedules} search={searchOptions()} defaultRecipient={config.testEmail} seed={seed} />
    </main>
  );
}
