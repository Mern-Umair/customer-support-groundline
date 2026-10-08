"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Ws {
  id: string;
  name: string;
  plan: string;
  role: string;
  current: boolean;
}

/** Appears only when the user belongs to more than one workspace. */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const [list, setList] = useState<Ws[]>([]);

  useEffect(() => {
    fetch("/api/session/workspace")
      .then((r) => (r.ok ? r.json() : { workspaces: [] }))
      .then((j: { workspaces: Ws[] }) => setList(j.workspaces))
      .catch(() => {});
  }, []);

  if (list.length < 2) return null;
  const current = list.find((w) => w.current)?.id ?? "";

  async function switchTo(id: string) {
    const res = await fetch("/api/session/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: id }) });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <select value={current} onChange={(e) => switchTo(e.target.value)} aria-label="Switch workspace" className="mt-2 h-8 w-full rounded-md border border-border bg-surface px-2 text-xs">
      {list.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name} · {w.role}
        </option>
      ))}
    </select>
  );
}
