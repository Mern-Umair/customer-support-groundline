import type { Db } from "mongodb";
import type { ChunkDoc, ConversationDoc, EvalCaseDoc, EvalRunDoc, MembershipDoc, MessageDoc, PageDoc, PendingActionDoc, SourceDoc, UserDoc, WorkspaceDoc } from "./types";

export const COLLECTIONS = {
  users: "users",
  workspaces: "workspaces",
  memberships: "memberships",
  sources: "sources",
  pages: "pages",
  chunks: "chunks",
  conversations: "conversations",
  messages: "messages",
  evalCases: "eval_cases",
  evalRuns: "eval_runs",
  pendingActions: "pending_actions",
} as const;

export const pendingActions = (db: Db) => db.collection<PendingActionDoc>(COLLECTIONS.pendingActions);

export const conversations = (db: Db) => db.collection<ConversationDoc>(COLLECTIONS.conversations);
export const messages = (db: Db) => db.collection<MessageDoc>(COLLECTIONS.messages);
export const evalCases = (db: Db) => db.collection<EvalCaseDoc>(COLLECTIONS.evalCases);
export const evalRuns = (db: Db) => db.collection<EvalRunDoc>(COLLECTIONS.evalRuns);

export const users = (db: Db) => db.collection<UserDoc>(COLLECTIONS.users);
export const workspaces = (db: Db) => db.collection<WorkspaceDoc>(COLLECTIONS.workspaces);
export const memberships = (db: Db) => db.collection<MembershipDoc>(COLLECTIONS.memberships);
export const sources = (db: Db) => db.collection<SourceDoc>(COLLECTIONS.sources);
export const pages = (db: Db) => db.collection<PageDoc>(COLLECTIONS.pages);
export const chunks = (db: Db) => db.collection<ChunkDoc>(COLLECTIONS.chunks);
