import { getNewsletter } from "@/lib/db";

/** Public "view in browser" page for sent newsletters. Drafts are not exposed. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = await getNewsletter((await params).id);
  if (!n || n.status !== "sent" || !n.html) return new Response("Not found", { status: 404 });
  return new Response(n.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
