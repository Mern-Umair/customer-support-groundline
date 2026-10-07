import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "../db";
import { memberships, users, workspaces } from "../db/collections";
import type { MembershipRole, UserDoc, WorkspaceDoc } from "../db/types";
import { readSession } from "./session";

export interface Session {
  userId: ObjectId;
  workspaceId: ObjectId;
}

/** Redirects to /login when there is no valid session. Memoised per request. */
export const verifySession = cache(async (): Promise<Session> => {
  const payload = await readSession();
  if (!payload || !ObjectId.isValid(payload.userId) || !ObjectId.isValid(payload.workspaceId)) {
    redirect("/login");
  }
  return { userId: new ObjectId(payload.userId), workspaceId: new ObjectId(payload.workspaceId) };
});

export interface CurrentContext {
  user: Pick<UserDoc, "_id" | "email" | "name">;
  workspace: Pick<WorkspaceDoc, "_id" | "name" | "slug" | "publicKey" | "plan" | "createdAt">;
  role: MembershipRole;
}

/** Loads user + workspace and verifies the membership really exists. */
export const getCurrentContext = cache(async (): Promise<CurrentContext> => {
  const session = await verifySession();
  const db = await getDb();
  const [user, workspace, membership] = await Promise.all([
    users(db).findOne({ _id: session.userId }, { projection: { _id: 1, email: 1, name: 1 } }),
    workspaces(db).findOne(
      { _id: session.workspaceId },
      { projection: { _id: 1, name: 1, slug: 1, publicKey: 1, plan: 1, createdAt: 1 } },
    ),
    memberships(db).findOne({ userId: session.userId, workspaceId: session.workspaceId }),
  ]);
  if (!user || !workspace || !membership) redirect("/login");
  return { user, workspace, role: membership.role };
});
