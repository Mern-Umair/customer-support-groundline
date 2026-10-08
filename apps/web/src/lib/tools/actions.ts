import { ObjectId, type Db } from "mongodb";
import { REALTIME_EVENTS, roomForWorkspace, type ActionPending } from "@groundline/shared";
import { conversations, messages, pendingActions } from "../db/collections";
import type { MessageDoc, PendingActionDoc } from "../db/types";
import { broadcastMessage } from "../chat/handoff";
import { emitRealtime } from "../realtime/server";
import { scoped } from "../tenant";
import { toolByName } from "./registry";
import type { ToolCall } from "./types";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/** Human-readable one-liner for a proposed call, used in notes and alerts. */
export function describeCall(call: ToolCall): string {
  const a = call.args as Record<string, unknown>;
  switch (call.name) {
    case "createTicket":
      return `Create a support ticket: ${String(a.subject ?? "").slice(0, 80) || "no subject"}`;
    case "bookAppointment":
      return `Book an appointment for ${String(a.name ?? "the visitor")} on ${String(a.date ?? "?")} at ${String(a.time ?? "?")}`;
    case "lookupOrder":
      return `Look up order ${String(a.orderNumber ?? "?")}`;
    default:
      return `${call.name}(${JSON.stringify(a).slice(0, 80)})`;
  }
}

/**
 * Runs a tool call on behalf of the assistant. Read-only tools execute now; side-effecting
 * tools are recorded as pending, the workspace is alerted, and the model is told to say so.
 * Returns the JSON string that goes back to the model as the tool result.
 */
export async function runOrDefer(db: Db, workspaceId: ObjectId, conversationId: ObjectId, call: ToolCall): Promise<{ result: string; pending: PendingActionDoc | null; summary: string }> {
  const tool = toolByName(call.name);
  if (!tool) return { result: JSON.stringify({ ok: false, summary: `Unknown tool ${call.name}` }), pending: null, summary: `Unknown tool ${call.name}` };
  const summary = describeCall(call);

  if (!tool.sideEffect) {
    const r = await tool.run({ db, workspaceId, conversationId }, call.args);
    return { result: JSON.stringify({ ok: r.ok, summary: r.summary, data: r.data }), pending: null, summary: r.summary };
  }

  const doc: PendingActionDoc = { _id: new ObjectId(), workspaceId, conversationId, tool: call.name, args: call.args, summary, status: "pending", requestedAt: new Date() };
  await pendingActions(db).insertOne(doc);
  const payload: ActionPending = { workspaceId: workspaceId.toHexString(), conversationId: conversationId.toHexString(), actionId: doc._id.toHexString(), tool: call.name, summary, requestedAt: doc.requestedAt.toISOString() };
  await emitRealtime(roomForWorkspace(payload.workspaceId), REALTIME_EVENTS.actionPending, payload);
  return { result: JSON.stringify({ status: "pending_approval", summary }), pending: doc, summary };
}

/** Owner decision. Approve executes the tool; both outcomes leave a system note in the thread. */
export async function decideAction(db: Db, workspaceId: ObjectId, actionId: ObjectId, decision: "approve" | "reject", agent: { id: ObjectId; name: string }): Promise<PendingActionDoc> {
  const action = await pendingActions(db).findOne(scoped(workspaceId, { _id: actionId }));
  if (!action) throw new ActionError("Action not found");
  if (action.status !== "pending") throw new ActionError("This action was already decided");

  let note: string;
  let status: PendingActionDoc["status"];
  let result: PendingActionDoc["result"];
  if (decision === "reject") {
    status = "rejected";
    note = `The team declined: ${action.summary}.`;
  } else {
    const tool = toolByName(action.tool);
    if (!tool) throw new ActionError("Tool no longer exists");
    const r = await tool.run({ db, workspaceId, conversationId: action.conversationId }, action.args);
    result = { ok: r.ok, summary: r.summary, data: r.data };
    status = r.ok ? "approved" : "failed";
    note = r.ok ? `Done, approved by ${agent.name}: ${r.summary}.` : `The team tried to ${action.summary.toLowerCase()} but it failed: ${r.summary}.`;
  }

  await pendingActions(db).updateOne(scoped(workspaceId, { _id: actionId }), { $set: { status, decidedAt: new Date(), decidedBy: agent.id, ...(result ? { result } : {}) } });
  const msg: MessageDoc = { _id: new ObjectId(), workspaceId, conversationId: action.conversationId, role: "system", content: note, createdAt: new Date() };
  await messages(db).insertOne(msg);
  await conversations(db).updateOne(scoped(workspaceId, { _id: action.conversationId }), { $set: { lastMessageAt: msg.createdAt }, $inc: { messageCount: 1 } });
  await broadcastMessage(msg);
  return (await pendingActions(db).findOne(scoped(workspaceId, { _id: actionId })))!;
}
