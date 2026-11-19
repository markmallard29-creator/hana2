import { fail, ok, route } from "@/lib/api";
import { usageForEdition, usageThisMonth } from "@/lib/db";

/** GET ?edition=<id> for one newsletter, or no params for this month's total. */
export const GET = route(async (req: Request) => {
  const edition = new URL(req.url).searchParams.get("edition");
  if (edition) {
    if (!/^[0-9a-f-]{36}$/i.test(edition)) return fail("Bad edition id");
    return ok(await usageForEdition(edition));
  }
  return ok(await usageThisMonth());
});
