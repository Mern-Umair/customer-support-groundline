import { defineConfig, devices } from "@playwright/test";

// The e2e servers run against the TEST database, never the main one.
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
const REALTIME_PORT = 4100;
const AUTH_SECRET = process.env.AUTH_SECRET ?? "e2e-secret-at-least-16-chars-long";
const REALTIME_SECRET = "e2e-realtime-secret";

// A production build is used so e2e exercises the same code path as Vercel, and so it can
// run while `next dev` is open in another terminal (Next 16 allows one dev server per project).
const webEnv = {
  MONGODB_URI: testDbUri,
  AUTH_SECRET,
  // No GEMINI_API_KEY on purpose: e2e uses the deterministic offline embedder and provider.
  GEMINI_API_KEY: "",
  GROQ_API_KEY: "",
  REALTIME_URL: `http://localhost:${REALTIME_PORT}`,
  REALTIME_SECRET,
  NEXT_PUBLIC_REALTIME_URL: `http://localhost:${REALTIME_PORT}`,
};

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
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
  webServer: [
    {
      command: "node src/index.ts",
      cwd: "../realtime",
      url: `http://localhost:${REALTIME_PORT}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: String(REALTIME_PORT), AUTH_SECRET, REALTIME_SECRET, ALLOWED_ORIGINS: `http://localhost:${PORT}` },
    },
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: webEnv,
    },
  ],
});
