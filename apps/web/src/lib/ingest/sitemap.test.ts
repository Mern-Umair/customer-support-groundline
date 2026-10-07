import { describe, expect, it } from "vitest";
import { parseSitemap, sitemapCandidates } from "./sitemap";

describe("parseSitemap", () => {
  it("reads urls from a urlset", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>
      <url><loc> https://example.com/pricing </loc></url>
    </urlset>`;
    expect(parseSitemap(xml)).toEqual({ urls: ["https://example.com/", "https://example.com/pricing"], sitemaps: [] });
  });

  it("reads nested sitemaps from a sitemapindex", () => {
    const xml = `<sitemapindex><sitemap><loc>https://example.com/a.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({ urls: [], sitemaps: ["https://example.com/a.xml"] });
  });

  it("handles a single url entry (not an array in naive parsers)", () => {
    const xml = `<urlset><url><loc>https://example.com/only</loc></url></urlset>`;
    expect(parseSitemap(xml).urls).toEqual(["https://example.com/only"]);
  });

  it("never throws on garbage", () => {
    expect(parseSitemap("<html>not a sitemap")).toEqual({ urls: [], sitemaps: [] });
    expect(parseSitemap("")).toEqual({ urls: [], sitemaps: [] });
  });
});

describe("sitemapCandidates", () => {
  it("builds origin-relative candidates", () => {
    expect(sitemapCandidates("https://www.example.com/some/page")[0]).toBe("https://www.example.com/sitemap.xml");
  });
});
