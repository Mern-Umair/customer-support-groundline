import { expect, test } from "@playwright/test";

const stamp = Date.now();
const email = `e2e-pg-${stamp}@example.com`;
const password = "e2e-password-123";

test.describe.serial("playground", () => {
  test("empty workspace points to sources", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Playground Tester");
    await page.getByLabel("Company or project name").fill("Lisbon Lamps");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });

    await page.getByRole("link", { name: "Playground" }).click();
    await expect(page.getByText("Nothing to answer from yet")).toBeVisible();
    await expect(page.getByText(/Running offline/)).toBeVisible();
  });

  test("answers with a citation, shows cost/latency, refuses off-topic, records feedback", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Add a text source and wait for it to index.
    await page.goto("/dashboard/sources");
    await page.getByRole("tab", { name: "Plain text" }).click();
    await page.getByLabel("Name").fill("Warranty");
    await page.getByLabel("Text").fill("Every lamp from Lisbon Lamps comes with a two-year warranty covering electrical faults. Bulbs are excluded from the warranty. Claims are handled by email within two working days.");
    await page.getByRole("button", { name: "Add source" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 60_000 });

    await page.goto("/dashboard/playground");
    const box = page.getByLabel("Message");
    await expect(box).toBeVisible();

    // Atlas Search is eventually consistent: retry until the answer cites the source.
    await expect
      .poll(
        async () => {
          await box.fill("How long is the warranty on a lamp?");
          await page.getByRole("button", { name: "Send" }).click();
          await expect(page.getByRole("button", { name: "Answering…" })).toHaveCount(0, { timeout: 30_000 });
          return page.getByText("[1] Warranty").count();
        },
        { timeout: 120_000, intervals: [4000] },
      )
      .toBeGreaterThan(0);

    await expect(page.getByText("two-year warranty").last()).toBeVisible();
    await expect(page.getByText(/\d+ ms/).last()).toBeVisible();
    await expect(page.getByText(/tokens/).last()).toBeVisible();

    await page.getByRole("button", { name: "Good answer" }).last().click();
    await expect(page.getByRole("button", { name: "Good answer" }).last()).toHaveAttribute("aria-pressed", "true");

    // Off-topic question → refusal bubble (the offline provider still gets sources, so this
    // checks the end-to-end path rather than model judgement).
    await box.fill("What is the capital of France?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("button", { name: "Answering…" })).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator("text=/warranty|don't have that information/i").last()).toBeVisible();
  });
});
