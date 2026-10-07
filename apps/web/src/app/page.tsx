import Link from "next/link";

const features = [
  {
    title: "Answers from your documents",
    body: "Add your website URL and PDFs. Every answer is grounded in your own content and cites its source.",
  },
  {
    title: "Human handoff in real time",
    body: "When the AI cannot answer, your dashboard rings and you take over the same conversation live.",
  },
  {
    title: "Measured, not promised",
    body: "A test set per workspace, accuracy numbers on a public page, and regression checks in CI.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Groundline</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-24 pt-16">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Open source build, in progress
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          AI customer support that only says what your docs say.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-600">
          One script tag adds a support chat to your site. It answers from your
          own content with citations, hands off to a human when it should, and
          shows you exactly how accurate it is.
        </p>

        <div className="mt-8 flex gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
          >
            Create a workspace
          </Link>
          <Link
            href="/evals"
            className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-white"
          >
            See the eval numbers
          </Link>
        </div>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="font-medium">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500">
        Built in public. Free tiers only. No invented metrics.
      </footer>
    </div>
  );
}
