"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeRedirectPath, siteUrl } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./result";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72);
const creds = z.object({ email, password });

function validTimeZone(tz: unknown): string | undefined {
  if (typeof tz !== "string" || tz.length > 64) return undefined;
  try { Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return undefined; }
}

export async function signIn(_: unknown, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return fail(t.auth.errors.checkCredentials);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return fail(t.auth.errors.confirmFirst);
    if (error.status === 429) return fail(t.auth.errors.tooMany);
    return fail(t.auth.errors.incorrect);
  }
  redirect(safeRedirectPath(form.get("next")));
}

export async function signUp(_: unknown, form: FormData): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const { t } = await getI18n();
  const parsed = creds.extend({ displayName: z.string().trim().max(80).optional() }).safeParse({
    email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") || undefined,
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0].path[0];
    const tooLong = parsed.error.issues[0].code === "too_big";
    return fail(path === "email" ? t.auth.errors.invalidEmail : path === "password" ? (tooLong ? t.auth.errors.passwordLong : t.auth.errors.passwordShort) : t.common.fixFields);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
      data: { display_name: parsed.data.displayName, timezone: validTimeZone(form.get("timezone")) },
    },
  });
  if (error) {
    if (error.status === 429) return fail(t.auth.errors.tooMany);
    if (error.code === "weak_password") return fail(t.auth.errors.weakPassword);
    return fail(t.auth.errors.signupFailed);
  }
  if (!data.session) return { ok: true, data: { confirmEmail: true } };
  redirect("/dashboard");
}

/** Always reports success so the form cannot be used to discover registered emails. */
export async function requestPasswordReset(_: unknown, form: FormData): Promise<ActionResult<{ sent: true }>> {
  const { t } = await getI18n();
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return fail(t.auth.errors.invalidEmail);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
  if (error?.status === 429) return fail(t.auth.errors.tooMany);
  return { ok: true, data: { sent: true } };
}

export async function updatePassword(_: unknown, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  const p = z.object({ password, confirm: z.string() }).safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!p.success) return fail(p.error.issues[0].code === "too_big" ? t.auth.errors.passwordLong : t.auth.errors.passwordShort);
  if (p.data.password !== p.data.confirm) return fail(t.auth.errors.mismatch);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(t.auth.errors.linkExpired);
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return fail(error.code === "same_password" ? t.auth.errors.samePassword : t.auth.errors.updateFailed);
  redirect("/dashboard?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
