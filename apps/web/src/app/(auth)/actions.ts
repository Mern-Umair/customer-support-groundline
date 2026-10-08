"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, signIn, signUp } from "@/lib/auth/service";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/ratelimit";

export interface FormState {
  errors?: Record<string, string[]>;
  message?: string;
  values?: Record<string, string>;
}

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  workspaceName: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  invite: z.string().trim().max(200).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  invite: z.string().trim().max(200).optional(),
});

function fieldValues(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/** Brute-force guard: 10 attempts per 5 minutes per email and per IP. */
async function loginAllowed(email: string): Promise<boolean> {
  const db = await getDb();
  const [byEmail, byIp] = await Promise.all([checkRateLimit(db, `login:email:${email}`, 10, 300), checkRateLimit(db, `login:ip:${await clientIp()}`, 30, 300)]);
  return byEmail.allowed && byIp.allowed;
}

export async function signupAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const values = fieldValues(formData, ["name", "workspaceName", "email", "invite"]);
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  const invite = values.invite.trim() || undefined;
  const errors: Record<string, string[]> = parsed.success ? {} : { ...z.flattenError(parsed.error).fieldErrors };
  if (!invite && !values.workspaceName.trim()) errors.workspaceName = ["Enter your company or project name"];
  if (!parsed.success || Object.keys(errors).length) {
    return { errors, values };
  }
  try {
    const result = await signUp({ ...parsed.data, inviteToken: invite });
    await createSession(result);
  } catch (err) {
    if (err instanceof AuthError && err.code === "email_taken") return { errors: { email: ["An account with this email already exists"] }, values };
    if (err instanceof AuthError && err.code === "invite_invalid") return { message: "This invite link is invalid or has expired", values };
    throw err;
  }
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const values = fieldValues(formData, ["email", "invite"]);
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const email = parsed.data.email.toLowerCase();
  if (!(await loginAllowed(email))) {
    return { message: "Too many attempts. Try again in a few minutes.", values };
  }
  try {
    const result = await signIn(parsed.data.email, parsed.data.password, parsed.data.invite || undefined);
    await createSession(result);
  } catch (err) {
    if (err instanceof AuthError) return { message: "Email or password is incorrect", values };
    throw err;
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
