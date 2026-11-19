import Link from "next/link";
import { getLists, listNewsletters, SetupError, usageThisMonth } from "@/lib/db";
import { formatUsd } from "@/lib/format";
import { NewsletterTable } from "@/components/NewsletterTable";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let newsletters: Awaited<ReturnType<typeof listNewsletters>>,
    lists: Awaited<ReturnType<typeof getLists>>,
    month: Awaited<ReturnType<typeof usageThisMonth>>;
  try {
    [newsletters, lists, month] = await Promise.all([listNewsletters(), getLists(), usageThisMonth()]);
  } catch (e) {
    if (!(e instanceof SetupError)) throw e;
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl font-semibold">HANA needs one more setting</h1>
        <p className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-amber-900">{e.message}</p>
        <a href="/setup" className="mt-6 inline-block rounded-md bg-brand px-4 py-2 font-medium text-white">
          Open setup check
        </a>
      </main>
    );
  }
  const sent = newsletters.filter((n) => n.status === "sent");
  const subscribers = lists.reduce((a, l) => a + l.active, 0);

  return (
    <main className="mx-auto max-w-[1150px] px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            {sent.length} sent · {newsletters.length - sent.length} draft{newsletters.length - sent.length === 1 ? "" : "s"} ·{" "}
            {subscribers} active subscribers across {lists.length} list{lists.length === 1 ? "" : "s"}
          </p>
          {month.calls > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              API spend this month: <strong className="text-gray-900">{formatUsd(month.totalUsd)}</strong>
              {sent.length + newsletters.filter((n) => n.status === "draft").length > 0 && (
                <>
                  {" "}
                  · {month.lines.filter((l) => l.provider !== "resend").reduce((a, l) => a + l.calls, 0)} AI and search calls
                </>
              )}
            </p>
          )}
        </div>
        <Link href="/new" className="inline-flex h-12 items-center rounded-md bg-brand px-6 text-[17px] font-medium text-white hover:bg-brand-dark">
          Create a new newsletter
        </Link>
      </div>

      <div className="mt-10">
        {newsletters.length ? (
          <NewsletterTable rows={newsletters} />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center">
            <p className="text-lg font-medium">No newsletters yet</p>
            <p className="mt-1 text-gray-500">Pick a topic and HANA will find and summarise the best reads for you.</p>
            <Link href="/new" className="mt-6 inline-flex h-11 items-center rounded-md bg-brand px-5 font-medium text-white hover:bg-brand-dark">
              Start your first newsletter
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
