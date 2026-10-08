"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ToolInfo {
  name: string;
  description: string;
  sideEffect: boolean;
}

export function ToolsSettings({ enabled, tools, isOwner }: { enabled: boolean; tools: ToolInfo[]; isOwner: boolean }) {
  const [on, setOn] = useState(enabled);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setOn(next);
    const res = await fetch("/api/workspace", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ toolsEnabled: next }) });
    if (!res.ok) {
      setOn(!next);
      setError("Could not save");
    }
  }

  async function seed() {
    const res = await fetch("/api/tools/seed", { method: "POST" });
    const json = (await res.json()) as { created?: number };
    setSeeded(json.created ? `${json.created} demo orders added (48213 shipped, 48300 processing, 47990 delivered)` : "Demo orders already present");
  }

  return (
    <Card className="mt-3 p-4">
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} disabled={!isOwner} className="accent-accent" aria-label="Enable agent tools" />
        <span className="font-medium">Let the assistant use tools</span>
      </label>
      <p className="mt-1 text-xs text-fg-muted">Read-only tools run immediately. Tools that change something wait for your approval in the conversation; the visitor is told the team will confirm.</p>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      <ul className="mt-3 divide-y divide-border">
        {tools.map((t) => (
          <li key={t.name} className="flex items-start gap-3 py-2 text-sm">
            <code className="w-36 shrink-0 font-mono text-xs">{t.name}</code>
            <span className="flex-1 text-xs text-fg-muted">{t.description}</span>
            <Badge tone={t.sideEffect ? "warning" : "success"}>{t.sideEffect ? "needs approval" : "read-only"}</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={seed}>
          Seed demo orders
        </Button>
        {seeded ? <span className="text-xs text-fg-muted">{seeded}</span> : null}
      </div>
      <p className="mt-2 text-[11px] text-fg-subtle">The built-in tools read and write a mock store backend in this workspace. In a real deployment they would call your order system, helpdesk and calendar.</p>
    </Card>
  );
}
