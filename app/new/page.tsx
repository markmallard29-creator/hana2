import { notFound, redirect } from "next/navigation";
import { config } from "@/lib/config";
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
    // Anything mid-summary when it was saved has lost its text; mark it for retry.
    initial = {
      ...n.draft,
      id: n.id,
      articles: n.draft.articles.map((a) => (a.status === "ready" ? a : { ...a, status: "error" as const })),
    };
  }
  return <Wizard key={id ?? "new"} initial={initial} testEmail={config.testEmail} />;
}
