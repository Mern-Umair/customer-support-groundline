import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now();
const email = `e2e-tools-${stamp}@example.com`;
const password = "e2e-password-123";
let publicKey = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial("agent tools with approval", () => {
  test("enable tools and seed demo orders", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Tools Tester");
    await page.getByLabel("Company or project name").fill("Ali Shoes Tools");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    publicKey = (await page.locator("code", { hasText: /^wk_/ }).textContent())?.trim() ?? "";

    await page.goto("/dashboard/settings");
    await expect(page.getByText("needs approval").first()).toBeVisible();
    await Promise.all([page.waitForResponse((r) => r.url().includes("/api/workspace") && r.ok()), page.getByLabel("Enable agent tools").check()]);
    await page.getByRole("button", { name: "Seed demo orders" }).click();
    await expect(page.getByText(/demo orders added/)).toBeVisible();
  });

  test("visitor gets an order status, proposes a ticket, agent approves, visitor sees the confirmation", async ({ browser }) => {
    const visitorCtx = await browser.newContext();
    const agentCtx = await browser.newContext();
    const visitor = await visitorCtx.newPage();
    const agent = await agentCtx.newPage();

    await login(agent);
    await expect(agent.getByTestId("realtime-state")).toHaveText(/Live alerts on/, { timeout: 20_000 });

    await visitor.goto(`/demo?key=${publicKey}`);
    await visitor.getByRole("button", { name: "Open support chat" }).click();
    const frame = visitor.frameLocator('iframe[title="Support chat"]');
    await expect(frame.getByText("Ali Shoes Tools support")).toBeVisible({ timeout: 30_000 });

    // Read-only tool: immediate answer, no handoff.
    await frame.getByLabel("Message").fill("Where is my order #48213?");
    await frame.getByRole("button", { name: "Send" }).click();
    await expect(frame.getByRole("button", { name: "Answering…" })).toHaveCount(0, { timeout: 30_000 });
    await expect(frame.getByText(/Order 48213: shipped/)).toBeVisible();
    await expect(frame.getByText(/bringing in a teammate/)).toHaveCount(0);

    // Side effect: deferred to approval.
    await frame.getByLabel("Message").fill("I want to file a complaint, my boots are faulty. ana@example.com");
    await frame.getByRole("button", { name: "Send" }).click();
    await expect(frame.getByText(/asked the team to approve/)).toBeVisible({ timeout: 30_000 });

    const toast = agent.getByRole("status").filter({ hasText: "Action needs approval" });
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await toast.getByRole("link", { name: "Open conversation" }).click();
    await expect(agent).toHaveURL(/\/dashboard\/conversations\/[0-9a-f]{24}$/);
    const row = agent.getByTestId("action-row").filter({ hasText: "Create a support ticket" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(row.getByText("approved")).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(/Ticket [0-9A-F]{6} created/)).toBeVisible();

    await expect(frame.getByText(/Done, approved by Tools Tester: Ticket [0-9A-F]{6} created/)).toBeVisible({ timeout: 20_000 });

    await visitorCtx.close();
    await agentCtx.close();
  });
});
