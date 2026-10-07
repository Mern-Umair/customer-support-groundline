"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { FormField, SubmitButton } from "../form-field";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {state?.message ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      <FormField label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <FormField label="Password" name="password" type="password" autoComplete="current-password" errors={state?.errors?.password} />
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}
