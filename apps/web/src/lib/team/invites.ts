import { randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { PLAN_LIMITS, type PlanId } from "@groundline/shared";
import { invites, memberships, workspaces } from "../db/collections";
import type { InviteDoc, MembershipRole } from "../db/types";
import { scoped } from "../tenant";

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

export class TeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamError";
  }
}

export async function seatUsage(db: Db, workspaceId: ObjectId, plan: PlanId): Promise<{ used: number; pendingInvites: number; max: number }> {
  const [used, pendingInvites] = await Promise.all([
    memberships(db).countDocuments({ workspaceId }),
    invites(db).countDocuments(scoped(workspaceId, { acceptedAt: { $exists: false }, expiresAt: { $gt: new Date() } })),
  ]);
  return { used, pendingInvites, max: PLAN_LIMITS[plan].maxSeats };
}

/** Owner creates an invite link. Seats = members + open invites, capped by the plan. */
export async function createInvite(db: Db, workspaceId: ObjectId, plan: PlanId, invitedBy: ObjectId, email: string, role: MembershipRole): Promise<InviteDoc> {
  const normalized = email.trim().toLowerCase();
  const seats = await seatUsage(db, workspaceId, plan);
  if (seats.used + seats.pendingInvites >= seats.max) throw new TeamError(`Your plan allows ${seats.max} seats. Upgrade to invite more people.`);
  const existingMember = await memberships(db).aggregate([{ $match: { workspaceId } }, { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }, { $match: { "user.email": normalized } }, { $limit: 1 }]).next();
  if (existingMember) throw new TeamError("That person is already a member.");
  const doc: InviteDoc = {
    _id: new ObjectId(),
    workspaceId,
    token: randomBytes(24).toString("base64url"),
    email: normalized,
    role,
    invitedBy,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
  await invites(db).insertOne(doc);
  return doc;
}

export async function findOpenInvite(db: Db, token: string): Promise<(InviteDoc & { workspaceName: string }) | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const invite = await invites(db).findOne({ token, acceptedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!invite) return null;
  const ws = await workspaces(db).findOne({ _id: invite.workspaceId }, { projection: { name: 1 } });
  if (!ws) return null;
  return { ...invite, workspaceName: ws.name };
}

/** Accepts an invite for a signed-in user: creates the membership and marks the invite used. */
export async function acceptInvite(db: Db, token: string, userId: ObjectId): Promise<{ workspaceId: ObjectId; role: MembershipRole }> {
  const invite = await findOpenInvite(db, token);
  if (!invite) throw new TeamError("This invite link is invalid or has expired.");
  const claimed = await invites(db).updateOne({ _id: invite._id, acceptedAt: { $exists: false } }, { $set: { acceptedAt: new Date(), acceptedBy: userId } });
  if (claimed.matchedCount === 0) throw new TeamError("This invite was already used.");
  const existing = await memberships(db).findOne({ userId, workspaceId: invite.workspaceId });
  if (!existing) {
    await memberships(db).insertOne({ _id: new ObjectId(), userId, workspaceId: invite.workspaceId, role: invite.role, createdAt: new Date() });
  }
  return { workspaceId: invite.workspaceId, role: existing?.role ?? invite.role };
}

export async function revokeInvite(db: Db, workspaceId: ObjectId, inviteId: ObjectId): Promise<boolean> {
  const res = await invites(db).deleteOne(scoped(workspaceId, { _id: inviteId, acceptedAt: { $exists: false } }));
  return res.deletedCount === 1;
}

/** Owner removes a member (never themselves, never the last owner). */
export async function removeMember(db: Db, workspaceId: ObjectId, actorId: ObjectId, userId: ObjectId): Promise<boolean> {
  if (actorId.equals(userId)) throw new TeamError("You cannot remove yourself.");
  const target = await memberships(db).findOne({ workspaceId, userId });
  if (!target) return false;
  if (target.role === "owner") {
    const owners = await memberships(db).countDocuments({ workspaceId, role: "owner" });
    if (owners <= 1) throw new TeamError("A workspace needs at least one owner.");
  }
  const res = await memberships(db).deleteOne({ workspaceId, userId });
  return res.deletedCount === 1;
}

export async function listTeam(db: Db, workspaceId: ObjectId) {
  const members = await memberships(db)
    .aggregate<{ userId: ObjectId; role: MembershipRole; createdAt: Date; user: { name: string; email: string }[] }>([
      { $match: { workspaceId } },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user", pipeline: [{ $project: { name: 1, email: 1 } }] } },
      { $sort: { createdAt: 1 } },
    ])
    .toArray();
  const open = await invites(db).find(scoped(workspaceId, { acceptedAt: { $exists: false }, expiresAt: { $gt: new Date() } }), { sort: { createdAt: -1 } }).toArray();
  return {
    members: members.map((m) => ({ userId: m.userId.toHexString(), role: m.role, name: m.user[0]?.name ?? "", email: m.user[0]?.email ?? "", joinedAt: m.createdAt.toISOString() })),
    invites: open.map((i) => ({ id: i._id.toHexString(), email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt.toISOString() })),
  };
}
