import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Load apps/web/.env.local so integration tests can reach the test database.
// Tests always use MONGODB_URI_TEST (a separate database) and never the main one.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (e.g. CI): rely on real environment variables */
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    env: {
      MONGODB_URI: process.env.MONGODB_URI_TEST ?? "",
      AUTH_SECRET: "vitest-secret-at-least-16-chars",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
});
