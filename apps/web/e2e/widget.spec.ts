import { expect, test } from "@playwright/test";

const stamp = Date.now();
const email = `e2e-widget-${stamp}@example.com`;
const password = "e2e-password-123";
let publicKey = "";

test.describe.serial("embedded widget", () => {
  test("set up a workspace with one indexed source", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Widget Tester");
    await page.getByLabel("Company or project name").fill("Porto Plants");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    publicKey = (await page.locator("code", { hasText: /^wk_/ }).textContent())?.trim() ?? "";
    expect(publicKey).toMatch(/^wk_[0-9a-f]{32}$/);

    await page.goto("/dashboard/sources");
    await page.getByRole("tab", { name: "Plain text" }).click();
    await page.getByLabel("Name").fill("Delivery");
    await page.getByLabel("Text").fill("Porto Plants delivers within Portugal in two working days. Delivery is free for orders above 40 euros, otherwise it costs 5 euros. Plants are shipped in recyclable boxes.");
    await page.getByRole("button", { name: "Add source" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 60_000 });
  });

  test("visitor opens the widget on the demo site and gets a cited answer", async ({ page }) => {
    await page.goto(`/demo?key=${publicKey}`);
    const launcher = page.getByRole("button", { name: "Open support chat" });
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(page.getByRole("button", { name: "Close support chat" })).toBeVisible();

    const frame = page.frameLocator('iframe[title="Support chat"]');
    await expect(frame.getByText("Porto Plants support")).toBeVisible({ timeout: 30_000 });

    const box = frame.getByLabel("Message");
    await expect
      .poll(
        async () => {
          await box.fill("How much does delivery cost?");
          await frame.getByRole("button", { name: "Send" }).click();
          await expect(frame.getByRole("button", { name: "Answering…" })).toHaveCount(0, { timeout: 30_000 });
          return frame.getByText("[1] Delivery").count();
        },
        { timeout: 120_000, intervals: [4000] },
      )
      .toBeGreaterThan(0);
    await expect(frame.getByText(/5 euros/).last()).toBeVisible();
    // No diagnostics in the public widget.
    await expect(frame.getByText(/tokens/)).toHaveCount(0);

    await frame.getByRole("button", { name: "Good answer" }).last().click();
    await expect(frame.getByRole("button", { name: "Good answer" }).last()).toHaveAttribute("aria-pressed", "true");

    // Close via the frame's own button → postMessage → loader hides the frame.
    await frame.getByRole("button", { name: "Close chat" }).click();
    await expect(page.getByRole("button", { name: "Open support chat" })).toBeVisible();
  });

  test("public API rejects unknown keys and rate-limits a chatty visitor", async ({ request }) => {
    const bad = await request.post("/api/widget/chat", { data: { key: "wk_00000000000000000000000000000000", visitorId: "v_abcdefghij", message: "hi" } });
    expect(bad.status()).toBe(404);

    const visitorId = `v_ratelimit${stamp}`;
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request.post("/api/widget/chat", { data: { key: publicKey, visitorId, message: `ping ${i}` } });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  test("the chat shows up in the dashboard with the widget badge and transcript", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: "Conversations" }).click();
    const row = page.getByRole("link", { name: /How much does delivery cost/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("widget")).toBeVisible();
    await row.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("How much does delivery cost");
    await expect(page.getByText("[1] Delivery")).toBeVisible();
    await expect(page.getByText("👍")).toBeVisible();
  });
});
