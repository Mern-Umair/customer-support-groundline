import type { ObjectId } from "mongodb";
import type { PlanId } from "@groundline/shared";

export interface UserDoc {
  _id: ObjectId;
  email: string; // lower-cased, unique
  name: string;
  passwordHash: string;
  createdAt: Date;
}

/** A workspace is the tenant. Every tenant-owned document carries `workspaceId`. */
export interface WorkspaceDoc {
  _id: ObjectId;
  name: string;
  slug: string; // unique, used in URLs
  publicKey: string; // unique, embedded in the widget script tag (safe to expose)
  plan: PlanId;
  createdBy: ObjectId;
  createdAt: Date;
}

export type MembershipRole = "owner" | "agent";

export interface MembershipDoc {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
  role: MembershipRole;
  createdAt: Date;
}

/** Marker for documents that belong to a tenant. */
export interface TenantOwned {
  workspaceId: ObjectId;
}

// ---------------------------------------------------------------------------
// Knowledge sources
// ---------------------------------------------------------------------------

export type SourceKind = "website" | "pdf" | "text";
export type SourceStatus = "queued" | "discovering" | "processing" | "ready" | "failed";

export interface SourceDoc extends TenantOwned {
  _id: ObjectId;
  kind: SourceKind;
  /** Display name: site host for websites, file name for uploads. */
  name: string;
  /** Start URL for websites. */
  url?: string;
  status: SourceStatus;
  error?: string;
  /** Max pages to index for this source (plan-derived at creation). */
  pageLimit: number;
  counts: {
    pagesDiscovered: number;
    pagesProcessed: number;
    pagesFailed: number;
    chunks: number;
  };
  /** Embedding model id used for this source's chunks, e.g. gemini-embedding-001@768. */
  embeddingModel: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type PageStatus = "pending" | "processed" | "failed" | "skipped";

/** One unit of ingestion: a web page or an uploaded document. */
export interface PageDoc extends TenantOwned {
  _id: ObjectId;
  sourceId: ObjectId;
  url?: string;
  title?: string;
  status: PageStatus;
  error?: string;
  /** For uploads, the raw text is stored here until processed, then dropped. */
  pendingText?: string;
  pendingPages?: string[];
  depth: number;
  chunkCount: number;
  charCount: number;
  extractor?: "readability" | "body" | "pdf" | "text";
  createdAt: Date;
  processedAt?: Date;
}

/** A retrievable passage with its embedding. Vector index lives on `embedding`. */
export interface ChunkDoc extends TenantOwned {
  _id: ObjectId;
  sourceId: ObjectId;
  pageId: ObjectId;
  order: number;
  text: string;
  approxTokens: number;
  embedding: number[];
  /** Display metadata for citations. */
  title: string;
  url?: string;
  /** 1-based PDF page number when known. */
  pageNumber?: number;
  createdAt: Date;
}
