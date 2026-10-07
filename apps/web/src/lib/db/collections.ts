import type { Db } from "mongodb";
import type { ChunkDoc, MembershipDoc, PageDoc, SourceDoc, UserDoc, WorkspaceDoc } from "./types";

export const COLLECTIONS = {
  users: "users",
  workspaces: "workspaces",
  memberships: "memberships",
  sources: "sources",
  pages: "pages",
  chunks: "chunks",
} as const;

export const users = (db: Db) => db.collection<UserDoc>(COLLECTIONS.users);
export const workspaces = (db: Db) => db.collection<WorkspaceDoc>(COLLECTIONS.workspaces);
export const memberships = (db: Db) => db.collection<MembershipDoc>(COLLECTIONS.memberships);
export const sources = (db: Db) => db.collection<SourceDoc>(COLLECTIONS.sources);
export const pages = (db: Db) => db.collection<PageDoc>(COLLECTIONS.pages);
export const chunks = (db: Db) => db.collection<ChunkDoc>(COLLECTIONS.chunks);
