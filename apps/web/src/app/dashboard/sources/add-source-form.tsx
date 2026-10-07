"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Tab = "website" | "pdf" | "text";

interface Props {
  canAdd: boolean;
  maxPages: number;
  maxUploadMb: number;
}

export function AddSourceForm({ canAdd, maxPages, maxUploadMb }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("website");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      let res: Response;
      if (tab === "pdf") {
        const fd = new FormData();
        const file = form.get("file");
        if (file instanceof File) fd.append("file", file);
        res = await fetch("/api/sources", { method: "POST", body: fd });
      } else {
        const body = tab === "website" ? { kind: "website", url: String(form.get("url") ?? "") } : { kind: "text", name: String(form.get("name") ?? ""), text: String(form.get("text") ?? "") };
        res = await fetch("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      }
      const json = (await res.json()) as { source?: { id: string }; error?: string };
      if (!res.ok || !json.source) {
        setError(json.error ?? "Something went wrong");
        return;
      }
      router.push(`/dashboard/sources/${json.source.id}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "website", label: "Website" },
    { id: "pdf", label: "PDF" },
    { id: "text", label: "Plain text" },
  ];

  return (
    <Card className="p-5">
      <div className="flex gap-1 rounded-md bg-surface-2 p-1 text-sm" role="tablist" aria-label="Source type">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${tab === t.id ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3" key={tab}>
        {tab === "website" ? (
          <>
            <label htmlFor="url" className="text-sm font-medium">
              Website URL
            </label>
            <input id="url" name="url" type="url" required placeholder="https://example.com/help" className={inputClass} />
            <p className="text-xs text-fg-subtle">We read the sitemap first, then follow same-site links. Up to {maxPages} pages on your plan. robots.txt is respected.</p>
          </>
        ) : null}
        {tab === "pdf" ? (
          <>
            <label htmlFor="file" className="text-sm font-medium">
              PDF file
            </label>
            <input id="file" name="file" type="file" accept="application/pdf,.pdf" required className={`${inputClass} py-1.5 file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:font-medium`} />
            <p className="text-xs text-fg-subtle">Up to {maxUploadMb} MB. Text-based PDFs only; scanned images are not read yet.</p>
          </>
        ) : null}
        {tab === "text" ? (
          <>
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input id="name" name="name" required placeholder="Shipping policy" className={inputClass} />
            <label htmlFor="text" className="text-sm font-medium">
              Text
            </label>
            <textarea id="text" name="text" required rows={6} placeholder="Paste the content the assistant should know…" className={`${inputClass} h-auto py-2`} />
          </>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-subtle">{canAdd ? "" : "Source limit reached for your plan."}</span>
          <Button type="submit" disabled={pending || !canAdd}>
            {pending ? "Adding…" : "Add source"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const inputClass = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25";
