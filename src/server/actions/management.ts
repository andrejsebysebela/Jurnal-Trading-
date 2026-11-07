"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/db/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { accountSchema, flattenErrors, profileSchema } from "@/lib/validation/schemas";
import { fail, type ActionResult } from "./result";

const uuid = z.string().uuid();
const done = (): ActionResult => { revalidatePath("/", "layout"); return { ok: true }; };

export async function saveAccount(input: unknown): Promise<ActionResult> {
  const { t } = await getI18n();
  const p = accountSchema(t).safeParse(input);
  if (!p.success) return fail(t.common.fixFields, flattenErrors(p.error));
  const { supabase } = await requireUser();
  const v = p.data;
  const isProp = v.kind === "prop";
  const row = {
    name: v.name,
    account_type: isProp ? "prop" : v.phase,
    prop_phase: isProp ? v.phase : null,
    prop_firm: isProp ? v.propFirm ?? null : null,
    currency: v.currency,
    starting_balance: v.startingBalance ?? null,
    profit_target: isProp ? v.profitTarget ?? null : null,
    max_daily_loss: isProp ? v.maxDailyLoss ?? null : null,
    max_total_drawdown: isProp ? v.maxTotalDrawdown ?? null : null,
    drawdown_type: v.drawdownType,
    is_active: v.isActive,
  };
  const { error } = v.id ? await supabase.from("accounts").update(row).eq("id", v.id) : await supabase.from("accounts").insert(row);
  if (error) return fail(error.code === "23505" ? t.accounts.duplicateName : error.message, error.code === "23505" ? { name: t.accounts.duplicateName } : undefined);
  return done();
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!uuid.safeParse(id).success) return fail(t.common.genericError);
  const { supabase } = await requireUser();
  const { data: shots } = await supabase.from("screenshots").select("storage_path, trades!inner(account_id)").eq("trades.account_id", id);
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return fail(error.message);
  if (shots?.length) await supabase.storage.from("screenshots").remove(shots.map((s) => s.storage_path));
  return done();
}

export async function saveProfile(input: unknown): Promise<ActionResult> {
  const { t } = await getI18n();
  const p = profileSchema(t).safeParse(input);
  if (!p.success) return fail(t.common.fixFields, flattenErrors(p.error));
  const ctx = await requireUser();
  const { error } = await ctx.supabase.from("profiles").update({
    display_name: p.data.displayName ?? null, timezone: p.data.timezone, base_currency: p.data.baseCurrency, onboarded: true,
  }).eq("id", ctx.user.id);
  if (error) return fail(error.message);
  return done();
}

/** Language is a per-browser preference stored in a cookie (works before sign-in too). */
export async function setLocale(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return fail("Unsupported language.");
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true };
}
