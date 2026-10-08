"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token, signedInAs }: { token: string; signedInAs: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setError(((await res.json()) as { error?: string }).error ?? "Could not join");
    setBusy(false);
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-fg-muted">
        Signed in as <span className="font-medium text-fg">{signedInAs}</span>.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <Button className="mt-4 w-full" onClick={accept} disabled={busy}>
        {busy ? "Joining…" : "Join workspace"}
      </Button>
    </div>
  );
}
