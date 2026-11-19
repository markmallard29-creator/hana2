import { ListsManager } from "@/components/ListsManager";

export default function ListsPage() {
  return (
    <main className="mx-auto max-w-[1150px] px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Email lists</h1>
      <p className="mt-1 text-gray-500">List names must be unique, so you always know which one you&apos;re sending to.</p>
      <ListsManager />
    </main>
  );
}
