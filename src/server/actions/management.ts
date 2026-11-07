"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/db/session";
import { D } from "@/lib/engine";
import { accountSchema, flattenErrors, fxRateSchema, instrumentSchema, journalSchema, profileSchema, strategySchema } from "@/lib/validation/schemas";
import { recalculateTrades } from "@/server/services/trade-service";
import { fail, type ActionResult } from "./result";

const uuid = z.string().uuid();
const done = (): ActionResult => { revalidatePath("/", "layout"); return { ok: true }; };

// ───────── accounts
export async function saveAccount(input: unknown): Promise<ActionResult> {
  const p = accountSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", flattenErrors(p.error));
  const { supabase } = await requireUser();
  const v = p.data;
  const row = {
    name: v.name, broker: v.broker ?? null, account_type: v.accountType, currency: v.currency,
    starting_balance: v.startingBalance ?? null, prop_firm: v.propFirm ?? null, profit_target: v.profitTarget ?? null,
    max_daily_loss: v.maxDailyLoss ?? null, max_total_drawdown: v.maxTotalDrawdown ?? null, drawdown_type: v.drawdownType, is_active: v.isActive,
  };
  if (v.id) {
    const { data: prev } = await supabase.from("accounts").select("currency").eq("id", v.id).single();
    const { error } = await supabase.from("accounts").update(row).eq("id", v.id);
    if (error) return fail(error.code === "23505" ? "An account with this name already exists." : error.message);
    // Currency change affects every conversion → recompute.
    if (prev && prev.currency !== v.currency) await recalculateTrades(await requireUser(), { accountId: v.id });
  } else {
    const { error } = await supabase.from("accounts").insert(row);
    if (error) return fail(error.code === "23505" ? "An account with this name already exists." : error.message);
  }
  return done();
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid account.");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return fail(error.message);
  return done();
}

// ───────── instruments
export async function saveInstrument(input: unknown): Promise<ActionResult<{ recalculated: number }>> {
  const p = instrumentSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", flattenErrors(p.error));
  const ctx = await requireUser();
  const v = p.data;
  const row = {
    symbol: v.symbol, asset_class: v.assetClass, description: v.description ?? null, point_value: v.pointValue ?? null,
    contract_size: v.contractSize ?? null, contract_multiplier: v.contractMultiplier ?? null, tick_size: v.tickSize ?? null,
    tick_value: v.tickValue ?? null, quote_currency: v.quoteCurrency ?? null, base_currency: v.baseCurrency ?? null,
    lot_step: v.lotStep ?? null, min_lot: v.minLot ?? null, reviewed: true,
  };
  let id = v.id;
  if (id) {
    const { error } = await ctx.supabase.from("instruments").update(row).eq("id", id);
    if (error) return fail(error.code === "23505" ? "This symbol already exists." : error.message);
    // Keep denormalized trade columns in sync.
    await ctx.supabase.from("trades").update({ symbol: v.symbol, asset_class: v.assetClass }).eq("instrument_id", id);
  } else {
    const { data, error } = await ctx.supabase.from("instruments").insert(row).select("id").single();
    if (error) return fail(error.code === "23505" ? "This symbol already exists." : error.message);
    id = data.id;
  }
  const r = await recalculateTrades(ctx, { instrumentId: id! });
  revalidatePath("/", "layout");
  return { ok: true, data: { recalculated: r.updated } };
}

export async function deleteInstrument(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid instrument.");
  const { supabase } = await requireUser();
  const { count } = await supabase.from("trades").select("id", { count: "exact", head: true }).eq("instrument_id", id);
  if (count) return fail(`This instrument is used by ${count} trade(s) and cannot be deleted.`);
  const { error } = await supabase.from("instruments").delete().eq("id", id);
  if (error) return fail(error.message);
  return done();
}

// ───────── strategies / playbook
export async function saveStrategy(input: unknown): Promise<ActionResult> {
  const p = strategySchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", flattenErrors(p.error));
  const { supabase } = await requireUser();
  const v = p.data;
  const row = {
    name: v.name, description: v.description ?? null, timeframe: v.timeframe ?? null, market_conditions: v.marketConditions ?? null,
    entry_criteria: v.entryCriteria ?? null, exit_criteria: v.exitCriteria ?? null, risk_rules: v.riskRules ?? null,
    checklist: v.checklist, color: v.color, is_active: v.isActive,
  };
  const { error } = v.id ? await supabase.from("strategies").update(row).eq("id", v.id) : await supabase.from("strategies").insert(row);
  if (error) return fail(error.code === "23505" ? "A strategy with this name already exists." : error.message);
  return done();
}

export async function deleteStrategy(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid strategy.");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("strategies").delete().eq("id", id);
  if (error) return fail(error.message);
  return done();
}

// ───────── journal
export async function saveJournal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = journalSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", flattenErrors(p.error));
  const { supabase } = await requireUser();
  const v = p.data;
  const { data, error } = await supabase.from("daily_journals").upsert({
    journal_date: v.date, pre_market_plan: v.preMarketPlan ?? null, post_market_review: v.postMarketReview ?? null,
    notes: v.notes ?? null, emotions: v.emotions, rule_violations: v.ruleViolations, mood: v.mood ?? null, discipline_score: v.disciplineScore ?? null,
  }, { onConflict: "user_id,journal_date" }).select("id").single();
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/** Partial trade journaling update (notes/psychology) — no financial fields. */
const tradeNotesSchema = z.object({
  id: uuid,
  field: z.enum(["note_entry_reason", "note_expectation", "note_exit_reason", "note_did_well", "note_did_wrong", "note_lesson", "notes", "emotional_state", "confidence", "discipline_rating", "rule_compliant", "rating", "checklist_state"]),
  value: z.union([z.string().max(20000), z.number().int().min(1).max(10), z.boolean(), z.record(z.string(), z.boolean()), z.null()]),
});
export async function updateTradeField(input: z.input<typeof tradeNotesSchema>): Promise<ActionResult> {
  const p = tradeNotesSchema.safeParse(input);
  if (!p.success) return fail("Invalid value.");
  const { field, value } = p.data;
  if ((field === "rating" && typeof value === "number" && value > 5)) return fail("Rating is 1–5.");
  const { supabase } = await requireUser();
  const v = typeof value === "string" && value.trim() === "" ? null : value;
  const { error } = await supabase.from("trades").update({ [field]: v }).eq("id", p.data.id);
  if (error) return fail(error.message);
  return done();
}

// ───────── rules & progress
export async function saveRule(input: { id?: string; text: string; category?: string; isActive?: boolean }): Promise<ActionResult> {
  const p = z.object({ id: uuid.optional(), text: z.string().trim().min(1).max(200), category: z.string().trim().max(40).default("general"), isActive: z.boolean().default(true) }).safeParse(input);
  if (!p.success) return fail("Rule text is required (max 200 characters).");
  const { supabase } = await requireUser();
  const row = { text: p.data.text, category: p.data.category || "general", is_active: p.data.isActive };
  const { error } = p.data.id ? await supabase.from("trading_rules").update(row).eq("id", p.data.id) : await supabase.from("trading_rules").insert(row);
  if (error) return fail(error.message);
  return done();
}

export async function deleteRule(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid rule.");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("trading_rules").delete().eq("id", id);
  if (error) return fail(error.message);
  return done();
}

export async function setRuleCheck(input: { ruleId: string; date: string; followed: boolean | null }): Promise<ActionResult> {
  const p = z.object({ ruleId: uuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), followed: z.boolean().nullable() }).safeParse(input);
  if (!p.success) return fail("Invalid check.");
  const { supabase } = await requireUser();
  const { error } = p.data.followed === null
    ? await supabase.from("rule_checks").delete().eq("rule_id", p.data.ruleId).eq("check_date", p.data.date)
    : await supabase.from("rule_checks").upsert({ rule_id: p.data.ruleId, check_date: p.data.date, followed: p.data.followed }, { onConflict: "rule_id,check_date" });
  if (error) return fail(error.message);
  return done();
}

// ───────── settings
export async function saveProfile(input: unknown): Promise<ActionResult<{ recalculated: number }>> {
  const p = profileSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", flattenErrors(p.error));
  const ctx = await requireUser();
  const v = p.data;
  const before = ctx.profile;
  const { error } = await ctx.supabase.from("profiles").update({
    display_name: v.displayName ?? null, timezone: v.timezone, base_currency: v.baseCurrency, matching_policy: v.matchingPolicy,
    breakeven_tolerance: v.breakevenTolerance ?? "0", fx_max_stale_days: v.fxMaxStaleDays, onboarded: true,
  }).eq("id", ctx.user.id);
  if (error) return fail(error.message);
  let recalculated = 0;
  const calcChanged = before.matching_policy !== v.matchingPolicy || !new D(before.breakeven_tolerance).eq(v.breakevenTolerance ?? "0") || before.fx_max_stale_days !== v.fxMaxStaleDays;
  if (calcChanged) {
    const fresh = { ...ctx, profile: { ...before, matching_policy: v.matchingPolicy, breakeven_tolerance: v.breakevenTolerance ?? "0", fx_max_stale_days: v.fxMaxStaleDays } };
    recalculated = (await recalculateTrades(fresh)).updated;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { recalculated } };
}

export async function saveFxRate(input: unknown): Promise<ActionResult<{ recalculated: number }>> {
  const p = fxRateSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", flattenErrors(p.error));
  const ctx = await requireUser();
  const { error } = await ctx.supabase.from("fx_rates").upsert({ base: p.data.base, quote: p.data.quote, rate_date: p.data.rateDate, rate: p.data.rate, source: "manual" }, { onConflict: "user_id,base,quote,rate_date" });
  if (error) return fail(error.message);
  const r = await recalculateTrades(ctx);
  revalidatePath("/", "layout");
  return { ok: true, data: { recalculated: r.updated } };
}

export async function deleteFxRate(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid rate.");
  const ctx = await requireUser();
  const { error } = await ctx.supabase.from("fx_rates").delete().eq("id", id);
  if (error) return fail(error.message);
  await recalculateTrades(ctx);
  return done();
}

export async function recalculateAll(): Promise<ActionResult<{ updated: number; failed: number }>> {
  const ctx = await requireUser();
  const r = await recalculateTrades(ctx);
  revalidatePath("/", "layout");
  return { ok: true, data: r };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid tag.");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return fail(error.message);
  return done();
}
