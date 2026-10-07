import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create a workspace · Groundline" };

export default function SignupPage() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-1 text-sm text-zinc-600">Free plan. No credit card.</p>
      <SignupForm />
      <p className="mt-6 text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
