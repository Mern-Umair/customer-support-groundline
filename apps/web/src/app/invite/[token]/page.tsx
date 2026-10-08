import type { Metadata } from "next";
import Link from "next/link";
import { getApiContext } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { findOpenInvite } from "@/lib/team/invites";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Join a workspace · Groundline", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [invite, ctx] = await Promise.all([findOpenInvite(db, token), getApiContext()]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-5">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <Card className="p-8">
          {!invite ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">This invite is not valid</h1>
              <p className="mt-2 text-sm text-fg-muted">The link may have expired (invites last 7 days) or already been used. Ask the workspace owner for a new one.</p>
              <div className="mt-6">
                <ButtonLink href="/" variant="secondary" size="sm">
                  Back to Groundline
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Join {invite.workspaceName}</h1>
              <p className="mt-2 text-sm text-fg-muted">
                You were invited as <span className="font-medium text-fg">{invite.role}</span> ({invite.email}).
              </p>
              {ctx ? (
                <AcceptInvite token={token} signedInAs={ctx.user.email} />
              ) : (
                <div className="mt-6 flex flex-col gap-2">
                  <ButtonLink href={`/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.email)}`}>Create an account and join</ButtonLink>
                  <ButtonLink href={`/login?invite=${encodeURIComponent(token)}`} variant="secondary">
                    I already have an account
                  </ButtonLink>
                  <p className="mt-2 text-xs text-fg-subtle">
                    Not you? <Link href="/" className="underline-offset-4 hover:underline">Ignore this link.</Link>
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
