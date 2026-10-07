import type { Db, ObjectId } from "mongodb";
import { chunks } from "../db/collections";
import { CHUNK_VECTOR_INDEX } from "../db/indexes";
import type { Embedder } from "./embeddings";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  pageId: string;
  text: string;
  title: string;
  url?: string;
  pageNumber?: number;
  /** Cosine similarity mapped by Atlas to [0, 1]. */
  score: number;
}

export interface SearchOptions {
  k?: number;
  sourceId?: ObjectId;
}

/**
 * Tenant-scoped vector search. The workspace filter is applied inside $vectorSearch
 * (a pre-filter on an indexed field), so other tenants' chunks are never candidates.
 * numCandidates is at least 20x k, the ratio Atlas recommends for ~95% recall.
 */
export async function searchChunks(db: Db, workspaceId: ObjectId, embedder: Embedder, query: string, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
  const k = Math.min(Math.max(opts.k ?? 5, 1), 20);
  const queryVector = await embedder.embedQuery(query);
  const filter: Record<string, unknown> = { workspaceId };
  if (opts.sourceId) filter.sourceId = opts.sourceId;

  const results = await chunks(db)
    .aggregate<{
      _id: ObjectId;
      sourceId: ObjectId;
      pageId: ObjectId;
      text: string;
      title: string;
      url?: string;
      pageNumber?: number;
      score: number;
    }>([
      {
        $vectorSearch: {
          index: CHUNK_VECTOR_INDEX,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(100, k * 20),
          limit: k,
          filter,
        },
      },
      { $project: { text: 1, title: 1, url: 1, pageNumber: 1, sourceId: 1, pageId: 1, score: { $meta: "vectorSearchScore" } } },
    ])
    .toArray();

  return results.map((r) => ({
    chunkId: r._id.toHexString(),
    sourceId: r.sourceId.toHexString(),
    pageId: r.pageId.toHexString(),
    text: r.text,
    title: r.title,
    url: r.url,
    pageNumber: r.pageNumber,
    score: r.score,
  }));
}
