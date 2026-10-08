"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Member {
  userId: string;
  role: "owner" | "agent";
  name: string;
  email: string;
}
interface Invite {
  id: string;
  email: string;
  role: "owner" | "agent";
  token: string;
  expiresAt: string;
}

interface Props {
  members: Member[];
  invites: Invite[];
  seats: { used: number; pendingInvites: number; max: number };
  origin: string;
  isOwner: boolean;
  selfId: string;
}

const inputClass = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25";

export function TeamSettings({ members: initialMembers, invites: initialInvites, seats: initialSeats, origin, isOwner, selfId }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [seats, setSeats] = useState(initialSeats);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/team");
    if (!res.ok) return;
    const json = (await res.json()) as { members: Member[]; invites: Invite[] };
    setMembers(json.members);
    setInvites(json.invites);
    setSeats((s) => ({ ...s, used: json.members.length, pendingInvites: json.invites.length }));
  }

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setError(null);
    setBusy(true);
    const res = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: String(form.get("email") ?? ""), role: String(form.get("role") ?? "agent") }) });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Could not invite");
      return;
    }
    formEl.reset();
    await refresh();
  }

  async function revoke(id: string) {
    await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function remove(userId: string) {
    if (!confirm("Remove this member from the workspace?")) return;
    const res = await fetch(`/api/team/members/${userId}`, { method: "DELETE" });
    if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? "Could not remove");
    await refresh();
  }

  async function copy(token: string) {
    const link = `${origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      prompt("Copy this invite link", link);
    }
  }

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          {seats.used} member{seats.used === 1 ? "" : "s"}
          {seats.pendingInvites ? ` · ${seats.pendingInvites} open invite${seats.pendingInvites === 1 ? "" : "s"}` : ""} · {seats.max} seats on your plan
        </p>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {m.name} {m.userId === selfId ? <span className="text-xs text-fg-subtle">(you)</span> : null}
              </p>
              <p className="truncate text-xs text-fg-subtle">{m.email}</p>
            </div>
            <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
            {isOwner && m.userId !== selfId ? (
              <button type="button" onClick={() => remove(m.userId)} aria-label={`Remove ${m.email}`} className="text-fg-subtle hover:text-danger">
                ✕
              </button>
            ) : null}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.email}</p>
              <p className="truncate text-xs text-fg-subtle">invited · expires {new Date(i.expiresAt).toLocaleDateString("en-GB")}</p>
            </div>
            <Badge tone="warning">{i.role} · pending</Badge>
            {isOwner ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => copy(i.token)}>
                  {copied === i.token ? "Copied" : "Copy link"}
                </Button>
                <button type="button" onClick={() => revoke(i.id)} aria-label={`Revoke invite for ${i.email}`} className="text-fg-subtle hover:text-danger">
                  ✕
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2">
          <input name="email" type="email" required placeholder="teammate@company.com" aria-label="Invite email" className={`${inputClass} flex-1`} />
          <select name="role" aria-label="Invite role" className={`${inputClass} w-32`}>
            <option value="agent">Agent</option>
            <option value="owner">Owner</option>
          </select>
          <Button type="submit" size="md" disabled={busy}>
            {busy ? "Inviting…" : "Create invite link"}
          </Button>
        </form>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <p className="mt-2 text-[11px] text-fg-subtle">No email is sent on the free tier: copy the link and share it. Links expire after 7 days and work once. Agents can handle conversations, use the playground and approve actions; owners can also change sources, evals, team and billing.</p>
    </Card>
  );
}
