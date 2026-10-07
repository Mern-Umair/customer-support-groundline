"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, signIn, signUp } from "@/lib/auth/service";
import { createSession, deleteSession } from "@/lib/auth/session";

export interface FormState {
  errors?: Record<string, string[]>;
  message?: string;
  values?: Record<string, string>;
}

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  workspaceName: z.string().trim().min(2, "Enter your company or project name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function fieldValues(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}

export async function signupAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const values = fieldValues(formData, ["name", "workspaceName", "email"]);
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  try {
    const result = await signUp(parsed.data);
    await createSession(result);
  } catch (err) {
    if (err instanceof AuthError && err.code === "email_taken") {
      return { errors: { email: ["An account with this email already exists"] }, values };
    }
    throw err;
  }
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const values = fieldValues(formData, ["email"]);
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  try {
    const result = await signIn(parsed.data.email, parsed.data.password);
    await createSession(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return { message: "Email or password is incorrect", values };
    }
    throw err;
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
