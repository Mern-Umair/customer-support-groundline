import { ObjectId, type Db } from "mongodb";
import { PLAN_LIMITS, type PlanId } from "@groundline/shared";
import { chunks, pages, sources } from "../db/collections";
import { ensureVectorIndex } from "../db/indexes";
import type { ChunkDoc, PageDoc, SourceDoc } from "../db/types";
import { scoped } from "../tenant";
import { chunkText } from "./chunk";
import { discoverFromSitemaps, fetchHtml, loadRobots, type CrawlDeps, type RobotsChecker } from "./crawl";
import type { Embedder } from "./embeddings";
import { extractFromHtml } from "./html";
import { extractPdf } from "./pdf";
import { isCrawlableUrl, isSameSite, normalizeUrl } from "./url";

export interface PipelineContext {
  db: Db;
  workspaceId: ObjectId;
  userId: ObjectId;
  plan: PlanId;
  embedder: Embedder;
}

export class SourceLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceLimitError";
  }
}

async function assertSourceQuota(ctx: PipelineContext): Promise<void> {
  const count = await sources(ctx.db).countDocuments(scoped(ctx.workspaceId));
  const limit = PLAN_LIMITS[ctx.plan].maxSources;
  if (count >= limit) throw new SourceLimitError(`Your plan allows ${limit} knowledge sources. Remove one to add another.`);
}

function newSource(ctx: PipelineContext, partial: Pick<SourceDoc, "kind" | "name" | "url" | "pageLimit">): SourceDoc {
  const now = new Date();
  return {
    _id: new ObjectId(),
    workspaceId: ctx.workspaceId,
    ...partial,
    status: "queued",
    counts: { pagesDiscovered: 0, pagesProcessed: 0, pagesFailed: 0, chunks: 0 },
    embeddingModel: ctx.embedder.id,
    createdBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createWebsiteSource(ctx: PipelineContext, rawUrl: string): Promise<SourceDoc> {
  const url = normalizeUrl(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  if (!url || !isCrawlableUrl(url)) throw new SourceLimitError("Enter a valid website URL, for example https://example.com/help");
  await assertSourceQuota(ctx);
  const source = newSource(ctx, { kind: "website", name: new URL(url).host, url, pageLimit: PLAN_LIMITS[ctx.plan].maxPagesPerSite });
  await sources(ctx.db).insertOne(source);
  await pages(ctx.db).insertOne(newPage(ctx, source._id, { url, depth: 0 }));
  await bumpCounts(ctx, source._id, { pagesDiscovered: 1 });
  return source;
}

export async function createPdfSource(ctx: PipelineContext, fileName: string, bytes: Uint8Array): Promise<SourceDoc> {
  const limit = PLAN_LIMITS[ctx.plan].maxUploadBytes;
  if (bytes.byteLength > limit) throw new SourceLimitError(`PDFs up to ${Math.round(limit / 1024 / 1024)} MB are supported on your plan.`);
  await assertSourceQuota(ctx);
  const pdf = await extractPdf(bytes);
  if (!pdf.text) throw new SourceLimitError("No text found in this PDF. Scanned documents without a text layer are not supported yet.");
  const source = newSource(ctx, { kind: "pdf", name: fileName, pageLimit: 1 });
  await sources(ctx.db).insertOne(source);
  await pages(ctx.db).insertOne(newPage(ctx, source._id, { title: fileName, depth: 0, pendingPages: pdf.pages }));
  await bumpCounts(ctx, source._id, { pagesDiscovered: 1 });
  return source;
}

export async function createTextSource(ctx: PipelineContext, name: string, text: string): Promise<SourceDoc> {
  if (text.trim().length < 20) throw new SourceLimitError("Add at least a few sentences of text.");
  await assertSourceQuota(ctx);
  const source = newSource(ctx, { kind: "text", name, pageLimit: 1 });
  await sources(ctx.db).insertOne(source);
  await pages(ctx.db).insertOne(newPage(ctx, source._id, { title: name, depth: 0, pendingText: text }));
  await bumpCounts(ctx, source._id, { pagesDiscovered: 1 });
  return source;
}

function newPage(ctx: PipelineContext, sourceId: ObjectId, partial: Partial<PageDoc> & { depth: number }): PageDoc {
  return {
    _id: new ObjectId(),
    workspaceId: ctx.workspaceId,
    sourceId,
    status: "pending",
    chunkCount: 0,
    charCount: 0,
    createdAt: new Date(),
    ...partial,
  };
}

async function bumpCounts(ctx: PipelineContext, sourceId: ObjectId, inc: Partial<SourceDoc["counts"]>): Promise<void> {
  const $inc: Record<string, number> = {};
  for (const [k, v] of Object.entries(inc)) if (v) $inc[`counts.${k}`] = v;
  await sources(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: sourceId }), { $inc, $set: { updatedAt: new Date() } });
}

export interface ProcessOptions extends CrawlDeps {
  /** Wall-clock budget for this call. The function returns early and can be called again. */
  budgetMs?: number;
  now?: () => number;
}

export interface ProcessResult {
  status: SourceDoc["status"];
  processedThisRun: number;
  pending: number;
  counts: SourceDoc["counts"];
}

let vectorIndexEnsured = false;

/**
 * Advances a source by as many pages as fit in the time budget. Designed to be called
 * repeatedly from a short-lived serverless function until `status` is "ready" or "failed".
 */
export async function processSource(ctx: PipelineContext, sourceId: ObjectId, opts: ProcessOptions = {}): Promise<ProcessResult> {
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? 25_000);
  const filter = scoped(ctx.workspaceId, { _id: sourceId });
  const source = await sources(ctx.db).findOne(filter);
  if (!source) throw new SourceLimitError("Source not found");
  if (source.status === "ready" || source.status === "failed") {
    return { status: source.status, processedThisRun: 0, pending: 0, counts: source.counts };
  }

  if (!vectorIndexEnsured) {
    try {
      await ensureVectorIndex(ctx.db);
      vectorIndexEnsured = true;
    } catch (err) {
      // Local mongod without Atlas Search: retrieval will not work, ingestion still can.
      console.warn("[ingest] vector index not available:", (err as Error).message);
      vectorIndexEnsured = true;
    }
  }

  let robots: RobotsChecker | undefined;
  if (source.kind === "website" && source.url) {
    robots = await loadRobots(source.url, opts);
    if (source.status === "queued") {
      await sources(ctx.db).updateOne(filter, { $set: { status: "discovering", updatedAt: new Date() } });
      const found = await discoverFromSitemaps(source.url, source.pageLimit, robots, opts);
      if (found.length) await addPendingPages(ctx, source, found, 1);
    }
  }
  await sources(ctx.db).updateOne(filter, { $set: { status: "processing", updatedAt: new Date() } });

  let processedThisRun = 0;
  while (now() < deadline) {
    const page = await pages(ctx.db).findOne(scoped(ctx.workspaceId, { sourceId, status: "pending" }), { sort: { depth: 1, createdAt: 1 } });
    if (!page) break;
    await processPage(ctx, source, page, robots, opts);
    processedThisRun += 1;
  }

  const pending = await pages(ctx.db).countDocuments(scoped(ctx.workspaceId, { sourceId, status: "pending" }));
  const updated = (await sources(ctx.db).findOne(filter))!;
  if (pending === 0) {
    const failedAll = updated.counts.pagesProcessed === 0 && updated.counts.pagesFailed > 0;
    const status: SourceDoc["status"] = failedAll ? "failed" : "ready";
    const firstError = failedAll ? (await pages(ctx.db).findOne(scoped(ctx.workspaceId, { sourceId, status: "failed" })))?.error : undefined;
    await sources(ctx.db).updateOne(filter, { $set: { status, completedAt: new Date(), updatedAt: new Date(), ...(firstError ? { error: firstError } : {}) } });
    return { status, processedThisRun, pending: 0, counts: updated.counts };
  }
  return { status: "processing", processedThisRun, pending, counts: updated.counts };
}

async function addPendingPages(ctx: PipelineContext, source: SourceDoc, urls: string[], depth: number): Promise<number> {
  const existing = await pages(ctx.db).countDocuments(scoped(ctx.workspaceId, { sourceId: source._id }));
  const room = Math.max(0, source.pageLimit - existing);
  if (room === 0) return 0;
  const known = new Set((await pages(ctx.db).find(scoped(ctx.workspaceId, { sourceId: source._id }), { projection: { url: 1 } }).toArray()).map((p) => p.url));
  const fresh = urls.filter((u) => !known.has(u)).slice(0, room);
  if (!fresh.length) return 0;
  await pages(ctx.db).insertMany(fresh.map((url) => newPage(ctx, source._id, { url, depth })));
  await bumpCounts(ctx, source._id, { pagesDiscovered: fresh.length });
  return fresh.length;
}

async function processPage(ctx: PipelineContext, source: SourceDoc, page: PageDoc, robots: RobotsChecker | undefined, deps: CrawlDeps): Promise<void> {
  const pageFilter = scoped(ctx.workspaceId, { _id: page._id });
  try {
    let title = page.title ?? "";
    let extractor: PageDoc["extractor"];
    // Each entry becomes a set of chunks; PDFs keep page numbers for citations.
    const segments: { text: string; pageNumber?: number }[] = [];

    if (source.kind === "website" && page.url) {
      if (robots && !robots.isAllowed(page.url)) {
        await pages(ctx.db).updateOne(pageFilter, { $set: { status: "skipped", error: "Blocked by robots.txt", processedAt: new Date() } });
        return;
      }
      const { html, finalUrl } = await fetchHtml(page.url, deps);
      const extracted = extractFromHtml(html, finalUrl);
      title = extracted.title || new URL(page.url).pathname;
      extractor = extracted.method;
      segments.push({ text: extracted.text });
      const links = extracted.links.filter((l) => source.url && isSameSite(l, source.url));
      if (links.length) await addPendingPages(ctx, source, links, page.depth + 1);
    } else if (page.pendingPages) {
      extractor = "pdf";
      page.pendingPages.forEach((text, i) => {
        if (text) segments.push({ text, pageNumber: i + 1 });
      });
    } else if (page.pendingText) {
      extractor = "text";
      segments.push({ text: page.pendingText });
    }

    const pieces: { text: string; pageNumber?: number }[] = [];
    for (const seg of segments) for (const c of chunkText(seg.text)) pieces.push({ text: c.text, pageNumber: seg.pageNumber });

    if (!pieces.length) {
      await pages(ctx.db).updateOne(pageFilter, { $set: { status: "skipped", title, extractor, error: "No readable text", processedAt: new Date() }, $unset: { pendingText: "", pendingPages: "" } });
      return;
    }

    const vectors = await ctx.embedder.embedDocuments(pieces.map((p) => p.text));
    const docs: ChunkDoc[] = pieces.map((p, i) => ({
      _id: new ObjectId(),
      workspaceId: ctx.workspaceId,
      sourceId: source._id,
      pageId: page._id,
      order: i,
      text: p.text,
      approxTokens: Math.ceil(p.text.length / 4),
      embedding: vectors[i],
      title,
      url: page.url,
      pageNumber: p.pageNumber,
      createdAt: new Date(),
    }));
    await chunks(ctx.db).insertMany(docs);

    const charCount = segments.reduce((s, seg) => s + seg.text.length, 0);
    await pages(ctx.db).updateOne(pageFilter, {
      $set: { status: "processed", title, extractor, chunkCount: docs.length, charCount, processedAt: new Date() },
      $unset: { pendingText: "", pendingPages: "", error: "" },
    });
    await bumpCounts(ctx, source._id, { pagesProcessed: 1, chunks: docs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pages(ctx.db).updateOne(pageFilter, { $set: { status: "failed", error: message.slice(0, 500), processedAt: new Date() } });
    await bumpCounts(ctx, source._id, { pagesFailed: 1 });
  }
}

export async function deleteSource(ctx: PipelineContext, sourceId: ObjectId): Promise<boolean> {
  const res = await sources(ctx.db).deleteOne(scoped(ctx.workspaceId, { _id: sourceId }));
  if (res.deletedCount === 0) return false;
  await Promise.all([
    pages(ctx.db).deleteMany(scoped(ctx.workspaceId, { sourceId })),
    chunks(ctx.db).deleteMany(scoped(ctx.workspaceId, { sourceId })),
  ]);
  return true;
}
