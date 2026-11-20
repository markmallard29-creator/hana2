import { fail, ok, route } from "@/lib/api";
import { nextRun, validCadence, type Cadence } from "@/lib/cadence";
import { listSchedules, saveSchedule, type Recipe } from "@/lib/db";

export const GET = route(async () => ok({ schedules: await listSchedules() }));

/** Create or update. Body: { id?, name, recipe, cadence, recipient, enabled } */
export const POST = route(async (req: Request) => {
  const b = (await req.json()) as { id?: string; name: string; recipe: Recipe; cadence: Cadence; recipient: string; enabled?: boolean };
  if (!b.recipe?.settings?.topic?.trim()) return fail("Give the schedule a topic.");
  if (!validCadence(b.cadence)) return fail("Choose when it should run.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.recipient?.trim() ?? "")) return fail("Enter the email address to send it to.");
  const s = b.recipe.settings;
  const recipe: Recipe = {
    settings: {
      ...s,
      topic: s.topic.trim(),
      numArticles: Math.min(20, Math.max(1, Math.round(s.numArticles || 8))),
      daysBack: Math.min(30, Math.max(1, Math.round(s.daysBack || 7))),
    },
    themeId: b.recipe.themeId || "hana",
    editionLabel: b.recipe.editionLabel || "",
  };
  const enabled = b.enabled !== false;
  const id = await saveSchedule({
    id: b.id,
    name: (b.name || recipe.settings.topic).trim().slice(0, 80),
    recipe,
    cadence: b.cadence,
    recipient: b.recipient.trim(),
    enabled,
    next_run_at: enabled ? nextRun(b.cadence).toISOString() : null,
  });
  return ok({ id });
});
