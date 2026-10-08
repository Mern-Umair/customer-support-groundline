"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-mono text-sm text-fg-subtle">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">We hit an error</h1>
      <p className="mt-2 text-sm text-fg-muted">
        It has been logged{error.digest ? ` (ref ${error.digest})` : ""}. Try again, or go back to the dashboard.
      </p>
      <div className="mt-6 flex gap-2">
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/dashboard" variant="secondary" size="sm">
          Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
