/**
 * Integration test against the test database (MONGODB_URI_TEST). Skipped when not configured.
 */
import { describe, expect, it, afterAll } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("auth service (integration)", () => {
  const stamp = Date.now();
  const email = `test-${stamp}@example.com`;

  afterAll(async () => {
    const { getDb } = await import("../db");
    const { users, workspaces, memberships } = await import("../db/collections");
    const db = await getDb();
    const user = await users(db).findOne({ email });
    if (user) {
      const ms = await memberships(db).find({ userId: user._id }).toArray();
      await workspaces(db).deleteMany({ _id: { $in: ms.map((m) => m.workspaceId) } });
      await memberships(db).deleteMany({ userId: user._id });
      await users(db).deleteOne({ _id: user._id });
    }
  });

  it("signs up, creates a workspace with an owner membership, then signs in", async () => {
    const { signUp, signIn } = await import("./service");
    const { getDb } = await import("../db");
    const { workspaces, memberships } = await import("../db/collections");
    const { ObjectId } = await import("mongodb");

    const created = await signUp({
      name: "Test User",
      email: email.toUpperCase(), // must be normalised
      password: "hunter2hunter2",
      workspaceName: "Ali Shoes",
    });
    expect(created.userId).toMatch(/^[0-9a-f]{24}$/);

    const db = await getDb();
    const ws = await workspaces(db).findOne({ _id: new ObjectId(created.workspaceId) });
    expect(ws?.name).toBe("Ali Shoes");
    expect(ws?.slug).toMatch(/^ali-shoes-[0-9a-f]{6}$/);
    expect(ws?.publicKey).toMatch(/^wk_[0-9a-f]{32}$/);
    expect(ws?.plan).toBe("free");

    const m = await memberships(db).findOne({ userId: new ObjectId(created.userId) });
    expect(m?.role).toBe("owner");

    const signedIn = await signIn(email, "hunter2hunter2");
    expect(signedIn).toEqual(created);
  }, 30_000);

  it("rejects a duplicate email", async () => {
    const { signUp } = await import("./service");
    await expect(
      signUp({ name: "Dup", email, password: "hunter2hunter2", workspaceName: "Dup" }),
    ).rejects.toMatchObject({ code: "email_taken" });
  }, 30_000);

  it("rejects a wrong password and an unknown email the same way", async () => {
    const { signIn } = await import("./service");
    await expect(signIn(email, "nope-nope-nope")).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(signIn(`nobody-${stamp}@example.com`, "whatever1234")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  }, 30_000);
});
