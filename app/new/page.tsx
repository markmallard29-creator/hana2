import { notFound, redirect } from "next/navigation";
import { config, searchOptions } from "@/lib/config";
import { getNewsletter } from "@/lib/db";
import { Wizard } from "@/components/wizard/Wizard";
import type { Draft } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewNewsletter({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  let initial: Draft | null = null;
  if (id) {
    const n = await getNewsletter(id);
    if (!n) notFound();
    if (n.status !== "draft") redirect(`/view/${id}`);
    // Articles that weren't summarised yet carry on where they left off. Older drafts
    // saved without the article text get a Retry button instead (it re-reads the page).
    initial = {
      ...n.draft,
      id: n.id,
      articles: n.draft.articles.map((a) =>
        a.status === "ready" ? a : { ...a, status: a.content ? ("pending" as const) : ("error" as const) },
      ),
    };
  }
  return <Wizard key={id ?? "new"} initial={initial} testEmail={config.testEmail} search={searchOptions()} />;
}
