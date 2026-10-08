import { z } from "zod";

/**
 * Contract between the web app, the realtime (Socket.io) server, the dashboard and the widget.
 * Every payload is validated with these schemas on receipt.
 */

export const ConversationId = z.string().min(1);
export const WorkspaceId = z.string().min(1);

export const MessageRole = z.enum(["visitor", "assistant", "agent", "system"]);
export type MessageRole = z.infer<typeof MessageRole>;

/** A message as broadcast to rooms (no embeddings, no internals). */
export const LiveMessage = z.object({
  id: z.string().min(1),
  conversationId: ConversationId,
  workspaceId: WorkspaceId,
  role: MessageRole,
  content: z.string(),
  createdAt: z.string(),
});
export type LiveMessage = z.infer<typeof LiveMessage>;

export const HandoffReason = z.enum(["low_confidence", "visitor_asked", "tool_needs_approval"]);
export type HandoffReason = z.infer<typeof HandoffReason>;

/** Sent to the workspace room when a conversation needs a human. */
export const HandoffRequested = z.object({
  workspaceId: WorkspaceId,
  conversationId: ConversationId,
  reason: HandoffReason,
  title: z.string(),
  lastVisitorMessage: z.string(),
  requestedAt: z.string(),
});
export type HandoffRequested = z.infer<typeof HandoffRequested>;

/** Sent to the workspace room when the assistant proposes a side-effecting tool call. */
export const ActionPending = z.object({
  workspaceId: WorkspaceId,
  conversationId: ConversationId,
  actionId: z.string().min(1),
  tool: z.string(),
  summary: z.string(),
  requestedAt: z.string(),
});
export type ActionPending = z.infer<typeof ActionPending>;

export const ConversationStatus = z.enum(["ai", "human", "closed"]);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const StatusChanged = z.object({
  workspaceId: WorkspaceId,
  conversationId: ConversationId,
  status: ConversationStatus,
  agentName: z.string().optional(),
});
export type StatusChanged = z.infer<typeof StatusChanged>;

/** JWT payloads the web app signs for socket clients (verified by the realtime server). */
export const RealtimeTokenPayload = z.discriminatedUnion("role", [
  z.object({ role: z.literal("agent"), workspaceId: WorkspaceId, userId: z.string(), name: z.string() }),
  z.object({ role: z.literal("visitor"), workspaceId: WorkspaceId, conversationId: ConversationId }),
]);
export type RealtimeTokenPayload = z.infer<typeof RealtimeTokenPayload>;

/** Body of the server-to-server emit call (web app → realtime server). */
export const EmitRequest = z.object({
  room: z.string().min(1),
  event: z.string().min(1),
  payload: z.unknown(),
});
export type EmitRequest = z.infer<typeof EmitRequest>;

export const REALTIME_EVENTS = {
  /** server → dashboard (workspace room) */
  handoffRequested: "handoff:requested",
  /** server → conversation room and workspace room */
  message: "conversation:message",
  /** server → conversation room and workspace room */
  statusChanged: "conversation:status",
  /** server → workspace room: a tool call awaits approval */
  actionPending: "action:pending",
  /** dashboard → server: subscribe to a conversation room (same workspace only) */
  join: "conversation:join",
  leave: "conversation:leave",
} as const;

export const roomForWorkspace = (workspaceId: string) => `workspace:${workspaceId}`;
export const roomForConversation = (workspaceId: string, conversationId: string) => `conversation:${workspaceId}:${conversationId}`;
