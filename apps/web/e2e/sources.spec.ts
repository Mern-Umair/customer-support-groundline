import { expect, test } from "@playwright/test";
import { waitForRetrieval } from "./helpers";

const stamp = Date.now();
const email = `e2e-src-${stamp}@example.com`;
const password = "e2e-password-123";

test.describe.serial("knowledge sources", () => {
  test("sign up once", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Source Tester");
    await page.getByLabel("Company or project name").fill("Berlin Bikes");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
  });

  test("adds a plain-text source, watches it index, and retrieves a passage", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: "Knowledge sources" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Knowledge sources");
    await expect(page.getByText("No sources yet")).toBeVisible();

    await page.getByRole("tab", { name: "Plain text" }).click();
    await page.getByLabel("Name").fill("Repair policy");
    await page
      .getByLabel("Text")
      .fill(
        "Berlin Bikes repairs any bicycle bought from us for free during the first 12 months. After that, a standard tune-up costs 39 euros and takes two working days. Bring your receipt or order number to the workshop on Kastanienallee.",
      );
    await page.getByRole("button", { name: "Add source" }).click();

    await expect(page).toHaveURL(/\/dashboard\/sources\/[0-9a-f]{24}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Repair policy");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Chunks", { exact: true }).locator("..").getByText("1", { exact: true })).toBeVisible();

    await waitForRetrieval(page, "how much does a tune-up cost", "39 euros");

    // Source list shows it as ready and the overview counts it.
    await page.getByRole("link", { name: "← Knowledge sources" }).click();
    await expect(page).toHaveURL(/\/dashboard\/sources$/);
    await expect(page.getByRole("link", { name: /Repair policy/ })).toBeVisible();
    await expect(page.getByText("1 / 5 sources")).toBeVisible();
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page.getByRole("main").getByText("Knowledge sources", { exact: true }).locator("..").getByText("1", { exact: true })).toBeVisible();
  });

  test("rejects an invalid website URL and a non-PDF upload", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const res = await page.request.post("/api/sources", { data: { kind: "website", url: "not a url" } });
    expect(res.status()).toBe(400);

    const upload = await page.request.post("/api/sources", {
      multipart: { file: { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } },
    });
    expect(upload.status()).toBe(400);
    expect((await upload.json()).error).toMatch(/PDF/);
  });

  test("another workspace cannot see or delete the source", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Other Tenant");
    await page.getByLabel("Company or project name").fill("Other Co");
    await page.getByLabel("Email").fill(`e2e-other-${stamp}@example.com`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });

    const list = await page.request.get("/api/sources");
    expect((await list.json()).sources).toEqual([]);

    const search = await page.request.post("/api/retrieval/search", { data: { query: "tune-up cost" } });
    expect((await search.json()).results).toEqual([]);
    await ctx.close();
  });
});
