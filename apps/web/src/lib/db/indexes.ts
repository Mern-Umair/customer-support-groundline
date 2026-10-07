import type { Db } from "mongodb";
import { chunks, memberships, pages, sources, users, workspaces } from "./collections";
import { EMBEDDING_DIMENSIONS } from "../ingest/embeddings";

export const CHUNK_VECTOR_INDEX = "chunks_embedding";

/** Idempotent. Called once per process when the connection opens. */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    users(db).createIndex({ email: 1 }, { unique: true }),
    workspaces(db).createIndex({ slug: 1 }, { unique: true }),
    workspaces(db).createIndex({ publicKey: 1 }, { unique: true }),
    memberships(db).createIndex({ userId: 1, workspaceId: 1 }, { unique: true }),
    memberships(db).createIndex({ workspaceId: 1 }),
    sources(db).createIndex({ workspaceId: 1, createdAt: -1 }),
    pages(db).createIndex({ sourceId: 1, status: 1 }),
    pages(db).createIndex({ workspaceId: 1, sourceId: 1, url: 1 }),
    chunks(db).createIndex({ workspaceId: 1, sourceId: 1 }),
    chunks(db).createIndex({ pageId: 1 }),
  ]);
}

/**
 * Atlas Vector Search index on chunks.embedding, pre-filterable by workspace and source.
 * Separate from ensureIndexes because createSearchIndex only exists on Atlas (not on a
 * plain mongod), and M0 allows at most 3 search indexes per cluster. Idempotent.
 */
export async function ensureVectorIndex(db: Db): Promise<{ created: boolean; queryable: boolean }> {
  const col = chunks(db);
  const existing = await col.listSearchIndexes().toArray();
  const found = existing.find((i) => i.name === CHUNK_VECTOR_INDEX) as { queryable?: boolean } | undefined;
  if (found) return { created: false, queryable: found.queryable === true };

  await col.createSearchIndex({
    name: CHUNK_VECTOR_INDEX,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
        { type: "filter", path: "workspaceId" },
        { type: "filter", path: "sourceId" },
      ],
    },
  });
  return { created: true, queryable: false };
}

/** Polls until the vector index reports queryable. Used by tests and the first ingestion. */
export async function waitForVectorIndex(db: Db, timeoutMs = 120_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const list = await chunks(db).listSearchIndexes().toArray();
    const idx = list.find((i) => i.name === CHUNK_VECTOR_INDEX) as { queryable?: boolean } | undefined;
    if (idx?.queryable) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}
