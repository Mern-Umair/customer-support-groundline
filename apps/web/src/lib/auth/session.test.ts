import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars-long";
  process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://unused";
});

describe("session tokens", () => {
  it("round-trips a payload", async () => {
    const { encryptSession, decryptSession } = await import("./session");
    const token = await encryptSession({ userId: "u1", workspaceId: "w1" });
    expect(await decryptSession(token)).toEqual({ userId: "u1", workspaceId: "w1" });
  });

  it("rejects a tampered token", async () => {
    const { encryptSession, decryptSession } = await import("./session");
    const token = await encryptSession({ userId: "u1", workspaceId: "w1" });
    const [h, p, s] = token.split(".");
    const tampered = `${h}.${p}.${s.slice(0, -2)}xx`;
    expect(await decryptSession(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { encryptSession, decryptSession } = await import("./session");
    const token = await encryptSession({ userId: "u1", workspaceId: "w1" }, -10);
    expect(await decryptSession(token)).toBeNull();
  });

  it("returns null for missing or garbage input", async () => {
    const { decryptSession } = await import("./session");
    expect(await decryptSession(undefined)).toBeNull();
    expect(await decryptSession("not.a.jwt")).toBeNull();
  });
});
