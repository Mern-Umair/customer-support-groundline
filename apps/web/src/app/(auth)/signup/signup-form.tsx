"use client";

import { useActionState } from "react";
import { signupAction } from "../actions";
import { FormField, SubmitButton } from "../form-field";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <FormField label="Your name" name="name" autoComplete="name" defaultValue={state?.values?.name} errors={state?.errors?.name} />
      <FormField
        label="Company or project name"
        name="workspaceName"
        placeholder="Ali Shoes"
        defaultValue={state?.values?.workspaceName}
        errors={state?.errors?.workspaceName}
      />
      <FormField label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" errors={state?.errors?.password} />
      <SubmitButton pending={pending}>Create workspace</SubmitButton>
    </form>
  );
}
