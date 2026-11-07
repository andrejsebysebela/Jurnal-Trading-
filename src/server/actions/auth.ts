"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./result";

const creds = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return fail("Check your email and password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = creds.extend({ displayName: z.string().trim().max(80).optional() }).safeParse({
    email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) return fail(error.message);
  if (!data.session) return fail("Check your inbox to confirm your email, then sign in.");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
