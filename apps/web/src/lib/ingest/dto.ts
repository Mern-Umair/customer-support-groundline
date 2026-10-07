import type { PageDoc, SourceDoc } from "../db/types";

/** JSON-safe shapes sent to client components. */
export interface SourceDto {
  id: string;
  kind: SourceDoc["kind"];
  name: string;
  url?: string;
  status: SourceDoc["status"];
  error?: string;
  pageLimit: number;
  counts: SourceDoc["counts"];
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PageDto {
  id: string;
  url?: string;
  title?: string;
  status: PageDoc["status"];
  error?: string;
  depth: number;
  chunkCount: number;
  charCount: number;
  extractor?: PageDoc["extractor"];
  processedAt?: string;
}

export function toSourceDto(s: SourceDoc): SourceDto {
  return {
    id: s._id.toHexString(),
    kind: s.kind,
    name: s.name,
    url: s.url,
    status: s.status,
    error: s.error,
    pageLimit: s.pageLimit,
    counts: s.counts,
    embeddingModel: s.embeddingModel,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    completedAt: s.completedAt?.toISOString(),
  };
}

export function toPageDto(p: PageDoc): PageDto {
  return {
    id: p._id.toHexString(),
    url: p.url,
    title: p.title,
    status: p.status,
    error: p.error,
    depth: p.depth,
    chunkCount: p.chunkCount,
    charCount: p.charCount,
    extractor: p.extractor,
    processedAt: p.processedAt?.toISOString(),
  };
}
