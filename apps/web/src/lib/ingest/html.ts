import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { isCrawlableUrl, isSameSite, normalizeUrl } from "./url";
import { normalizeWhitespace } from "./chunk";

export interface ExtractedPage {
  title: string;
  text: string;
  /** Same-site, normalised, crawlable links found on the page. */
  links: string[];
  /** Which extractor produced the text. */
  method: "readability" | "body";
}

const NOISE_SELECTORS = ["script", "style", "noscript", "svg", "canvas", "iframe", "nav", "footer", "header", "aside", "form", "[role=navigation]", "[role=banner]", "[role=contentinfo]", "[aria-hidden=true]", ".cookie", ".cookie-banner", "#cookie-banner"];

/** Minimum characters for Readability output to be trusted over plain body text. */
const READABILITY_MIN_CHARS = 400;

/**
 * Turns an HTML document into clean text plus outgoing links.
 *
 * Readability (Firefox Reader View) is tried first because it is the most battle-tested
 * main-content extractor. It is tuned for articles, so on short help-centre or product
 * pages it can return almost nothing; in that case we fall back to the whole body with
 * navigation, footers and scripts removed. The pipeline records which path was used.
 */
export function extractFromHtml(html: string, pageUrl: string): ExtractedPage {
  if (!html || !html.trim()) return { title: "", text: "", links: [], method: "body" };
  // Fragments without an <html> root get wrapped so there is always a document element.
  if (!/<html[\s>]/i.test(html)) html = `<html><body>${html}</body></html>`;
  const { document } = parseHTML(html);
  if (!document.documentElement) return { title: "", text: "", links: [], method: "body" };

  const title = (document.querySelector("title")?.textContent ?? document.querySelector("h1")?.textContent ?? "").trim();

  // Collect links before Readability mutates the DOM.
  const links = new Set<string>();
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const abs = normalizeUrl(href, pageUrl);
    if (abs && isSameSite(abs, pageUrl) && isCrawlableUrl(abs)) links.add(abs);
  }

  let text = "";
  let method: ExtractedPage["method"] = "body";

  try {
    const clone = parseHTML(html).document;
    const article = new Readability(clone as unknown as Document, { charThreshold: READABILITY_MIN_CHARS }).parse();
    const candidate = normalizeWhitespace(article?.textContent ?? "");
    if (candidate.length >= READABILITY_MIN_CHARS) {
      text = candidate;
      method = "readability";
    }
  } catch {
    /* fall through to body extraction */
  }

  if (!text) {
    for (const sel of NOISE_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) el.remove();
    }
    const root = document.querySelector("main, article, [role=main]") ?? document.body ?? document.documentElement;
    text = normalizeWhitespace(blockText(root));
  }

  return { title: normalizeWhitespace(title), text, links: [...links], method };
}

/** innerText-like extraction: block elements become line breaks so headings and list items stay separate. */
function blockText(root: Element | null): string {
  if (!root) return "";
  const BLOCK = new Set(["P", "DIV", "SECTION", "ARTICLE", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "TD", "TH", "BR", "HR", "BLOCKQUOTE", "PRE", "DT", "DD", "TABLE"]);
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const isBlock = BLOCK.has(el.tagName);
    if (isBlock) parts.push("\n");
    for (const child of el.childNodes) walk(child);
    if (isBlock) parts.push("\n");
  };
  walk(root);
  return parts.join("");
}
