import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Evals · Groundline" };

export default function EvalsPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="mx-auto w-full max-w-5xl px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Groundline
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight">Eval numbers</h1>
        <p className="mt-3 text-zinc-600">
          This page will show real accuracy numbers from a fixed test set: how often the assistant answers correctly, how often it cites the right source, and how often it correctly refuses. Nothing is published here until the eval runner exists (planned for week 5). No placeholder numbers.
        </p>
      </main>
    </div>
  );
}
