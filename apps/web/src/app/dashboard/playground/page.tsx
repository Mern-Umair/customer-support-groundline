import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { chunks } from "@/lib/db/collections";
import { getEmbedder } from "@/lib/ingest/embedder";
import { getChatProvider } from "@/lib/llm/provider";
import { scoped } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Playground } from "./playground";

export const metadata: Metadata = { title: "Playground · Groundline" };

export default async function PlaygroundPage() {
  const ctx = await getCurrentContext();
  const db = await getDb();
  const chunkCount = await chunks(db).countDocuments(scoped(ctx.workspace._id));
  const llm = getChatProvider();
  const embedder = getEmbedder();
  const offline = llm.provider === "fake" || embedder.id.startsWith("fake");

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
          <p className="mt-1 text-sm text-fg-muted">Ask what a visitor would ask. Every answer shows its sources, cost and latency.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge tone={offline ? "warning" : "accent"}>
            {llm.provider} · {llm.model}
          </Badge>
          <Badge tone="neutral">{embedder.id}</Badge>
        </div>
      </div>
      {offline ? (
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          Running offline: no GEMINI_API_KEY or GROQ_API_KEY is set, so answers come from a deterministic extractive stand-in. Add a key to get real model answers.
        </p>
      ) : null}

      {chunkCount === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing to answer from yet"
            body="Add a website or document first. The assistant only answers from indexed content."
            action={
              <ButtonLink href="/dashboard/sources" size="sm">
                Add a knowledge source
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex-1">
          <Playground />
        </div>
      )}
      <p className="mt-4 text-xs text-fg-subtle">
        Playground chats are stored like real ones and appear under <Link href="/dashboard/conversations" className="underline-offset-4 hover:underline">Conversations</Link>.
      </p>
    </div>
  );
}
