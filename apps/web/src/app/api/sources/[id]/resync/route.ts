import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { pipelineContextFrom } from "@/lib/ingest/context";
import { toSourceDto } from "@/lib/ingest/dto";
import { resyncSource, SourceLimitError } from "@/lib/ingest/pipeline";
import { toObjectId } from "@/lib/tenant";

/** Re-crawl a website source from scratch: drops its pages and chunks and queues it again. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const sourceId = toObjectId(id);
  if (!sourceId) return notFound();
  try {
    const source = await resyncSource(await pipelineContextFrom(ctx), sourceId);
    return NextResponse.json({ source: toSourceDto(source) });
  } catch (err) {
    if (err instanceof SourceLimitError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
