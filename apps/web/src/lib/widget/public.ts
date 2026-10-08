import "server-only";
import type { Db } from "mongodb";
import { PLAN_LIMITS } from "@groundline/shared";
import { messages, workspaces } from "../db/collections";
import type { WorkspaceDoc } from "../db/types";
import { checkRateLimit } from "../ratelimit";
import { scoped } from "../tenant";

export type PublicWorkspace = Pick<WorkspaceDoc, "_id" | "name" | "plan" | "publicKey">;

const KEY_RE = /^wk_[0-9a-f]{32}$/;

/** Resolves a widget public key to its workspace. Keys are public; they only select a tenant. */
export async function findWorkspaceByPublicKey(db: Db, key: string): Promise<PublicWorkspace | null> {
  if (!KEY_RE.test(key)) return null;
  return workspaces(db).findOne({ publicKey: key }, { projection: { _id: 1, name: 1, plan: 1, publicKey: 1 } });
}

export type Gate = { ok: true } | { ok: false; status: 429; message: string };

/**
 * Abuse and quota gates for the public chat endpoint:
 *  - per visitor: 10 messages / minute
 *  - per workspace: 120 messages / minute
 *  - per workspace: plan's monthly message quota (counts assistant replies this calendar month)
 */
export async function gatePublicChat(db: Db, ws: PublicWorkspace, visitorId: string): Promise<Gate> {
  const [visitor, workspace] = await Promise.all([
    checkRateLimit(db, `visitor:${ws._id.toHexString()}:${visitorId}`, 10, 60),
    checkRateLimit(db, `workspace:${ws._id.toHexString()}`, 120, 60),
  ]);
  if (!visitor.allowed) return { ok: false, status: 429, message: "You are sending messages too quickly. Please wait a moment." };
  if (!workspace.allowed) return { ok: false, status: 429, message: "This assistant is busy right now. Please try again in a minute." };

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const used = await messages(db).countDocuments(scoped(ws._id, { role: "assistant", createdAt: { $gte: monthStart } }));
  if (used >= PLAN_LIMITS[ws.plan].maxMessagesPerMonth) {
    return { ok: false, status: 429, message: "This assistant has reached its monthly message limit." };
  }
  return { ok: true };
}
