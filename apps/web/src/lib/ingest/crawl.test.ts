import { describe, expect, it } from "vitest";
import { discoverFromSitemaps, fetchHtml, loadRobots } from "./crawl";

function fakeFetch(routes: Record<string, { status?: number; body?: string; type?: string }>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const r = routes[url];
    if (!r) return new Response("not found", { status: 404 });
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: { "content-type": r.type ?? "text/html" } });
  }) as typeof fetch;
}

describe("loadRobots", () => {
  it("honours disallow rules and exposes sitemap entries", async () => {
    const fetchImpl = fakeFetch({
      "https://shop.test/robots.txt": { body: "User-agent: *\nDisallow: /admin\nSitemap: https://shop.test/sm.xml", type: "text/plain" },
    });
    const robots = await loadRobots("https://shop.test/help", { fetchImpl });
    expect(robots.isAllowed("https://shop.test/help")).toBe(true);
    expect(robots.isAllowed("https://shop.test/admin/users")).toBe(false);
    expect(robots.sitemaps).toEqual(["https://shop.test/sm.xml"]);
  });
  it("allows everything when robots.txt is missing", async () => {
    const robots = await loadRobots("https://shop.test/", { fetchImpl: fakeFetch({}) });
    expect(robots.isAllowed("https://shop.test/anything")).toBe(true);
  });
});

describe("fetchHtml", () => {
  it("returns html for html pages", async () => {
    const fetchImpl = fakeFetch({ "https://shop.test/": { body: "<p>hi</p>" } });
    expect((await fetchHtml("https://shop.test/", { fetchImpl })).html).toBe("<p>hi</p>");
  });
  it("rejects non-html and error statuses", async () => {
    const fetchImpl = fakeFetch({
      "https://shop.test/a.json": { body: "{}", type: "application/json" },
      "https://shop.test/missing": { status: 404 },
    });
    await expect(fetchHtml("https://shop.test/a.json", { fetchImpl })).rejects.toThrow(/Not an HTML page/);
    await expect(fetchHtml("https://shop.test/missing", { fetchImpl })).rejects.toThrow(/HTTP 404/);
  });
});

describe("discoverFromSitemaps", () => {
  it("walks a sitemap index, filters to same-site crawlable allowed urls, respects the limit", async () => {
    const fetchImpl = fakeFetch({
      "https://shop.test/sitemap.xml": {
        body: `<sitemapindex><sitemap><loc>https://shop.test/pages.xml</loc></sitemap><sitemap><loc>https://other.test/x.xml</loc></sitemap></sitemapindex>`,
        type: "application/xml",
      },
      "https://shop.test/pages.xml": {
        body: `<urlset>
          <url><loc>https://shop.test/</loc></url>
          <url><loc>https://shop.test/help/returns/</loc></url>
          <url><loc>https://shop.test/admin/secret</loc></url>
          <url><loc>https://shop.test/catalog.pdf</loc></url>
          <url><loc>https://evil.test/phish</loc></url>
          <url><loc>https://shop.test/pricing</loc></url>
          <url><loc>https://shop.test/blog</loc></url>
        </urlset>`,
        type: "application/xml",
      },
    });
    const robots = { isAllowed: (u: string) => !u.includes("/admin"), sitemaps: [] };
    const urls = await discoverFromSitemaps("https://shop.test/", 3, robots, { fetchImpl });
    expect(urls).toEqual(["https://shop.test/", "https://shop.test/help/returns", "https://shop.test/pricing"]);
  });
  it("returns empty when there is no sitemap", async () => {
    const robots = { isAllowed: () => true, sitemaps: [] };
    expect(await discoverFromSitemaps("https://shop.test/", 10, robots, { fetchImpl: fakeFetch({}) })).toEqual([]);
  });
});
