import { expect, test } from "@playwright/test";
import { addTextSource, waitForRetrieval } from "./helpers";

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

  test("answers with a citation, shows cost/latency, stays AI-only, records feedback", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await addTextSource(page, "Warranty", "Every lamp from Lisbon Lamps comes with a two-year warranty covering electrical faults. Bulbs are excluded from the warranty. Claims are handled by email within two working days.");
    await waitForRetrieval(page, "how long is the warranty", /two-year warranty/);

    await page.goto("/dashboard/playground");
    const box = page.getByLabel("Message");
    await box.fill("How long is the warranty on a lamp?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("button", { name: "Answering…" })).toHaveCount(0, { timeout: 30_000 });

    await expect(page.getByText("[1] Warranty")).toBeVisible();
    await expect(page.getByText("two-year warranty").last()).toBeVisible();
    await expect(page.getByText(/\d+ ms/).last()).toBeVisible();
    await expect(page.getByText(/tokens/).last()).toBeVisible();

    await page.getByRole("button", { name: "Good answer" }).last().click();
    await expect(page.getByRole("button", { name: "Good answer" }).last()).toHaveAttribute("aria-pressed", "true");

    // Asking for a human in the playground does not hand off: the playground is AI-only.
    await box.fill("Can I talk to a human?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("button", { name: "Answering…" })).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(/bringing in a teammate/)).toHaveCount(0);
    await expect(page.getByTestId("live-indicator")).toHaveCount(0);
  });
});
