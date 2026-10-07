import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Groundline" };

export default function LoginPage() {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-fg-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
          Create a workspace
        </Link>
      </p>
    </Card>
  );
}
