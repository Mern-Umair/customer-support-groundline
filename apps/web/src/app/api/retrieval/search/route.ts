import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { pipelineContextFrom } from "@/lib/ingest/context";
import { searchChunks } from "@/lib/ingest/retrieval";
import { toObjectId } from "@/lib/tenant";

const Body = z.object({
  query: z.string().trim().min(2).max(500),
  sourceId: z.string().optional(),
  k: z.number().int().min(1).max(20).optional(),
});

/** Debug retrieval: returns the raw chunks the chat would be grounded on. Dashboard only. */
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Enter a question");
  const pc = await pipelineContextFrom(ctx);
  const sourceId = parsed.data.sourceId ? (toObjectId(parsed.data.sourceId) ?? undefined) : undefined;
  const started = performance.now();
  const results = await searchChunks(pc.db, pc.workspaceId, pc.embedder, parsed.data.query, { k: parsed.data.k ?? 5, sourceId });
  return NextResponse.json({ results, latencyMs: Math.round(performance.now() - started), embeddingModel: pc.embedder.id });
}
