import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Groundline" };

export default function LoginPage() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-zinc-600">
        New here?{" "}
        <Link href="/signup" className="font-medium text-zinc-900 underline">
          Create a workspace
        </Link>
      </p>
    </div>
  );
}
