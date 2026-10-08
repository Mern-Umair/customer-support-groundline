import { headers } from "next/headers";
import { PLAN_LIMITS, PLAN_PRICES_USD } from "@groundline/shared";
import { getCurrentContext } from "@/lib/auth/dal";
import { billingConfigured } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/collections";
import { listTeam, seatUsage } from "@/lib/team/invites";
import { ALL_TOOLS } from "@/lib/tools/registry";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BillingSettings } from "./billing-settings";
import { TeamSettings } from "./team-settings";
import { ToolsSettings } from "./tools-settings";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const { user, workspace, role } = await getCurrentContext();
  const { billing: billingNotice } = await searchParams;
  const db = await getDb();
  const [ws, team, seats] = await Promise.all([
    workspaces(db).findOne({ _id: workspace._id }, { projection: { toolsEnabled: 1, billing: 1, plan: 1 } }),
    listTeam(db, workspace._id),
    seatUsage(db, workspace._id, workspace.plan),
  ]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const snippet = `<script src="${origin}/widget.js" data-key="${workspace.publicKey}" async></script>`;
  const isOwner = role === "owner";

  const rows = [
    ["Workspace", workspace.name],
    ["Slug", workspace.slug],
    ["Your role", role],
    ["Account email", user.email],
  ];
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-8">
        <h2 className="text-base font-medium">Install the widget</h2>
        <p className="mt-1 text-sm text-fg-muted">Paste this one line before the closing <code className="font-mono">&lt;/body&gt;</code> tag of your site. The chat bubble appears bottom-right.</p>
        <Card className="mt-3 p-4">
          <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs leading-relaxed">{snippet}</pre>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-fg-subtle">
            <span>
              Optional: <code className="font-mono">data-color=&quot;#hex&quot;</code> for the bubble colour, <code className="font-mono">data-position=&quot;left&quot;</code> to move it.
            </span>
            <ButtonLink href={`/demo?key=${workspace.publicKey}`} variant="secondary" size="sm" target="_blank">
              Open demo site with your widget
            </ButtonLink>
          </div>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium">Team</h2>
        <TeamSettings members={team.members} invites={team.invites} seats={seats} origin={origin} isOwner={isOwner} selfId={user._id.toHexString()} />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium">Plan and billing</h2>
        <BillingSettings
          plan={ws?.plan ?? workspace.plan}
          status={ws?.billing?.status}
          periodEnd={ws?.billing?.currentPeriodEnd?.toISOString()}
          configured={billingConfigured()}
          hasCustomer={Boolean(ws?.billing?.stripeCustomerId)}
          isOwner={isOwner}
          limits={{ free: { ...PLAN_LIMITS.free }, pro: { ...PLAN_LIMITS.pro } }}
          priceUsd={PLAN_PRICES_USD.pro}
          notice={billingNotice === "success" || billingNotice === "cancelled" ? billingNotice : undefined}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium">Agent tools</h2>
        <ToolsSettings enabled={Boolean(ws?.toolsEnabled)} isOwner={isOwner} tools={ALL_TOOLS.map((t) => ({ name: t.name, description: t.description, sideEffect: t.sideEffect }))} />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium">Workspace</h2>
        <Card className="mt-3 divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="col-span-2 font-medium capitalize">{v}</dd>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
