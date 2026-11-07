"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeRedirectPath, siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./result";

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");
const creds = z.object({ email, password });

function validTimeZone(tz: unknown): string | undefined {
  if (typeof tz !== "string" || tz.length > 64) return undefined;
  try { Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return undefined; }
}

export async function signIn(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return fail("Check your email and password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return fail("Please confirm your email first — check your inbox.");
    if (error.status === 429) return fail("Too many attempts. Please wait a minute and try again.");
    return fail("Incorrect email or password.");
  }
  redirect(safeRedirectPath(form.get("next")));
}

export async function signUp(_: unknown, form: FormData): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const parsed = creds.extend({ displayName: z.string().trim().max(80).optional() }).safeParse({
    email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
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
    if (error.status === 429) return fail("Too many sign-up attempts. Please try again later.");
    if (error.code === "weak_password") return fail("Please choose a stronger password.");
    return fail("Could not create the account. If you already have one, sign in or reset your password.");
  }
  if (!data.session) return { ok: true, data: { confirmEmail: true } };
  redirect("/dashboard");
}

/** Always reports success so the form cannot be used to discover registered emails. */
export async function requestPasswordReset(_: unknown, form: FormData): Promise<ActionResult<{ sent: true }>> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return fail("Enter a valid email.");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
  if (error?.status === 429) return fail("Too many requests. Please wait a few minutes.");
  return { ok: true, data: { sent: true } };
}

export async function updatePassword(_: unknown, form: FormData): Promise<ActionResult> {
  const p = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Your reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return fail(error.code === "same_password" ? "Choose a password different from the current one." : "Could not update the password. Request a new reset link.");
  redirect("/dashboard?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
