import { getCurrentContext } from "@/lib/auth/dal";
import { Card } from "@/components/ui/card";

export default async function SettingsPage() {
  const { user, workspace, role } = await getCurrentContext();
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
      <Card className="mt-8 divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="col-span-2 font-medium capitalize">{v}</dd>
          </div>
        ))}
      </Card>
      <p className="mt-4 text-xs text-fg-subtle">Team invites and billing arrive in week 7.</p>
    </div>
  );
}
