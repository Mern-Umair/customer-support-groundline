import { XMLParser } from "fast-xml-parser";

export interface SitemapResult {
  /** Page URLs found directly in this sitemap. */
  urls: string[];
  /** Nested sitemap URLs (from a sitemapindex). */
  sitemaps: string[];
}

const parser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "url" || name === "sitemap" });

type LocEntry = { loc?: string | number };

function locs(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  return (entries as LocEntry[]).map((e) => (e?.loc !== undefined ? String(e.loc).trim() : "")).filter(Boolean);
}

/** Parses a sitemap.xml or sitemapindex.xml body. Tolerates junk; never throws. */
export function parseSitemap(xml: string): SitemapResult {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { urls: [], sitemaps: [] };
  }
  const urlset = doc.urlset as { url?: unknown } | undefined;
  const index = doc.sitemapindex as { sitemap?: unknown } | undefined;
  return {
    urls: locs(urlset?.url),
    sitemaps: locs(index?.sitemap),
  };
}

/** Candidate sitemap locations for a site, in the order to try them. */
export function sitemapCandidates(siteUrl: string): string[] {
  const origin = new URL(siteUrl).origin;
  return [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
}
