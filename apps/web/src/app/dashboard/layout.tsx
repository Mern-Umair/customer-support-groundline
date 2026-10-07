import Link from "next/link";
import { getCurrentContext } from "@/lib/auth/dal";
import { logoutAction } from "@/app/(auth)/actions";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sources", label: "Knowledge sources" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, role } = await getCurrentContext();

  return (
    <div className="flex flex-1 bg-zinc-50 text-zinc-900">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-5 sm:flex">
        <Link href="/" className="px-2 text-lg font-semibold tracking-tight">
          Groundline
        </Link>
        <div className="mt-6 px-2">
          <p className="truncate text-sm font-medium">{workspace.name}</p>
          <p className="text-xs text-zinc-500">
            {workspace.plan === "free" ? "Free plan" : "Pro plan"} · {role}
          </p>
        </div>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-zinc-200 pt-4">
          <p className="truncate px-2 text-xs text-zinc-500">{user.email}</p>
          <form action={logoutAction}>
            <button type="submit" className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">{children}</main>
    </div>
  );
}
