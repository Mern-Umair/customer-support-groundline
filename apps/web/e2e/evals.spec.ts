import { expect, test } from "@playwright/test";

const stamp = Date.now();
const email = `e2e-evals-${stamp}@example.com`;
const password = "e2e-password-123";
let slug = "";

test.describe.serial("evals", () => {
  test("load the demo set, run, publish, and read the public page", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Evals Tester");
    await page.getByLabel("Company or project name").fill("Ali Shoes Evals");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });

    await page.getByRole("link", { name: "Evals" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evals");
    await expect(page.getByText(/Offline stand-ins are active/)).toBeVisible();

    await page.getByRole("button", { name: /Load demo set/ }).click();
    await expect(page.getByText("40 cases · 30 answerable · 10 unanswerable")).toBeVisible({ timeout: 120_000 });

    // Manual case add + delete.
    await page.getByLabel("Kind").selectOption("unanswerable");
    await page.getByLabel("Question").fill("Is the Lisbon warehouse open on holidays?");
    await page.getByRole("button", { name: "Add case" }).click();
    await expect(page.getByText("41 cases · 30 answerable · 11 unanswerable")).toBeVisible();
    await page.getByRole("button", { name: "Delete case: Is the Lisbon warehouse open on holidays?" }).click();
    await expect(page.getByText("40 cases · 30 answerable · 10 unanswerable")).toBeVisible();

    // Make sure retrieval can see the demo docs before running (Atlas lag).
    await page.goto("/dashboard/sources");
    await page.getByRole("link", { name: /Returns and refunds/ }).click();
    const input = page.getByLabel("Test question");
    await expect
      .poll(
        async () => {
          await input.fill("return full price shoes 30 days");
          await page.getByRole("button", { name: "Search" }).click();
          await page.waitForResponse((r) => r.url().includes("/api/retrieval/search"));
          return page.getByText(/30 days of delivery/).count();
        },
        { timeout: 120_000, intervals: [3000] },
      )
      .toBeGreaterThan(0);

    await page.goto("/dashboard/evals");
    await page.getByRole("button", { name: "Run evals" }).click();
    await expect(page).toHaveURL(/\/dashboard\/evals\/runs\/[0-9a-f]{24}$/);
    await expect(page.getByText("done", { exact: true })).toBeVisible({ timeout: 180_000 });
    await expect(page.getByText("Answer accuracy")).toBeVisible();
    await expect(page.getByText("Correct refusals")).toBeVisible();
    await expect(page.getByText("Where is my order 48213 right now?")).toBeVisible();

    // Publish and read the public page.
    await page.goto("/dashboard/evals");
    await expect(page.getByRole("link", { name: /accuracy .* over-refusal/ })).toBeVisible();
    slug = (await page.locator("a", { hasText: /^\/evals\// }).textContent())?.replace("/evals/", "").trim() ?? "";
    expect(slug).toMatch(/^ali-shoes-evals-[0-9a-f]{6}$/);
    await Promise.all([page.waitForResponse((r) => r.url().includes("/api/workspace") && r.ok()), page.getByLabel(/Publish latest run/).check()]);

    await page.goto(`/evals/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ali Shoes Evals");
    await expect(page.getByText("Answer accuracy")).toBeVisible();
    await expect(page.getByText("How long do I have to return full-price shoes?")).toBeVisible();

    await page.goto("/evals");
    await expect(page.getByRole("heading", { level: 2, name: "Ali Shoes Evals" })).toBeVisible();
  });

  test("unpublished workspaces are not visible publicly", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/dashboard/evals");
    await Promise.all([page.waitForResponse((r) => r.url().includes("/api/workspace") && r.ok()), page.getByLabel(/Publish latest run/).uncheck()]);
    const res = await page.request.get(`/evals/${slug}`);
    expect(res.status()).toBe(404);
  });
});
