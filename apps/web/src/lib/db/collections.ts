import type { Db } from "mongodb";
import type { MembershipDoc, UserDoc, WorkspaceDoc } from "./types";

export const COLLECTIONS = {
  users: "users",
  workspaces: "workspaces",
  memberships: "memberships",
} as const;

export const users = (db: Db) => db.collection<UserDoc>(COLLECTIONS.users);
export const workspaces = (db: Db) => db.collection<WorkspaceDoc>(COLLECTIONS.workspaces);
export const memberships = (db: Db) => db.collection<MembershipDoc>(COLLECTIONS.memberships);
