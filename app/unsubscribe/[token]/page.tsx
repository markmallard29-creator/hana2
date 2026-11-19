import { revalidatePath } from "next/cache";
import { subscriberByToken, unsubscribeByToken } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Unsubscribing takes a button press, not just a visit: corporate link scanners
 * (e.g. Microsoft Safe Links) open every link in an email and would otherwise
 * unsubscribe people silently. Gmail/Apple's one-click button uses /api/unsubscribe.
 */
export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await subscriberByToken(token);

  async function confirm() {
    "use server";
    await unsubscribeByToken(token);
    revalidatePath(`/unsubscribe/${token}`);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      {!sub ? (
        <>
          <h1 className="text-2xl font-semibold">Link not recognised</h1>
          <p className="mt-3 text-gray-600">
            This unsubscribe link is invalid. Reply to any newsletter and we&apos;ll remove you by hand.
          </p>
        </>
      ) : sub.unsubscribed ? (
        <>
          <h1 className="text-2xl font-semibold">You&apos;re unsubscribed</h1>
          <p className="mt-3 text-gray-600">
            {sub.email} won&apos;t receive {sub.listName} any more.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Unsubscribe?</h1>
          <p className="mt-3 text-gray-600">
            Stop sending {sub.listName} to {sub.email}.
          </p>
          <form action={confirm} className="mt-8">
            <button className="rounded-md bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-700">
              Unsubscribe me
            </button>
          </form>
        </>
      )}
    </main>
  );
}
