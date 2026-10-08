import { headers } from "next/headers";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/collections";
import { ALL_TOOLS } from "@/lib/tools/registry";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ToolsSettings } from "./tools-settings";

export default async function SettingsPage() {
  const { user, workspace, role } = await getCurrentContext();
  const ws = await workspaces(await getDb()).findOne({ _id: workspace._id }, { projection: { toolsEnabled: 1 } });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const snippet = `<script src="${origin}/widget.js" data-key="${workspace.publicKey}" async></script>`;

  const rows = [
    ["Workspace", workspace.name],
    ["Slug", workspace.slug],
    ["Plan", workspace.plan],
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
        <h2 className="text-base font-medium">Agent tools</h2>
        <ToolsSettings enabled={Boolean(ws?.toolsEnabled)} isOwner={role === "owner"} tools={ALL_TOOLS.map((t) => ({ name: t.name, description: t.description, sideEffect: t.sideEffect }))} />
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
        <p className="mt-4 text-xs text-fg-subtle">Team invites and billing arrive in week 7.</p>
      </section>
    </div>
  );
}
