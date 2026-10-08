import { describe, expect, it } from "vitest";
import { HandoffRequested, LiveMessage, RealtimeTokenPayload, roomForConversation, roomForWorkspace } from "./realtime-events.ts";

describe("realtime event schemas", () => {
  it("accepts a valid live message", () => {
    const parsed = LiveMessage.safeParse({ id: "m1", conversationId: "c1", workspaceId: "w1", role: "visitor", content: "hi", createdAt: new Date().toISOString() });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const parsed = LiveMessage.safeParse({ id: "m1", conversationId: "c1", workspaceId: "w1", role: "hacker", content: "hi", createdAt: "x" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a handoff without a workspace", () => {
    const parsed = HandoffRequested.safeParse({ conversationId: "c1", reason: "low_confidence", title: "t", lastVisitorMessage: "where is my order", requestedAt: "x" });
    expect(parsed.success).toBe(false);
  });

  it("discriminates token payloads by role", () => {
    expect(RealtimeTokenPayload.safeParse({ role: "agent", workspaceId: "w", userId: "u", name: "Sara" }).success).toBe(true);
    expect(RealtimeTokenPayload.safeParse({ role: "visitor", workspaceId: "w", conversationId: "c" }).success).toBe(true);
    expect(RealtimeTokenPayload.safeParse({ role: "visitor", workspaceId: "w" }).success).toBe(false);
  });

  it("builds namespaced room names", () => {
    expect(roomForWorkspace("w1")).toBe("workspace:w1");
    expect(roomForConversation("w1", "c1")).toBe("conversation:w1:c1");
  });
});
