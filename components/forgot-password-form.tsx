"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AuthState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input name="email" type="email" placeholder="admin@school.com" required />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {!state.error && !pending ? <p className="text-sm text-muted-foreground">Enter your email to request a reset link.</p> : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
