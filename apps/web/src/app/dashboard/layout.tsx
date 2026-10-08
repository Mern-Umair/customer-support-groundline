import { getCurrentContext } from "@/lib/auth/dal";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { NavLinks } from "./nav-links";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sources", label: "Knowledge sources" },
  { href: "/dashboard/playground", label: "Playground" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, role } = await getCurrentContext();

  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-5 sm:flex">
        <div className="px-2">
          <Logo href="/dashboard" />
        </div>
        <div className="mt-6 rounded-md border border-border bg-bg px-3 py-2.5">
          <p className="truncate text-sm font-medium">{workspace.name}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge tone={workspace.plan === "free" ? "neutral" : "accent"}>{workspace.plan === "free" ? "Free" : "Pro"}</Badge>
            <span className="text-xs capitalize text-fg-subtle">{role}</span>
          </div>
        </div>
        <div className="mt-5">
          <NavLinks items={nav} />
        </div>
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate px-2 text-xs text-fg-subtle">{user.email}</p>
          <form action={logoutAction}>
            <button type="submit" className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-2 hover:text-fg">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">{children}</main>
    </div>
  );
}
