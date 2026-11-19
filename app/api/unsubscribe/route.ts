import { unsubscribeByToken } from "@/lib/db";

/** RFC 8058 one-click unsubscribe (Gmail/Apple Mail "Unsubscribe" button). */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token) await unsubscribeByToken(token);
  return new Response("Unsubscribed", { status: 200 });
}
