"use client";

import { PartyPopper } from "lucide-react";
import { Button, Card } from "../ui";

export function StepDone({ count }: { count: number | null }) {
  return (
    <Card className="p-8">
      <PartyPopper className="h-16 w-16 text-brand" strokeWidth={1.6} />
      <p className="mt-5 text-[19px]">
        We have sent your newsletter{count != null ? ` to ${count} ${count === 1 ? "person" : "people"}` : ""}.
      </p>
      <div className="mt-6 flex flex-wrap justify-between gap-4">
        <Button variant="secondary" size="lg" onClick={() => (window.location.href = "/")}>
          Return to Dashboard
        </Button>
        <Button size="lg" onClick={() => (window.location.href = "/new")}>
          Create a new newsletter
        </Button>
      </div>
    </Card>
  );
}
