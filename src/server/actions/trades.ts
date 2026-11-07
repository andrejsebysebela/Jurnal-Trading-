"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TRADE_COLUMNS } from "@/lib/db/columns";
import type { TradeRow } from "@/lib/db/types";
import { requireUser } from "@/lib/db/session";
import { getI18n } from "@/lib/i18n/server";
import { flattenErrors, simpleTradeSchema } from "@/lib/validation/schemas";
import { saveSimpleTrade } from "@/server/services/trade-service";
import { fail, type ActionResult } from "./result";

const uuid = z.string().uuid();

export async function saveTradeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { t } = await getI18n();
  const parsed = simpleTradeSchema(t).safeParse(input);
  if (!parsed.success) return fail(t.common.fixFields, flattenErrors(parsed.error));
  try {
    const ctx = await requireUser();
    const res = await saveSimpleTrade(ctx, parsed.data, t);
    if (!res.ok) return fail(res.error, res.fieldErrors);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: res.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTrades(ids: string[]): Promise<ActionResult> {
  const parsed = z.array(uuid).min(1).max(1000).safeParse(ids);
  if (!parsed.success) return fail((await getI18n()).t.common.genericError);
  const { supabase } = await requireUser();
  const { data: shots } = await supabase.from("screenshots").select("storage_path").in("trade_id", parsed.data);
  const { error } = await supabase.from("trades").delete().in("id", parsed.data);
  if (error) return fail(error.message);
  if (shots?.length) await supabase.storage.from("screenshots").remove(shots.map((s) => s.storage_path));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Copy a trade's journal fields (not screenshots) into a new trade. */
export async function duplicateTrade(id: string): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(id).success) return fail((await getI18n()).t.common.genericError);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("trades").select(TRADE_COLUMNS).eq("id", id).single();
  if (error || !data) return fail((await getI18n()).t.trade.errors.notFound);
  const tr = data as unknown as TradeRow;
  const copy = {
    account_id: tr.account_id, symbol: tr.symbol, asset_class: tr.asset_class, direction: tr.direction, status: tr.status, entry_mode: "simple",
    opened_at: tr.opened_at, closed_at: tr.closed_at, manual_initial_risk: tr.manual_initial_risk ?? tr.initial_risk, initial_risk: tr.initial_risk,
    gross_pnl: tr.gross_pnl, fees: tr.fees, swap: tr.swap, net_pnl: tr.net_pnl, pnl_source: tr.pnl_source, r_multiple: tr.r_multiple,
    planned_rr: tr.planned_rr, outcome: tr.outcome, holding_seconds: tr.holding_seconds, pnl_currency: tr.pnl_currency,
    emotional_state: tr.emotional_state, psychology_notes: tr.psychology_notes, notes: tr.notes, tradingview_url: tr.tradingview_url,
  };
  const { data: inserted, error: e2 } = await supabase.from("trades").insert(copy).select("id").single();
  if (e2) return fail(e2.message);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: inserted.id } };
}

const shotSchema = z.object({
  tradeId: uuid,
  storagePath: z.string().min(10).max(300),
  kind: z.enum(["before", "after", "other"]).default("other"),
});

/** Register a screenshot uploaded directly to Storage (path must be inside the user's folder). */
export async function addScreenshot(input: z.input<typeof shotSchema>): Promise<ActionResult> {
  const parsed = shotSchema.safeParse(input);
  const { t } = await getI18n();
  if (!parsed.success) return fail(t.common.genericError);
  const { supabase, user } = await requireUser();
  if (!parsed.data.storagePath.startsWith(`${user.id}/`)) return fail(t.common.genericError);
  const { error } = await supabase.from("screenshots").insert({ trade_id: parsed.data.tradeId, storage_path: parsed.data.storagePath, kind: parsed.data.kind });
  if (error) {
    await supabase.storage.from("screenshots").remove([parsed.data.storagePath]);
    return fail(error.message);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteScreenshot(id: string): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!uuid.safeParse(id).success) return fail(t.common.genericError);
  const { supabase } = await requireUser();
  const { data } = await supabase.from("screenshots").select("storage_path").eq("id", id).single();
  if (!data) return fail(t.common.genericError);
  const { error } = await supabase.from("screenshots").delete().eq("id", id);
  if (error) return fail(error.message);
  await supabase.storage.from("screenshots").remove([data.storage_path]);
  revalidatePath("/", "layout");
  return { ok: true };
}
