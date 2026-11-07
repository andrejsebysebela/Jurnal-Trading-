"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { signIn, signUp } from "@/server/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<Awaited<ReturnType<typeof signUp>> | Awaited<ReturnType<typeof signIn>> | null, FormData>(mode === "login" ? signIn : signUp, null);
  const [tz, setTz] = useState("");
  // React 19 resets uncontrolled fields after a form action; keep the email the user typed.
  const [email, setEmail] = useState("");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch {} }, []);
  if (state?.ok && mode === "signup") {
    return (
      <div role="status" className="space-y-4">
        <p className="rounded-lg border border-profit/30 bg-profit/10 px-3 py-3 text-sm text-fg">{t.auth.checkEmail}</p>
        <Link href="/login" className="block text-center text-sm text-gold hover:text-gold-hover">{t.auth.backToSignIn}</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {mode === "signup" && <Field label={t.auth.name} htmlFor="displayName"><Input id="displayName" name="displayName" autoComplete="name" placeholder={t.auth.namePlaceholder} /></Field>}
      <Field label={t.auth.email} htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label={t.auth.password} htmlFor="password" hint={mode === "signup" ? t.auth.passwordHint : undefined}>
        <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
      </Field>
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && <input type="hidden" name="timezone" value={tz} />}
      {mode === "login" && <Link href="/forgot-password" className="-mt-2 block text-right text-xs text-fg-2 hover:text-gold">{t.auth.forgot}</Link>}
      {state && !state.ok && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? t.auth.wait : mode === "login" ? t.auth.signIn : t.auth.createAccount}</Button>
      <p className="text-center text-sm text-fg-2">
        {mode === "login" ? <>{t.auth.newHere} <Link href="/signup" className="text-gold hover:text-gold-hover">{t.auth.createLink}</Link></> : <>{t.auth.haveAccount} <Link href="/login" className="text-gold hover:text-gold-hover">{t.auth.signInLink}</Link></>}
      </p>
    </form>
  );
}
