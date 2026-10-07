import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create a workspace · Groundline" };

export default function SignupPage() {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-1 text-sm text-fg-muted">Free plan. No credit card.</p>
      <SignupForm />
      <p className="mt-6 text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
