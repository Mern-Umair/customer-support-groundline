const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"]);
const SKIP_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|xml|zip|gz|tar|rar|7z|mp4|mp3|mov|avi|woff2?|ttf|eot|pdf|docx?|xlsx?|pptx?)$/i;

/**
 * Canonical form for de-duplicating crawl URLs: https, lower-case host, no hash,
 * no tracking params, sorted query, no trailing slash (except root).
 */
export function normalizeUrl(input: string, base?: string): string | null {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname.startsWith("www.") === false && url.hostname.split(".").length === 2) {
    // keep as-is; we treat www and apex as the same site in isSameSite
  }
  const params = [...url.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()));
  params.sort(([a], [b]) => a.localeCompare(b));
  url.search = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  return url.toString();
}

function apexHost(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

/** Same site = same apex host (www.example.com and example.com count as one). */
export function isSameSite(a: string, b: string): boolean {
  try {
    return apexHost(new URL(a).hostname) === apexHost(new URL(b).hostname);
  } catch {
    return false;
  }
}

/** HTML pages only; binaries and assets are skipped during crawl. */
export function isCrawlableUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return !SKIP_EXTENSIONS.test(pathname);
  } catch {
    return false;
  }
}

export function originOf(url: string): string {
  return new URL(url).origin;
}
