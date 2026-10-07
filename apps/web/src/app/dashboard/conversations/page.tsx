import { EmptyState } from "@/components/ui/card";

export default function ConversationsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
      <p className="mt-1 text-sm text-fg-muted">Live and past chats from your widget.</p>
      <div className="mt-8">
        <EmptyState title="No conversations yet" body="Once the widget is installed, every visitor chat appears here with its AI / human status and cost." />
      </div>
    </div>
  );
}
