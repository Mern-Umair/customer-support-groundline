"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { Card } from "@/components/ui/card";

export function Playground() {
  return (
    <Card className="h-[min(70vh,640px)]">
      <ChatPanel
        send={(message, conversationId) => ({ url: "/api/chat", body: { message, conversationId } })}
        feedback={(messageId, vote) => ({ url: `/api/messages/${messageId}/feedback`, body: { vote } })}
        showDiagnostics
        emptyHint="Try: “What is your return policy?” or something your documents don’t cover, to see the refusal."
      />
    </Card>
  );
}
