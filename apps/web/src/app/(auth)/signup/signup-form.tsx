"use client";

import { useActionState } from "react";
import { signupAction } from "../actions";
import { FormField, SubmitButton } from "../form-field";

export function SignupForm({ invite, inviteEmail }: { invite?: string; inviteEmail?: string }) {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}
      {state?.message ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      <FormField label="Your name" name="name" autoComplete="name" defaultValue={state?.values?.name} errors={state?.errors?.name} />
      {invite ? null : (
        <FormField label="Company or project name" name="workspaceName" placeholder="Ali Shoes" defaultValue={state?.values?.workspaceName} errors={state?.errors?.workspaceName} />
      )}
      <FormField label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email ?? inviteEmail} errors={state?.errors?.email} />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" errors={state?.errors?.password} />
      <SubmitButton pending={pending}>{invite ? "Create account and join" : "Create workspace"}</SubmitButton>
    </form>
  );
}
