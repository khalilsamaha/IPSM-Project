"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input name="email" type="email" placeholder="admin@school.com" required />
      <Input name="password" type="password" placeholder="Password" minLength={8} required />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
