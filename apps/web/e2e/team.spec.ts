import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now();
const ownerEmail = `e2e-owner-${stamp}@example.com`;
const agentEmail = `e2e-agent-${stamp}@example.com`;
const password = "e2e-password-123";
let inviteLink = "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial("team, roles and billing", () => {
  test("owner sees billing as not configured and creates an invite link", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Owner Person");
    await page.getByLabel("Company or project name").fill("Team Co");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });

    await page.goto("/dashboard/settings");
    await expect(page.getByTestId("billing-unconfigured")).toBeVisible();
    await expect(page.getByText("2 seats on your plan")).toBeVisible();

    await page.getByLabel("Invite email").fill(agentEmail);
    await page.getByRole("button", { name: "Create invite link" }).click();
    await expect(page.getByText("agent · pending")).toBeVisible();

    // Seat limit on the free plan: 1 member + 1 invite = 2 seats.
    await page.getByLabel("Invite email").fill(`e2e-third-${stamp}@example.com`);
    await page.getByRole("button", { name: "Create invite link" }).click();
    await expect(page.getByText(/allows 2 seats/)).toBeVisible();

    const team = await page.request.get("/api/team");
    const json = (await team.json()) as { invites: { token: string }[] };
    inviteLink = `/invite/${json.invites[0].token}`;
    expect(inviteLink.length).toBeGreaterThan(20);
  });

  test("invitee signs up through the link, lands in the workspace as agent, and is blocked from owner actions", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(inviteLink);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Join Team Co");
    await page.getByRole("link", { name: "Create an account and join" }).click();
    await expect(page).toHaveURL(/\/signup\?invite=/);
    await expect(page.getByLabel("Company or project name")).toHaveCount(0);
    await page.getByLabel("Your name").fill("Agent Person");
    await expect(page.getByLabel("Email")).toHaveValue(agentEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account and join" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team Co");
    await expect(page.getByRole("complementary").getByText("agent", { exact: true })).toBeVisible();

    // Agent cannot add sources or change settings.
    const src = await page.request.post("/api/sources", { data: { kind: "text", name: "x", text: "some text that is long enough to count" } });
    expect(src.status()).toBe(403);
    const ws = await page.request.patch("/api/workspace", { data: { toolsEnabled: true } });
    expect(ws.status()).toBe(403);
    const invite = await page.request.post("/api/team", { data: { email: "x@example.com" } });
    expect(invite.status()).toBe(403);

    // Used link no longer works.
    await page.goto(inviteLink);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This invite is not valid");
    await ctx.close();
  });

  test("owner sees the new member, and the agent cannot reach another workspace's data", async ({ page, browser }) => {
    await login(page, ownerEmail);
    await page.goto("/dashboard/settings");
    await expect(page.getByText(agentEmail)).toBeVisible();
    await expect(page.getByText("agent", { exact: true })).toBeVisible();

    // Another workspace entirely.
    const other = await browser.newContext();
    const op = await other.newPage();
    await op.goto("/signup");
    await op.getByLabel("Your name").fill("Other Owner");
    await op.getByLabel("Company or project name").fill("Other Co");
    await op.getByLabel("Email").fill(`e2e-other-${stamp}@example.com`);
    await op.getByLabel("Password").fill(password);
    await op.getByRole("button", { name: "Create workspace" }).click();
    await expect(op).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    const list = await op.request.get("/api/team");
    const members = ((await list.json()) as { members: { email: string }[] }).members.map((m) => m.email);
    expect(members).not.toContain(agentEmail);
    await other.close();
  });

  test("login is rate limited after repeated failures", async ({ page }) => {
    const victim = `e2e-bruteforce-${stamp}@example.com`;
    for (let i = 0; i < 10; i++) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(victim);
      await page.getByLabel("Password").fill(`wrong-${i}-password`);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.locator("form").getByRole("alert")).toBeVisible();
    }
    await page.getByLabel("Password").fill("one-more-attempt");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(/Too many attempts/);
  });
});
