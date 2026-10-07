import { expect, test } from "@playwright/test";

const stamp = Date.now();
const email = `e2e-${stamp}@example.com`;
const password = "e2e-password-123";

test.describe.serial("authentication", () => {
  test("landing page links to signup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("only says what your docs say");
    await page.getByRole("link", { name: "Start free" }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("signup validates fields on the server", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("A");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
    await expect(page.getByText("Enter your company or project name")).toBeVisible();
    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  });

  test("signup creates a workspace and lands on the dashboard", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Company or project name").fill("Ali Shoes");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();

    // First dashboard hit in dev compiles the route and opens the DB connection.
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ali Shoes");
    await expect(page.getByText(/^wk_[0-9a-f]{32}$/)).toBeVisible();
  });

  test("duplicate email is rejected", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Again");
    await page.getByLabel("Company or project name").fill("Again Co");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByText("An account with this email already exists")).toBeVisible();
  });

  test("protected pages redirect to login when logged out", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("wrong password is rejected, right password logs in, logout works", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Log in" }).click();
    // Scope to the form: Next's route announcer also has role="alert".
    await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect");

    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/settings");
    await expect(page.getByRole("main").getByText(email)).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
