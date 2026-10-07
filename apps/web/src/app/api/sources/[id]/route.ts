import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { pages, sources } from "@/lib/db/collections";
import { pipelineContextFrom } from "@/lib/ingest/context";
import { toPageDto, toSourceDto } from "@/lib/ingest/dto";
import { deleteSource } from "@/lib/ingest/pipeline";
import { scoped, toObjectId } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const sourceId = toObjectId(id);
  if (!sourceId) return notFound();
  const pc = await pipelineContextFrom(ctx);

  const source = await sources(pc.db).findOne(scoped(pc.workspaceId, { _id: sourceId }));
  if (!source) return notFound();
  const pageList = await pages(pc.db)
    .find(scoped(pc.workspaceId, { sourceId }), { projection: { pendingText: 0, pendingPages: 0 }, sort: { depth: 1, createdAt: 1 }, limit: 500 })
    .toArray();
  return NextResponse.json({ source: toSourceDto(source), pages: pageList.map(toPageDto) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const sourceId = toObjectId(id);
  if (!sourceId) return notFound();
  const pc = await pipelineContextFrom(ctx);
  const ok = await deleteSource(pc, sourceId);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
