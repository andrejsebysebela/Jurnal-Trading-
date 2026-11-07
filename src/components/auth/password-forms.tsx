"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { requestPasswordReset, updatePassword } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg border border-profit/30 bg-profit/10 px-3 py-2 text-sm text-fg">{t.auth.resetSent}</p>
        <Link href="/login" className="block text-center text-sm text-gold hover:text-gold-hover">{t.auth.backToSignIn}</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <Field label={t.auth.email}><Input name="email" type="email" autoComplete="email" required /></Field>
      {state && !state.ok && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? t.auth.sending : t.auth.sendReset}</Button>
      <Link href="/login" className="block text-center text-sm text-fg-2 hover:text-fg">{t.auth.backToSignIn}</Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field label={t.auth.newPassword} hint={t.auth.passwordHint}><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Field label={t.auth.confirmPassword}><Input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></Field>
      {state && !state.ok && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? t.common.saving : t.auth.updatePassword}</Button>
    </form>
  );
}
