import { ObjectId } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("team invites (integration)", () => {
  const workspaceId = new ObjectId();
  const owner = new ObjectId();
  const invitee = new ObjectId();
  const stamp = Date.now();

  afterAll(async () => {
    const { getDb } = await import("../db");
    const { invites, memberships, users, workspaces } = await import("../db/collections");
    const db = await getDb();
    await Promise.all([invites(db).deleteMany({ workspaceId }), memberships(db).deleteMany({ workspaceId }), users(db).deleteMany({ _id: { $in: [owner, invitee] } }), workspaces(db).deleteMany({ _id: workspaceId })]);
  });

  it("creates, lists, accepts and enforces seats and single use", async () => {
    const { getDb } = await import("../db");
    const { memberships, users, workspaces } = await import("../db/collections");
    const { createInvite, findOpenInvite, acceptInvite, listTeam, removeMember, seatUsage } = await import("./invites");
    const db = await getDb();
    await users(db).insertMany([
      { _id: owner, email: `owner-${stamp}@example.com`, name: "Owner", passwordHash: "x", createdAt: new Date() },
      { _id: invitee, email: `agent-${stamp}@example.com`, name: "Agent", passwordHash: "x", createdAt: new Date() },
    ]);
    await workspaces(db).insertOne({ _id: workspaceId, name: "W", slug: `w-${stamp}`, publicKey: `wk_${stamp.toString(16).padStart(32, "0")}`, plan: "free", createdBy: owner, createdAt: new Date() });
    await memberships(db).insertOne({ _id: new ObjectId(), userId: owner, workspaceId, role: "owner", createdAt: new Date() });

    const inv = await createInvite(db, workspaceId, "free", owner, `Agent-${stamp}@Example.com`, "agent");
    expect(inv.email).toBe(`agent-${stamp}@example.com`);
    expect(inv.token).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect((await seatUsage(db, workspaceId, "free"))).toEqual({ used: 1, pendingInvites: 1, max: 2 });

    // Free plan: 2 seats = 1 member + 1 open invite → the next invite is refused.
    await expect(createInvite(db, workspaceId, "free", owner, "third@example.com", "agent")).rejects.toThrow(/allows 2 seats/);

    const open = await findOpenInvite(db, inv.token);
    expect(open?.workspaceName).toBe("W");
    expect(await findOpenInvite(db, "nope")).toBeNull();

    const accepted = await acceptInvite(db, inv.token, invitee);
    expect(accepted.role).toBe("agent");
    await expect(acceptInvite(db, inv.token, new ObjectId())).rejects.toThrow(/invalid|already used/);

    const team = await listTeam(db, workspaceId);
    expect(team.members.map((m) => m.role)).toEqual(["owner", "agent"]);
    expect(team.invites).toEqual([]);

    await expect(createInvite(db, workspaceId, "free", owner, `agent-${stamp}@example.com`, "agent")).rejects.toThrow(/already a member|allows 2 seats/);
    await expect(removeMember(db, workspaceId, owner, owner)).rejects.toThrow(/cannot remove yourself/);
    expect(await removeMember(db, workspaceId, owner, invitee)).toBe(true);
    expect((await listTeam(db, workspaceId)).members).toHaveLength(1);
  }, 30_000);
});
