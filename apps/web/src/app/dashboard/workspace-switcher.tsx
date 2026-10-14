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

const NEW = "__new__";

/** Switch between workspaces or create a new one (each business gets its own data). */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const [list, setList] = useState<Ws[]>([]);

  useEffect(() => {
    fetch("/api/session/workspace")
      .then((r) => (r.ok ? r.json() : { workspaces: [] }))
      .then((j: { workspaces: Ws[] }) => setList(j.workspaces))
      .catch(() => {});
  }, []);

  if (!list.length) return null;
  const current = list.find((w) => w.current)?.id ?? "";

  async function onChange(value: string) {
    if (value === NEW) {
      const name = prompt("Name of the new workspace (your business or project):")?.trim();
      if (!name) return;
      const res = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      if (!res.ok) {
        alert(((await res.json()) as { error?: string }).error ?? "Could not create workspace");
        return;
      }
    } else {
      const res = await fetch("/api/session/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: value }) });
      if (!res.ok) return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <select value={current} onChange={(e) => onChange(e.target.value)} aria-label="Switch workspace" className="mt-2 h-8 w-full rounded-md border border-border bg-surface px-2 text-xs">
      {list.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name} · {w.role}
        </option>
      ))}
      <option value={NEW}>+ New workspace…</option>
    </select>
  );
}
