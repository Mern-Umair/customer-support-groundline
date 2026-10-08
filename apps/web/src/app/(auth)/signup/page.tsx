import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create a workspace · Groundline" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string; email?: string }> }) {
  const { invite, email } = await searchParams;
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{invite ? "Create your account" : "Create your workspace"}</h1>
      <p className="mt-1 text-sm text-fg-muted">{invite ? "You will join the workspace you were invited to." : "Free plan. No credit card."}</p>
      <SignupForm invite={invite} inviteEmail={email} />
      <p className="mt-6 text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href={invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login"} className="font-medium text-accent underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
