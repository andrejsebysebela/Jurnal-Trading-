"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signIn, signUp } from "@/server/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? signIn : signUp, null);
  return (
    <form action={action} className="space-y-4">
      {mode === "signup" && (
        <Field label="Name" htmlFor="displayName"><Input id="displayName" name="displayName" autoComplete="name" placeholder="Alex Trader" /></Field>
      )}
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></Field>
      <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
      </Field>
      {next && <input type="hidden" name="next" value={next} />}
      {state && !state.ok && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-fg-2">
        {mode === "login" ? (
          <>New to EDGELOG? <Link href="/signup" className="text-gold hover:text-gold-hover">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="text-gold hover:text-gold-hover">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
