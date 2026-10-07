import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { pipelineContextFrom } from "@/lib/ingest/context";
import { processSource, SourceLimitError } from "@/lib/ingest/pipeline";
import { toObjectId } from "@/lib/tenant";

// One call processes pages for up to ~25s and returns; the client calls again until done.
// Keeps every invocation well inside serverless limits and makes ingestion resumable.
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const sourceId = toObjectId(id);
  if (!sourceId) return notFound();
  const pc = await pipelineContextFrom(ctx);
  try {
    const result = await processSource(pc, sourceId, { budgetMs: 25_000 });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SourceLimitError) return notFound();
    throw err;
  }
}
