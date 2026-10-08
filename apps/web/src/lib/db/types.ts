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
  /** When true, the latest eval run is shown at /evals/<slug>. */
  evalsPublic?: boolean;
  /** When true, the assistant may call the built-in tools (order lookup, tickets, appointments). */
  toolsEnabled?: boolean;
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

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export type ConversationChannel = "playground" | "widget";
/** ai: assistant answers · human: an agent has taken over · closed: ended */
export type ConversationStatus = "ai" | "human" | "closed";

export interface ConversationDoc extends TenantOwned {
  _id: ObjectId;
  channel: ConversationChannel;
  status: ConversationStatus;
  /** Anonymous visitor id for widget chats; the user id for playground chats. */
  participantId: string;
  title?: string;
  messageCount: number;
  /** Rolling totals for the dashboard. */
  totals: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number; answers: number; refusals: number };
  handoff?: { requestedAt: Date; reason: "low_confidence" | "visitor_asked" | "tool_needs_approval"; agentId?: ObjectId; takenAt?: Date };
  createdAt: Date;
  lastMessageAt: Date;
}

/** system: notes shown in the thread ("connecting you with a teammate"), never sent to the model. */
export type MessageRole = "visitor" | "assistant" | "agent" | "system";

export interface Citation {
  /** 1-based index as shown in the answer text. */
  n: number;
  chunkId: ObjectId;
  sourceId: ObjectId;
  title: string;
  url?: string;
  pageNumber?: number;
}

export interface MessageDoc extends TenantOwned {
  _id: ObjectId;
  conversationId: ObjectId;
  role: MessageRole;
  content: string;
  /** Assistant messages only. */
  citations?: Citation[];
  /** The visitor question this assistant message answered (denormalised for the unanswered list). */
  question?: string;
  refused?: boolean;
  retrieval?: { k: number; topScore: number | null; considered: number };
  usage?: { provider: string; model: string; inputTokens: number; outputTokens: number; costUsd: number | null; latencyMs: number; firstTokenMs: number | null };
  /** Tools the assistant used (or proposed) while producing this message. */
  toolCalls?: { name: string; args: Record<string, unknown>; summary: string; pending: boolean }[];
  feedback?: { vote: "up" | "down"; at: Date };
  error?: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Agent actions
// ---------------------------------------------------------------------------

export type PendingActionStatus = "pending" | "approved" | "rejected" | "failed";

/** A side-effecting tool call the assistant proposed; executed only after an owner approves. */
export interface PendingActionDoc extends TenantOwned {
  _id: ObjectId;
  conversationId: ObjectId;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  status: PendingActionStatus;
  result?: { ok: boolean; summary: string; data: Record<string, unknown> };
  requestedAt: Date;
  decidedAt?: Date;
  decidedBy?: ObjectId;
}

// ---------------------------------------------------------------------------
// Evals
// ---------------------------------------------------------------------------

export type EvalCaseKind = "answerable" | "unanswerable";

export interface EvalCaseDoc extends TenantOwned {
  _id: ObjectId;
  kind: EvalCaseKind;
  question: string;
  /** Reference answer for answerable cases. */
  expectedAnswer?: string;
  /** Substring of the expected source title or URL that a correct answer should cite. */
  expectedSource?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type EvalVerdict = "correct" | "partial" | "incorrect";

export interface EvalResultDoc {
  caseId: ObjectId;
  kind: EvalCaseKind;
  question: string;
  expectedAnswer?: string;
  expectedSource?: string;
  answer: string;
  refused: boolean;
  citedTitles: string[];
  /** For answerable cases with an expectedSource: did a citation match it? */
  citedExpected: boolean | null;
  verdict: EvalVerdict | null;
  judgeReason: string | null;
  latencyMs: number;
  costUsd: number | null;
  topScore: number | null;
  error?: string;
}

export interface EvalMetrics {
  cases: number;
  answerable: number;
  unanswerable: number;
  correct: number;
  partial: number;
  incorrect: number;
  /** correct / answerable (strict). */
  accuracy: number | null;
  /** (correct + partial) / answerable. */
  accuracyLenient: number | null;
  /** cited the expected source / answerable cases that had an expectedSource and were answered. */
  citationHitRate: number | null;
  /** refused answerable / answerable. */
  overRefusal: number | null;
  /** answered unanswerable / unanswerable. */
  underRefusal: number | null;
  avgLatencyMs: number | null;
  costUsd: number;
}

export type EvalRunStatus = "running" | "done" | "failed";

export interface EvalRunDoc extends TenantOwned {
  _id: ObjectId;
  status: EvalRunStatus;
  /** What was under test and who judged it, pinned for comparability. */
  config: { chatProvider: string; chatModel: string; embedder: string; judgeProvider: string; judgeModel: string; rubricVersion: string };
  pending: ObjectId[];
  results: EvalResultDoc[];
  metrics: EvalMetrics;
  createdBy: ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
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
