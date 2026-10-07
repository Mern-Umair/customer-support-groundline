import Link from "next/link";
import { getCurrentContext } from "@/lib/auth/dal";

const stats = [
  { label: "Knowledge sources", value: "0" },
  { label: "Conversations", value: "0" },
  { label: "Resolved by AI", value: "–" },
  { label: "Handed to a human", value: "–" },
];

const steps = [
  { title: "Add your first knowledge source", body: "Paste your website URL or upload a PDF. We crawl, chunk and index it.", href: "/dashboard/sources", status: "next" },
  { title: "Test answers in the playground", body: "Ask questions and check the citations before anything goes live.", status: "soon" },
  { title: "Install the widget", body: "One script tag on your site. Visitors get grounded answers with a human fallback.", status: "soon" },
];

export default async function DashboardOverview() {
  const { workspace } = await getCurrentContext();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Workspace created {workspace.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium">Getting started</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-zinc-600">{step.body}</p>
              </div>
              {step.status === "next" && step.href ? (
                <Link href={step.href} className="self-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                  Start
                </Link>
              ) : (
                <span className="self-center text-xs text-zinc-400">Coming soon</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-base font-medium">Widget key</h2>
        <p className="mt-1 text-sm text-zinc-600">
          This public key identifies your workspace in the embed script. It is safe to put in your site&apos;s HTML.
        </p>
        <code className="mt-3 block rounded-md bg-zinc-100 px-3 py-2 font-mono text-sm">{workspace.publicKey}</code>
      </section>
    </div>
  );
}
