import { defineConfig, devices } from "@playwright/test";

// The e2e server runs against the TEST database, never the main one.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI provides env vars directly */
}

const testDbUri = process.env.MONGODB_URI_TEST;
if (!testDbUri) {
  throw new Error("MONGODB_URI_TEST is required for e2e tests (set it in apps/web/.env.local or CI secrets)");
}

const PORT = 3100;

// A production build is used so e2e exercises the same code path as Vercel, and so it can
// run while `next dev` is open in another terminal (Next 16 allows one dev server per project).
const serverEnv = {
  MONGODB_URI: testDbUri,
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-at-least-16-chars-long",
  // No GEMINI_API_KEY on purpose: e2e uses the deterministic offline embedder.
  GEMINI_API_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // First request after boot opens the Atlas connection and creates indexes; allow for it.
  expect: { timeout: 20_000 },
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: serverEnv,
  },
});
