import "server-only";
import { fromZonedTime } from "date-fns-tz";
import { computeSimpleTrade, SimpleTradeError } from "@/lib/engine";
import { ACCOUNT_COLUMNS } from "@/lib/db/columns";
import type { Account } from "@/lib/db/types";
import type { UserContext } from "@/lib/db/session";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SimpleTradeData } from "@/lib/validation/schemas";

export type SaveTradeResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Simple journal entry: validate ownership → compute R/outcome/duration with decimal math → store.
 * P&L is entered by the trader in the account currency (pnl_source = 'manual'); nothing is derived from specs.
 */
export async function saveSimpleTrade(ctx: UserContext, data: SimpleTradeData, t: Dictionary): Promise<SaveTradeResult> {
  const { supabase: sb, profile } = ctx;
  const { data: accountRow } = await sb.from("accounts").select(ACCOUNT_COLUMNS).eq("id", data.accountId).maybeSingle();
  if (!accountRow) return { ok: false, error: t.trade.errors.account, fieldErrors: { accountId: t.trade.errors.account } };
  const account = accountRow as unknown as Account;

  const openedAt = fromZonedTime(data.openedAt, profile.timezone).toISOString();
  const closedAt = fromZonedTime(data.closedAt, profile.timezone).toISOString();
  let calc;
  try {
    calc = computeSimpleTrade({ risk: data.risk, result: data.result, plannedRR: data.plannedRR ?? null, openedAt, closedAt });
  } catch (e) {
    if (e instanceof SimpleTradeError) {
      const map: Record<string, string> = { risk: t.trade.errors.risk, result: t.trade.errors.result, plannedRR: t.trade.errors.rr, openedAt: t.trade.errors.date, closedAt: t.trade.errors.closeBeforeOpen };
      return { ok: false, error: t.common.fixFields, fieldErrors: { [e.field]: map[e.field] } };
    }
    throw e;
  }

  const row = {
    account_id: account.id,
    symbol: data.symbol,
    direction: data.direction,
    status: "closed",
    is_draft: false,
    entry_mode: "simple",
    opened_at: openedAt,
    closed_at: closedAt,
    manual_initial_risk: calc.initialRisk,
    initial_risk: calc.initialRisk,
    gross_pnl: calc.netPnl,
    fees: "0",
    swap: "0",
    net_pnl: calc.netPnl,
    pnl_source: "manual",
    r_multiple: calc.rMultiple,
    planned_rr: calc.plannedRR,
    outcome: calc.outcome,
    holding_seconds: calc.holdingSeconds,
    pnl_currency: account.currency,
    calc_issues: [],
    calculated_at: new Date().toISOString(),
    emotional_state: data.emotion ?? null,
    psychology_notes: data.psychology ?? null,
    notes: data.notes ?? null,
    tradingview_url: data.tradingviewUrl ?? null,
  };

  if (data.id) {
    const { data: existing } = await sb.from("trades").select("id,entry_mode").eq("id", data.id).maybeSingle();
    if (!existing) return { ok: false, error: t.trade.errors.notFound };
    const { error } = await sb.from("trades").update(row).eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    // A detailed (execution-based) trade edited in the simple form: its executions no longer describe it.
    if (existing.entry_mode === "executions") await sb.from("executions").delete().eq("trade_id", data.id);
    return { ok: true, id: data.id };
  }
  const { data: inserted, error } = await sb.from("trades").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: inserted.id };
}
