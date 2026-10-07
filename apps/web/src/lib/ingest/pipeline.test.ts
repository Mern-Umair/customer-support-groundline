/**
 * Integration tests against the test database. Exercise the full ingestion pipeline with the
 * offline FakeEmbedder and a fake fetch, then verify tenant-isolated vector retrieval on Atlas.
 */
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

function fakeSite(): typeof fetch {
  const pages: Record<string, string> = {
    "https://shop.test/robots.txt": "User-agent: *\nDisallow: /private\n",
    "https://shop.test/": `<html><head><title>Ali Shoes</title></head><body><main><h1>Ali Shoes</h1><p>We sell shoes online across Europe and ship within three business days from our Lisbon warehouse.</p><a href="/returns">Returns</a> <a href="/private/notes">Private</a> <a href="/shipping">Shipping</a></main></body></html>`,
    "https://shop.test/returns": `<html><head><title>Returns</title></head><body><main><h1>Returns</h1><p>Sale items can be returned within 14 days for store credit if unworn and in the original box. Full-price items get a refund within 30 days.</p></main></body></html>`,
    "https://shop.test/shipping": `<html><head><title>Shipping</title></head><body><main><h1>Shipping</h1><p>Standard shipping is free over 60 euros. Express delivery costs 9 euros and arrives the next business day in Portugal and Spain.</p></main></body></html>`,
  };
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url in pages) {
      const type = url.endsWith("robots.txt") ? "text/plain" : "text/html";
      return new Response(pages[url], { status: 200, headers: { "content-type": type } });
    }
    return new Response("nope", { status: 404 });
  }) as typeof fetch;
}

describe.skipIf(!hasDb)("ingestion pipeline (integration)", () => {
  const tenantA = new ObjectId();
  const tenantB = new ObjectId();
  const userId = new ObjectId();
  let db: import("mongodb").Db;
  let embedder: import("./embeddings").FakeEmbedder;
  let indexReady = false;

  beforeAll(async () => {
    const { getDb } = await import("../db");
    const { FakeEmbedder } = await import("./embeddings");
    const { ensureVectorIndex, waitForVectorIndex } = await import("../db/indexes");
    db = await getDb();
    embedder = new FakeEmbedder();
    try {
      await ensureVectorIndex(db);
      indexReady = await waitForVectorIndex(db, 150_000);
    } catch (err) {
      console.warn("vector index unavailable:", (err as Error).message);
    }
  }, 180_000);

  afterAll(async () => {
    const { sources, pages, chunks } = await import("../db/collections");
    for (const w of [tenantA, tenantB]) {
      await Promise.all([sources(db).deleteMany({ workspaceId: w }), pages(db).deleteMany({ workspaceId: w }), chunks(db).deleteMany({ workspaceId: w })]);
    }
  });

  it("crawls a site via links, respects robots.txt and the page limit, chunks and embeds", async () => {
    const { createWebsiteSource, processSource } = await import("./pipeline");
    const { pages, chunks } = await import("../db/collections");
    const ctx = { db, workspaceId: tenantA, userId, plan: "free" as const, embedder };

    const source = await createWebsiteSource(ctx, "shop.test");
    expect(source.url).toBe("https://shop.test/");
    expect(source.status).toBe("queued");

    let result = await processSource(ctx, source._id, { fetchImpl: fakeSite(), budgetMs: 20_000 });
    while (result.status === "processing") result = await processSource(ctx, source._id, { fetchImpl: fakeSite(), budgetMs: 20_000 });

    expect(result.status).toBe("ready");
    expect(result.counts.pagesProcessed).toBe(3);
    expect(result.counts.pagesFailed).toBe(0);
    expect(result.counts.chunks).toBeGreaterThanOrEqual(3);

    const pageDocs = await pages(db).find({ sourceId: source._id }).toArray();
    const byUrl = Object.fromEntries(pageDocs.map((p) => [p.url, p]));
    expect(byUrl["https://shop.test/private/notes"].status).toBe("skipped");
    expect(byUrl["https://shop.test/returns"].status).toBe("processed");
    expect(byUrl["https://shop.test/returns"].title).toBe("Returns");

    const chunkDocs = await chunks(db).find({ sourceId: source._id }).toArray();
    expect(chunkDocs.every((c) => c.embedding.length === 768 && c.workspaceId.equals(tenantA))).toBe(true);
  }, 120_000);

  it("indexes plain text for a second tenant", async () => {
    const { createTextSource, processSource } = await import("./pipeline");
    const ctx = { db, workspaceId: tenantB, userId, plan: "free" as const, embedder };
    const source = await createTextSource(ctx, "Opening hours", "Our Berlin store is open Monday to Saturday from 10:00 to 19:00. We are closed on Sundays and public holidays. Returns within 14 days.");
    const result = await processSource(ctx, source._id, { budgetMs: 20_000 });
    expect(result.status).toBe("ready");
    expect(result.counts.chunks).toBe(1);
  }, 60_000);

  it("vector search returns only the querying tenant's chunks", async (t) => {
    if (!indexReady) {
      t.skip();
      return;
    }
    const { searchChunks } = await import("./retrieval");

    // Atlas Search is eventually consistent: poll until both tenants' chunks are visible.
    const deadline = Date.now() + 90_000;
    let a: Awaited<ReturnType<typeof searchChunks>> = [];
    let b: Awaited<ReturnType<typeof searchChunks>> = [];
    while (Date.now() < deadline && (a.length === 0 || b.length === 0)) {
      a = await searchChunks(db, tenantA, embedder, "can I return sale shoes within 14 days", { k: 5 });
      b = await searchChunks(db, tenantB, embedder, "returns within 14 days opening hours", { k: 5 });
      if (a.length === 0 || b.length === 0) await new Promise((r) => setTimeout(r, 3000));
    }

    expect(a.length).toBeGreaterThan(0);
    expect(a[0].title).toBe("Returns");
    expect(a.every((r) => r.text.includes("return") || r.title === "Returns" || r.title === "Shipping" || r.title === "Ali Shoes")).toBe(true);
    expect(a.some((r) => r.title === "Opening hours")).toBe(false);

    expect(b.length).toBe(1);
    expect(b[0].title).toBe("Opening hours");

    const none = await searchChunks(db, new ObjectId(), embedder, "returns", { k: 5 });
    expect(none).toEqual([]);
  }, 120_000);
});
