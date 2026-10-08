import { expect, test, type Page } from "@playwright/test";
import { addTextSource, waitForRetrieval } from "./helpers";

const stamp = Date.now();
const email = `e2e-handoff-${stamp}@example.com`;
const password = "e2e-password-123";
let publicKey = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial("human handoff", () => {
  test("workspace with one source", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Sara Agent");
    await page.getByLabel("Company or project name").fill("Madrid Mugs");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    publicKey = (await page.locator("code", { hasText: /^wk_/ }).textContent())?.trim() ?? "";
    await expect(page.getByTestId("realtime-state")).toHaveText(/Live alerts on/, { timeout: 20_000 });

    await addTextSource(page, "Care guide", "Madrid Mugs are dishwasher safe on the top rack. Do not use them in the microwave if they have a metallic print.");
    await waitForRetrieval(page, "dishwasher safe", /top rack/);
  });

  test("visitor asks for a human, agent is alerted, replies live, hands back", async ({ browser }) => {
    const visitorCtx = await browser.newContext();
    const agentCtx = await browser.newContext();
    const visitor = await visitorCtx.newPage();
    const agent = await agentCtx.newPage();

    // Agent is on the dashboard, connected for alerts.
    await login(agent);
    await expect(agent.getByTestId("realtime-state")).toHaveText(/Live alerts on/, { timeout: 20_000 });

    // Visitor opens the widget and asks for a person.
    await visitor.goto(`/demo?key=${publicKey}`);
    await visitor.getByRole("button", { name: "Open support chat" }).click();
    const frame = visitor.frameLocator('iframe[title="Support chat"]');
    await expect(frame.getByText("Madrid Mugs support")).toBeVisible({ timeout: 30_000 });
    await frame.getByLabel("Message").fill("Can I talk to a human please?");
    await frame.getByRole("button", { name: "Send" }).click();
    await expect(frame.getByText(/bringing in a teammate/)).toBeVisible();
    await expect(frame.getByTestId("live-indicator")).toBeVisible();

    // Agent sees the alert and opens the conversation.
    const toast = agent.getByRole("status").filter({ hasText: "Visitor needs a human" });
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await expect(toast).toContainText("Can I talk to a human");
    await toast.getByRole("link", { name: "Open conversation" }).click();
    await expect(agent).toHaveURL(/\/dashboard\/conversations\/[0-9a-f]{24}$/);
    await expect(agent.getByText("Can I talk to a human please?").last()).toBeVisible();
    await expect(agent.getByTestId("thread-live")).toHaveText("live", { timeout: 20_000 });

    // Agent replies; visitor sees it without reloading.
    await agent.getByLabel("Reply").fill("Hi, this is Sara. Happy to help with your mug.");
    await agent.getByRole("button", { name: "Reply" }).click();
    await expect(frame.getByText("Hi, this is Sara. Happy to help with your mug.")).toBeVisible({ timeout: 20_000 });
    await expect(frame.getByText("Support team")).toBeVisible();

    // Visitor replies in human mode; no model is involved, agent sees it live.
    await frame.getByLabel("Message").fill("Thanks! Is it microwave safe?");
    await frame.getByRole("button", { name: "Send" }).click();
    await expect(agent.getByText("Thanks! Is it microwave safe?")).toBeVisible({ timeout: 20_000 });

    // Hand back to AI; visitor is told, and the next question is answered by the assistant again.
    await agent.getByRole("button", { name: "Hand back to AI" }).click();
    await expect(frame.getByText("The assistant is back on this conversation.")).toBeVisible({ timeout: 20_000 });
    await frame.getByLabel("Message").fill("Are the mugs dishwasher safe?");
    await frame.getByRole("button", { name: "Send" }).click();
    await expect(frame.getByText(/top rack/).last()).toBeVisible({ timeout: 30_000 });

    // The list marks nothing as needing attention anymore.
    await agent.goto("/dashboard/conversations");
    await expect(agent.getByText("Needs attention")).toHaveCount(0);

    await visitorCtx.close();
    await agentCtx.close();
  });
});
