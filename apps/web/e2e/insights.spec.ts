import { expect, test } from "@playwright/test";

const stamp = Date.now();
const email = `e2e-insights-${stamp}@example.com`;
const password = "e2e-password-123";
let publicKey = "";

test.describe.serial("overview insights", () => {
  test("a refused widget question shows up as unanswered and as a handoff", async ({ page, browser }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Insights Tester");
    await page.getByLabel("Company or project name").fill("Oslo Oats");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    publicKey = (await page.locator("code", { hasText: /^wk_/ }).textContent())?.trim() ?? "";

    // Overview starts honest: dashes, zero conversations, nothing unanswered.
    await expect(page.getByText("Answered by AI").locator("..").getByText("–")).toBeVisible();
    await expect(page.getByText("Nothing yet. When the assistant refuses")).toBeVisible();

    // No sources → the widget refuses → handoff.
    const visitorCtx = await browser.newContext();
    const visitor = await visitorCtx.newPage();
    await visitor.goto(`/demo?key=${publicKey}`);
    await visitor.getByRole("button", { name: "Open support chat" }).click();
    const frame = visitor.frameLocator('iframe[title="Support chat"]');
    await frame.getByLabel("Message").fill("Do you deliver to Bergen on Sundays?");
    await frame.getByRole("button", { name: "Send" }).click();
    await expect(frame.getByText(/don't have that information/)).toBeVisible({ timeout: 30_000 });
    await expect(frame.getByText(/bringing in a teammate/)).toBeVisible();
    await visitorCtx.close();

    await page.reload();
    await expect(page.getByText("Conversations", { exact: true }).locator("..").getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByText("Answered by AI").locator("..").getByText("0%")).toBeVisible();
    await expect(page.getByText("Handed to a human").locator("..").getByText("1", { exact: true })).toBeVisible();
    const unanswered = page.getByRole("link", { name: /Do you deliver to Bergen on Sundays\?/ });
    await expect(unanswered).toBeVisible();
    await expect(page.getByRole("img", { name: /Conversations per day/ })).toBeVisible();
    await page.getByText("Table view").click();
    await expect(page.getByRole("cell", { name: "1", exact: true }).first()).toBeVisible();

    await unanswered.click();
    await expect(page).toHaveURL(/\/dashboard\/conversations\/[0-9a-f]{24}$/);
    await expect(page.getByText("Do you deliver to Bergen on Sundays?").last()).toBeVisible();
  });

  test("website sources can be re-synced", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // A URL that does not resolve: the source fails fast, which is enough to exercise re-sync.
    await page.goto("/dashboard/sources");
    await page.getByLabel("Website URL").fill("https://nonexistent-host-for-e2e.invalid/help");
    await page.getByRole("button", { name: "Add source" }).click();
    await expect(page).toHaveURL(/\/dashboard\/sources\/[0-9a-f]{24}$/);
    await expect(page.getByText("Failed", { exact: true })).toBeVisible({ timeout: 90_000 });

    await page.getByRole("button", { name: "Re-sync" }).click();
    await expect(page.getByText("Failed", { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Pages found").locator("..").getByText("1", { exact: true })).toBeVisible();
  });
});
