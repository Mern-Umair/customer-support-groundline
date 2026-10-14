"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

/** Owner renames the workspace; the name is what visitors see in the widget header. */
export function WorkspaceName({ name, isOwner }: { name: string; isOwner: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/workspace", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: value }) });
    setBusy(false);
    if (!res.ok) {
      setMsg(((await res.json()) as { error?: string }).error ?? "Could not save");
      return;
    }
    setMsg("Saved");
    router.refresh();
  }

  if (!isOwner) return <span className="font-medium">{name}</span>;
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Workspace name" className="h-9 w-64 rounded-md border border-border-strong bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
      <Button type="submit" size="sm" variant="secondary" disabled={busy || value.trim() === name || value.trim().length < 2}>
        {busy ? "Saving…" : "Rename"}
      </Button>
      {msg ? <span className="text-xs text-fg-subtle">{msg}</span> : null}
    </form>
  );
}
