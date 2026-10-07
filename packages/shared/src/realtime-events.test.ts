import { describe, expect, it } from "vitest";
import { ChatMessage, HandoffRequested, roomForConversation, roomForTenant } from "./realtime-events.ts";

describe("realtime event schemas", () => {
  it("accepts a valid chat message", () => {
    const parsed = ChatMessage.safeParse({
      id: "m1",
      conversationId: "c1",
      tenantId: "t1",
      role: "visitor",
      content: "hi",
      createdAt: new Date().toISOString(),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const parsed = ChatMessage.safeParse({
      id: "m1",
      conversationId: "c1",
      tenantId: "t1",
      role: "hacker",
      content: "hi",
      createdAt: new Date().toISOString(),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a handoff without a tenant", () => {
    const parsed = HandoffRequested.safeParse({
      conversationId: "c1",
      reason: "low_confidence",
      lastVisitorMessage: "where is my order",
      requestedAt: new Date().toISOString(),
    });
    expect(parsed.success).toBe(false);
  });

  it("builds namespaced room names", () => {
    expect(roomForTenant("t1")).toBe("tenant:t1");
    expect(roomForConversation("c1")).toBe("conversation:c1");
  });
});
