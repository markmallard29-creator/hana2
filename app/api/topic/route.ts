import { demoResearch as demoMode } from "@/lib/config";
import { ok, route } from "@/lib/api";
import { refineTopic } from "@/lib/research";

export const POST = route(async (req: Request) => {
  const { topic, audience } = (await req.json()) as { topic: string; audience: string };
  if (demoMode) {
    return ok({ topic: `${topic || "AI news"}: substantive analysis and long reads for ${audience}, skipping product announcements` });
  }
  return ok({ topic: await refineTopic(topic, audience) });
});
