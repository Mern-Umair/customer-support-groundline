import { z } from "zod";

/**
 * Events exchanged over Socket.io between the widget, the dashboard and the
 * realtime server. Every payload is validated with these schemas on receipt.
 */

export const ConversationId = z.string().min(1);
export const TenantId = z.string().min(1);

export const MessageRole = z.enum(["visitor", "assistant", "agent", "system"]);
export type MessageRole = z.infer<typeof MessageRole>;

export const ChatMessage = z.object({
  id: z.string().min(1),
  conversationId: ConversationId,
  tenantId: TenantId,
  role: MessageRole,
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

/** Emitted by the web API when the AI gives up and a human is needed. */
export const HandoffRequested = z.object({
  tenantId: TenantId,
  conversationId: ConversationId,
  reason: z.enum(["low_confidence", "visitor_asked", "tool_needs_approval"]),
  lastVisitorMessage: z.string(),
  requestedAt: z.string().datetime(),
});
export type HandoffRequested = z.infer<typeof HandoffRequested>;

export const REALTIME_EVENTS = {
  /** server -> dashboard */
  handoffRequested: "handoff:requested",
  /** both directions: a new message in a conversation room */
  message: "conversation:message",
  /** dashboard -> server: agent takes the conversation */
  agentJoined: "conversation:agent_joined",
  /** dashboard -> server: agent hands back to AI */
  agentLeft: "conversation:agent_left",
} as const;

export const roomForTenant = (tenantId: string) => `tenant:${tenantId}`;
export const roomForConversation = (conversationId: string) =>
  `conversation:${conversationId}`;
