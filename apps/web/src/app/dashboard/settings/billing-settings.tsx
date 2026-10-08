"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Props {
  plan: "free" | "pro";
  status?: string;
  periodEnd?: string;
  configured: boolean;
  hasCustomer: boolean;
  isOwner: boolean;
  limits: { free: Record<string, number>; pro: Record<string, number> };
  priceUsd: number;
  notice?: "success" | "cancelled";
}

const LABELS: Record<string, string> = {
  maxSources: "Knowledge sources",
  maxPagesPerSite: "Pages per website",
  maxMessagesPerMonth: "AI answers per month",
  maxSeats: "Team seats",
};

export function BillingSettings({ plan, status, periodEnd, configured, hasCustomer, isOwner, limits, priceUsd, notice }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: "checkout" | "portal") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/billing/${path}`, { method: "POST" });
    const json = (await res.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.url) {
      setError(json.error ?? "Something went wrong");
      return;
    }
    window.location.href = json.url;
  }

  return (
    <Card className="mt-3 p-4">
      {notice === "success" ? <p className="mb-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">Payment received. Your plan updates as soon as Stripe confirms the subscription (usually within seconds).</p> : null}
      {notice === "cancelled" ? <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-sm text-fg-muted">Checkout cancelled. Nothing was charged.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={plan === "pro" ? "accent" : "neutral"}>{plan === "pro" ? "Pro" : "Free"} plan</Badge>
        {status ? <span className="text-xs text-fg-subtle">status: {status}</span> : null}
        {periodEnd ? <span className="text-xs text-fg-subtle">renews {new Date(periodEnd).toLocaleDateString("en-GB")}</span> : null}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-fg-muted">
            <th className="py-1 font-medium">Limit</th>
            <th className="py-1 font-medium">Free</th>
            <th className="py-1 font-medium">Pro · ${priceUsd}/mo</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(LABELS).map((k) => (
            <tr key={k} className="border-t border-border">
              <td className="py-1.5">{LABELS[k]}</td>
              <td className={`py-1.5 tabular-nums ${plan === "free" ? "font-medium" : "text-fg-muted"}`}>{limits.free[k]}</td>
              <td className={`py-1.5 tabular-nums ${plan === "pro" ? "font-medium" : "text-fg-muted"}`}>{limits.pro[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!configured ? (
          <p className="text-xs text-warning" data-testid="billing-unconfigured">
            Billing is not configured on this deployment (no Stripe test keys). Upgrades are disabled; the Pro column shows what the plan would unlock.
          </p>
        ) : plan === "free" ? (
          <Button onClick={() => go("checkout")} disabled={busy || !isOwner}>
            {busy ? "Redirecting…" : "Upgrade to Pro (Stripe test mode)"}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => go("portal")} disabled={busy || !isOwner || !hasCustomer}>
            {busy ? "Redirecting…" : "Manage billing"}
          </Button>
        )}
        {!isOwner ? <span className="text-xs text-fg-subtle">Only the owner can change billing.</span> : null}
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <p className="mt-2 text-[11px] text-fg-subtle">Stripe runs in test mode here: use card 4242 4242 4242 4242 with any future date. No real money moves.</p>
    </Card>
  );
}
