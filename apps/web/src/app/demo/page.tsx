import type { Metadata } from "next";
import Script from "next/script";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/collections";

export const metadata: Metadata = { title: "Ali Shoes (demo site)", robots: { index: false } };

/**
 * A stand-in customer website with the widget installed, used for manual testing,
 * screenshots and e2e. Pass ?key=wk_... to point it at a workspace; without a key it uses
 * the DEMO_WIDGET_KEY env var or the most recently created workspace.
 */
export default async function DemoSite({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key: queryKey } = await searchParams;
  let key = queryKey ?? process.env.DEMO_WIDGET_KEY ?? "";
  if (!key) {
    const db = await getDb();
    const latest = await workspaces(db).findOne({}, { sort: { createdAt: -1 }, projection: { publicKey: 1 } });
    key = latest?.publicKey ?? "";
  }

  return (
    <div className="min-h-dvh bg-[#f6f1ea] text-[#2b2118]">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <span className="font-serif text-2xl font-semibold tracking-tight">Ali Shoes</span>
        <nav className="flex gap-5 text-sm">
          <span>Men</span>
          <span>Women</span>
          <span>Sale</span>
          <span className="font-medium underline">Help</span>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-32">
        <section className="rounded-2xl bg-[#e8d9c6] p-10">
          <p className="text-xs font-medium uppercase tracking-widest text-[#8a6b4f]">Autumn collection</p>
          <h1 className="mt-2 font-serif text-4xl">Handmade leather, shipped across Europe.</h1>
          <p className="mt-3 max-w-md text-sm text-[#5b4a3c]">This is a demo storefront. The chat bubble in the corner is the Groundline widget, installed with a single script tag.</p>
        </section>
        <section className="mt-10 grid gap-6 sm:grid-cols-3">
          {["Oxford · Chestnut", "Loafer · Black", "Boot · Tan"].map((n) => (
            <div key={n} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="aspect-[4/3] rounded-lg bg-[#efe6da]" />
              <p className="mt-3 text-sm font-medium">{n}</p>
              <p className="text-xs text-[#8a6b4f]">€149</p>
            </div>
          ))}
        </section>
        <section className="mt-12 text-sm text-[#5b4a3c]">
          <h2 className="font-serif text-xl text-[#2b2118]">Help</h2>
          <p className="mt-2">Try asking the chat about returns, shipping or sizing. Answers come only from the documents indexed in the connected Groundline workspace.</p>
          <p className="mt-4 rounded-md bg-white p-3 font-mono text-xs text-[#2b2118]">
            {`<script src="/widget.js" data-key="${key || "wk_…"}" async></script>`}
          </p>
        </section>
      </main>
      {key ? <Script src="/widget.js" data-key={key} strategy="afterInteractive" /> : null}
    </div>
  );
}
