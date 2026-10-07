import { describe, expect, it } from "vitest";
import { isCrawlableUrl, isSameSite, normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("strips hash, tracking params and trailing slash, sorts the query", () => {
    expect(normalizeUrl("https://Example.com/docs/?b=2&utm_source=x&a=1#top")).toBe("https://example.com/docs?a=1&b=2");
  });
  it("keeps the root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
  it("resolves relative links against a base", () => {
    expect(normalizeUrl("../pricing", "https://example.com/docs/intro")).toBe("https://example.com/pricing");
  });
  it("rejects non-http schemes and garbage", () => {
    expect(normalizeUrl("mailto:a@b.com")).toBeNull();
    expect(normalizeUrl("javascript:void(0)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("isSameSite", () => {
  it("treats www and apex as the same site", () => {
    expect(isSameSite("https://www.example.com/a", "https://example.com/b")).toBe(true);
  });
  it("rejects other hosts and subdomains", () => {
    expect(isSameSite("https://example.com", "https://docs.example.com")).toBe(false);
    expect(isSameSite("https://example.com", "https://evil.com")).toBe(false);
  });
});

describe("isCrawlableUrl", () => {
  it("skips assets and binaries", () => {
    expect(isCrawlableUrl("https://x.com/logo.png")).toBe(false);
    expect(isCrawlableUrl("https://x.com/file.PDF")).toBe(false);
    expect(isCrawlableUrl("https://x.com/app.js")).toBe(false);
  });
  it("allows pages", () => {
    expect(isCrawlableUrl("https://x.com/pricing")).toBe(true);
    expect(isCrawlableUrl("https://x.com/help/returns.html")).toBe(true);
  });
});
