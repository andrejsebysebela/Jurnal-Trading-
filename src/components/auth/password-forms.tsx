"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordReset, updatePassword } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg border border-profit/30 bg-profit/10 px-3 py-2 text-sm text-fg">If an account exists for that email, a reset link is on its way. The link expires after one hour.</p>
        <Link href="/login" className="block text-center text-sm text-gold hover:text-gold-hover">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      {state && !state.ok && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      <Link href="/login" className="block text-center text-sm text-fg-2 hover:text-fg">Back to sign in</Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" hint="At least 8 characters."><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Field label="Confirm new password"><Input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></Field>
      {state && !state.ok && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? "Saving…" : "Update password"}</Button>
    </form>
  );
}
