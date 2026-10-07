import { describe, expect, it } from "vitest";
import { extractFromHtml } from "./html";

const shortHelpPage = `<!doctype html><html><head><title>Returns · Ali Shoes</title>
<script>window.track=1</script><style>.x{}</style></head>
<body>
<nav><a href="/">Home</a><a href="/pricing">Pricing</a><a href="https://twitter.com/ali">Twitter</a></nav>
<main>
  <h1>Returns</h1>
  <p>Sale items can be returned within <b>14 days</b> for store credit.</p>
  <ul><li>Unworn</li><li>Original box</li></ul>
  <a href="/help/shipping?utm_source=x#top">Shipping</a>
  <a href="/brochure.pdf">Brochure</a>
</main>
<footer>© Ali Shoes <a href="/privacy">Privacy</a></footer>
</body></html>`;

describe("extractFromHtml", () => {
  it("extracts title, clean text and same-site links from a short page", () => {
    const page = extractFromHtml(shortHelpPage, "https://alishoes.com/help/returns");
    expect(page.title).toBe("Returns · Ali Shoes");
    expect(page.method).toBe("body");
    expect(page.text).toContain("Returns");
    expect(page.text).toContain("Sale items can be returned within 14 days for store credit.");
    expect(page.text).toContain("Unworn");
    expect(page.text).not.toContain("window.track");
    expect(page.text).not.toContain("Pricing"); // nav removed
    expect(page.text).not.toContain("Privacy"); // footer removed
    expect(page.links).toEqual(
      expect.arrayContaining(["https://alishoes.com/", "https://alishoes.com/pricing", "https://alishoes.com/help/shipping", "https://alishoes.com/privacy"]),
    );
    expect(page.links).not.toContain("https://twitter.com/ali");
    expect(page.links.some((l) => l.endsWith(".pdf"))).toBe(false);
  });

  it("keeps list items and headings on separate lines", () => {
    const page = extractFromHtml(shortHelpPage, "https://alishoes.com/help/returns");
    expect(page.text.split("\n").map((l) => l.trim())).toEqual(expect.arrayContaining(["Unworn", "Original box"]));
  });

  it("uses Readability for long article pages", () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => `<p>Paragraph ${i} explains the warranty terms in detail for customers who bought shoes online and want to know what is covered.</p>`).join("");
    const html = `<html><head><title>Warranty</title></head><body><nav>Menu Home About</nav><article><h1>Warranty</h1>${paragraphs}</article><footer>Footer stuff</footer></body></html>`;
    const page = extractFromHtml(html, "https://alishoes.com/warranty");
    expect(page.method).toBe("readability");
    expect(page.text).toContain("Paragraph 11 explains");
    expect(page.text).not.toContain("Footer stuff");
  });

  it("does not throw on empty or broken html", () => {
    expect(extractFromHtml("", "https://x.com/").text).toBe("");
    expect(extractFromHtml("<div><p>unclosed", "https://x.com/").text).toBe("unclosed");
  });
});
