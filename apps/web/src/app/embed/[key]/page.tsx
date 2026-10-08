import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { findWorkspaceByPublicKey } from "@/lib/widget/public";
import { EmbedChat } from "./embed-chat";

export const metadata: Metadata = { title: "Support chat", robots: { index: false } };

/**
 * The page rendered inside the widget iframe on customers' sites. It is served from our
 * origin, so the host page cannot read or style it, and API calls stay same-origin.
 */
export default async function EmbedPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const db = await getDb();
  const ws = await findWorkspaceByPublicKey(db, key);

  if (!ws) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-fg-muted">
        This chat widget is not configured. Check the <code className="font-mono">data-key</code> on the script tag.
      </div>
    );
  }
  return <EmbedChat publicKey={ws.publicKey} workspaceName={ws.name} />;
}
