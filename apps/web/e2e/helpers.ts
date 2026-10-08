import { expect, type Page } from "@playwright/test";

/**
 * Atlas Vector Search is eventually consistent: a freshly indexed chunk can take a while to
 * become searchable. Poll the source page's retrieval tester until the passage comes back,
 * so later chat assertions test the product, not index lag.
 */
export async function waitForRetrieval(page: Page, question: string, expected: string | RegExp): Promise<void> {
  const input = page.getByLabel("Test question");
  await expect(input).toBeVisible();
  await expect
    .poll(
      async () => {
        await input.fill(question);
        await page.getByRole("button", { name: "Search" }).click();
        await page.waitForResponse((r) => r.url().includes("/api/retrieval/search"));
        return page.getByText(expected).count();
      },
      { timeout: 120_000, intervals: [3000] },
    )
    .toBeGreaterThan(0);
}

export async function addTextSource(page: Page, name: string, text: string): Promise<void> {
  await page.goto("/dashboard/sources");
  await page.getByRole("tab", { name: "Plain text" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Text").fill(text);
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(page).toHaveURL(/\/dashboard\/sources\/[0-9a-f]{24}$/);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 60_000 });
}
