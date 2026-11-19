"use client";

import { useState } from "react";
import { Button, Input, Label, api } from "@/components/ui";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl font-bold">Sign in to HANA</h1>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api("/api/login", { password: pw });
            const next = new URLSearchParams(window.location.search).get("next") || "/";
            window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <div>
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </main>
  );
}
