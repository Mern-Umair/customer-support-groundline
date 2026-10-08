import type { Db, ObjectId } from "mongodb";
import { REALTIME_EVENTS, roomForConversation, roomForWorkspace, type HandoffReason, type LiveMessage, type StatusChanged } from "@groundline/shared";
import { conversations } from "../db/collections";
import type { ConversationDoc, ConversationStatus, MessageDoc } from "../db/types";
import { emitRealtime } from "../realtime/server";
import { scoped } from "../tenant";

/**
 * "Can I talk to a person?" and friends. Deliberately narrow: false positives send a
 * visitor to a human who could have been answered by the assistant, which is the cheaper
 * failure, so the expression errs on the side of catching explicit requests only.
 */
const HUMAN_REQUEST = /\b(talk|speak|chat|connect|put me|get me|transfer)\b[^.?!]{0,30}\b(human|person|agent|someone|somebody|representative|operator|support team|staff|real person)\b|\b(real|live|actual) (person|human|agent)\b|\bhuman\b[^.?!]{0,10}\bplease\b|\bnot a bot\b/i;

export function wantsHuman(text: string): boolean {
  return HUMAN_REQUEST.test(text);
}

export function toLiveMessage(m: MessageDoc): LiveMessage {
  return {
    id: m._id.toHexString(),
    conversationId: m.conversationId.toHexString(),
    workspaceId: m.workspaceId.toHexString(),
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Pushes a stored message to the conversation room (visitor + joined agents) and the workspace room (lists). */
export async function broadcastMessage(m: MessageDoc): Promise<void> {
  const live = toLiveMessage(m);
  await Promise.all([
    emitRealtime(roomForConversation(live.workspaceId, live.conversationId), REALTIME_EVENTS.message, live),
    emitRealtime(roomForWorkspace(live.workspaceId), REALTIME_EVENTS.message, live),
  ]);
}

export async function broadcastStatus(workspaceId: ObjectId, conversationId: ObjectId, status: ConversationStatus, agentName?: string): Promise<void> {
  const payload: StatusChanged = { workspaceId: workspaceId.toHexString(), conversationId: conversationId.toHexString(), status, agentName };
  await Promise.all([
    emitRealtime(roomForConversation(payload.workspaceId, payload.conversationId), REALTIME_EVENTS.statusChanged, payload),
    emitRealtime(roomForWorkspace(payload.workspaceId), REALTIME_EVENTS.statusChanged, payload),
  ]);
}

/** Flags the conversation for a human and rings the workspace. Idempotent while already in human mode. */
export async function requestHandoff(db: Db, convo: ConversationDoc, reason: HandoffReason, lastVisitorMessage: string): Promise<boolean> {
  if (convo.status === "human") return false;
  const requestedAt = new Date();
  await conversations(db).updateOne(scoped(convo.workspaceId, { _id: convo._id }), {
    $set: { status: "human", handoff: { requestedAt, reason }, lastMessageAt: requestedAt },
  });
  const wsId = convo.workspaceId.toHexString();
  await emitRealtime(roomForWorkspace(wsId), REALTIME_EVENTS.handoffRequested, {
    workspaceId: wsId,
    conversationId: convo._id.toHexString(),
    reason,
    title: convo.title ?? "Conversation",
    lastVisitorMessage: lastVisitorMessage.slice(0, 200),
    requestedAt: requestedAt.toISOString(),
  });
  await broadcastStatus(convo.workspaceId, convo._id, "human");
  return true;
}

/** Agent takes over, hands back to the assistant, or closes. */
export async function setConversationStatus(db: Db, workspaceId: ObjectId, conversationId: ObjectId, status: ConversationStatus, agent?: { id: ObjectId; name: string }): Promise<boolean> {
  const update: Record<string, unknown> = { status, lastMessageAt: new Date() };
  if (status === "human" && agent) {
    update["handoff.agentId"] = agent.id;
    update["handoff.takenAt"] = new Date();
  }
  const res = await conversations(db).updateOne(scoped(workspaceId, { _id: conversationId }), [
    { $set: { ...update, handoff: { $ifNull: ["$handoff", { requestedAt: new Date(), reason: "visitor_asked" }] } } },
    ...(status === "human" && agent ? [{ $set: { "handoff.agentId": agent.id, "handoff.takenAt": new Date() } }] : []),
  ]);
  if (res.matchedCount === 0) return false;
  await broadcastStatus(workspaceId, conversationId, status, agent?.name);
  return true;
}
