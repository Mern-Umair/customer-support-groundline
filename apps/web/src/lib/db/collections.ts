import type { Db } from "mongodb";
import type { ChunkDoc, ConversationDoc, MembershipDoc, MessageDoc, PageDoc, SourceDoc, UserDoc, WorkspaceDoc } from "./types";

export const COLLECTIONS = {
  users: "users",
  workspaces: "workspaces",
  memberships: "memberships",
  sources: "sources",
  pages: "pages",
  chunks: "chunks",
  conversations: "conversations",
  messages: "messages",
} as const;

export const conversations = (db: Db) => db.collection<ConversationDoc>(COLLECTIONS.conversations);
export const messages = (db: Db) => db.collection<MessageDoc>(COLLECTIONS.messages);

export const users = (db: Db) => db.collection<UserDoc>(COLLECTIONS.users);
export const workspaces = (db: Db) => db.collection<WorkspaceDoc>(COLLECTIONS.workspaces);
export const memberships = (db: Db) => db.collection<MembershipDoc>(COLLECTIONS.memberships);
export const sources = (db: Db) => db.collection<SourceDoc>(COLLECTIONS.sources);
export const pages = (db: Db) => db.collection<PageDoc>(COLLECTIONS.pages);
export const chunks = (db: Db) => db.collection<ChunkDoc>(COLLECTIONS.chunks);
