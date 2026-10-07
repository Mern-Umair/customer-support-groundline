import robotsParser from "robots-parser";
import { parseSitemap, sitemapCandidates } from "./sitemap";
import { isCrawlableUrl, isSameSite, normalizeUrl, originOf } from "./url";

export const USER_AGENT = "GroundlineBot/0.1 (+https://github.com/Mern-Umair/customer-support-groundline)";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

export interface CrawlDeps {
  fetchImpl?: typeof fetch;
}

export type RobotsChecker = { isAllowed(url: string): boolean; sitemaps: string[] };

/** Loads robots.txt once per origin. Missing or broken robots.txt means everything is allowed. */
export async function loadRobots(siteUrl: string, deps: CrawlDeps = {}): Promise<RobotsChecker> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const robotsUrl = `${originOf(siteUrl)}/robots.txt`;
  try {
    const res = await fetchImpl(robotsUrl, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return { isAllowed: () => true, sitemaps: [] };
    const body = await res.text();
    const parsed = robotsParser(robotsUrl, body);
    return {
      isAllowed: (url) => parsed.isAllowed(url, USER_AGENT) !== false,
      sitemaps: parsed.getSitemaps(),
    };
  } catch {
    return { isAllowed: () => true, sitemaps: [] };
  }
}

export class FetchPageError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FetchPageError";
  }
}

/** Fetches an HTML page with a timeout, content-type check and size cap. */
export async function fetchHtml(url: string, deps: CrawlDeps = {}): Promise<{ html: string; finalUrl: string }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new FetchPageError(`HTTP ${res.status}`, res.status);
  const type = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(type)) throw new FetchPageError(`Not an HTML page (${type || "unknown content-type"})`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_HTML_BYTES) throw new FetchPageError(`Page too large (${Math.round(buf.byteLength / 1024)} KB)`);
  return { html: new TextDecoder().decode(buf), finalUrl: res.url || url };
}

/**
 * Finds page URLs for a site via sitemaps (robots.txt entries first, then common paths).
 * Returns normalised, same-site, crawlable, de-duplicated URLs up to `limit`.
 * An empty result means "no sitemap"; the pipeline then falls back to link-following.
 */
export async function discoverFromSitemaps(startUrl: string, limit: number, robots: RobotsChecker, deps: CrawlDeps = {}): Promise<string[]> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const queue = [...robots.sitemaps, ...sitemapCandidates(startUrl)];
  const seenSitemaps = new Set<string>();
  const urls = new Set<string>();

  while (queue.length && urls.size < limit && seenSitemaps.size < 20) {
    const sm = queue.shift()!;
    if (seenSitemaps.has(sm)) continue;
    seenSitemaps.add(sm);
    let xml: string;
    try {
      const res = await fetchImpl(sm, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      xml = await res.text();
    } catch {
      continue;
    }
    const parsed = parseSitemap(xml);
    for (const nested of parsed.sitemaps) if (isSameSite(nested, startUrl)) queue.push(nested);
    for (const raw of parsed.urls) {
      const u = normalizeUrl(raw);
      if (u && isSameSite(u, startUrl) && isCrawlableUrl(u) && robots.isAllowed(u)) urls.add(u);
      if (urls.size >= limit) break;
    }
  }
  return [...urls];
}
