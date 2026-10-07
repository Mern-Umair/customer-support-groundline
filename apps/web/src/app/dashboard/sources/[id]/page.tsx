import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { pages, sources } from "@/lib/db/collections";
import { toPageDto, toSourceDto } from "@/lib/ingest/dto";
import { scoped, toObjectId } from "@/lib/tenant";
import { SourceDetail } from "./source-detail";

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceId = toObjectId(id);
  if (!sourceId) notFound();
  const ctx = await getCurrentContext();
  const db = await getDb();
  const source = await sources(db).findOne(scoped(ctx.workspace._id, { _id: sourceId }));
  if (!source) notFound();
  const pageList = await pages(db)
    .find(scoped(ctx.workspace._id, { sourceId }), { projection: { pendingText: 0, pendingPages: 0 }, sort: { depth: 1, createdAt: 1 }, limit: 500 })
    .toArray();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/sources" className="text-sm text-fg-muted hover:text-fg">
        ← Knowledge sources
      </Link>
      <SourceDetail initialSource={toSourceDto(source)} initialPages={pageList.map(toPageDto)} />
    </div>
  );
}
