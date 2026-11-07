import "server-only";
import { fromZonedTime } from "date-fns-tz";
import { computeTrade, createFxLookup, TradeCalculationError, type InstrumentSpec, type TradeCalcResult, type TradeInput } from "@/lib/engine";
import { ACCOUNT_COLUMNS, EXECUTION_COLUMNS, INSTRUMENT_COLUMNS, TRADE_COLUMNS } from "@/lib/db/columns";
import type { Account, ExecutionRow, Instrument, TradeRow } from "@/lib/db/types";
import type { UserContext } from "@/lib/db/session";
import type { TradeFormData } from "@/lib/validation/schemas";

type SB = UserContext["supabase"];

export function instrumentToSpec(i: Pick<Instrument, "symbol" | "asset_class" | "point_value" | "contract_size" | "contract_multiplier" | "tick_size" | "tick_value" | "quote_currency" | "base_currency" | "lot_step" | "min_lot">): InstrumentSpec {
  return {
    symbol: i.symbol, assetClass: i.asset_class, pointValue: i.point_value, contractSize: i.contract_size,
    contractMultiplier: i.contract_multiplier, tickSize: i.tick_size, tickValue: i.tick_value,
    quoteCurrency: i.quote_currency, baseCurrency: i.base_currency, lotStep: i.lot_step, minLot: i.min_lot,
  };
}

/** Find the user's instrument or create an UNREVIEWED one with no invented specs. */
export async function ensureInstrument(sb: SB, symbol: string, assetClass: Instrument["asset_class"], quoteCurrency: string | null): Promise<Instrument> {
  const { data: existing } = await sb.from("instruments").select(INSTRUMENT_COLUMNS).eq("symbol", symbol).maybeSingle();
  if (existing) return existing as unknown as Instrument;
  const { data, error } = await sb
    .from("instruments")
    .insert({ symbol, asset_class: assetClass, quote_currency: quoteCurrency, reviewed: false })
    .select(INSTRUMENT_COLUMNS)
    .single();
  if (error) {
    // Race: created concurrently.
    const { data: again } = await sb.from("instruments").select(INSTRUMENT_COLUMNS).eq("symbol", symbol).single();
    if (again) return again as unknown as Instrument;
    throw new Error(error.message);
  }
  return data as unknown as Instrument;
}

/** Load the historical FX rates relevant for one currency pair (both directions). */
export async function loadFxLookup(sb: SB, from: string | null, to: string, maxStaleDays: number) {
  if (!from || from === to) return undefined;
  const { data, error } = await sb
    .from("fx_rates")
    .select("base,quote,rate_date,rate:rate::text")
    .or(`and(base.eq.${from},quote.eq.${to}),and(base.eq.${to},quote.eq.${from})`)
    .limit(10000);
  if (error) throw new Error(error.message);
  return createFxLookup((data ?? []).map((r) => ({ base: r.base, quote: r.quote, date: r.rate_date, rate: r.rate as string })), { maxStaleDays });
}

/** Map engine output to trade columns. */
export function calcColumns(c: TradeCalcResult) {
  return {
    direction: c.direction,
    status: c.status,
    opened_at: c.openedAt,
    closed_at: c.closedAt,
    entry_quantity: c.entryQuantity,
    exit_quantity: c.exitQuantity,
    open_quantity: c.openQuantity,
    avg_entry_price: c.avgEntryPrice,
    avg_exit_price: c.avgExitPrice,
    pnl_currency: c.pnlCurrency,
    gross_pnl_quote: c.grossPnlQuote,
    gross_pnl: c.grossPnl,
    fees: c.fees,
    net_pnl: c.netPnl,
    pnl_source: c.pnlSource,
    initial_risk: c.initialRisk,
    r_multiple: c.rMultiple,
    planned_rr: c.plannedRewardRisk,
    outcome: c.outcome,
    holding_seconds: c.holdingSeconds,
    calc_issues: c.issues,
  };
}

async function ensureTagIds(sb: SB, names: string[], kind: "tag" | "mistake"): Promise<string[]> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return [];
  const { error } = await sb.from("tags").upsert(unique.map((name) => ({ name, kind })), { onConflict: "user_id,kind,name", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  const { data, error: e2 } = await sb.from("tags").select("id,name").eq("kind", kind).in("name", unique);
  if (e2) throw new Error(e2.message);
  return (data ?? []).map((t) => t.id);
}

export type SaveTradeResult = { ok: true; id: string; calc: TradeCalcResult } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Validate → compute with the engine (server-side) → persist atomically. */
export async function saveTrade(ctx: UserContext, data: TradeFormData): Promise<SaveTradeResult> {
  const { supabase: sb, profile } = ctx;
  const { data: account } = await sb.from("accounts").select(ACCOUNT_COLUMNS).eq("id", data.accountId).maybeSingle();
  if (!account) return { ok: false, error: "Account not found.", fieldErrors: { accountId: "Account not found" } };
  const acct = account as unknown as Account;

  const instrument = await ensureInstrument(sb, data.symbol, data.assetClass, data.quoteCurrency ?? acct.currency);
  if (instrument.asset_class !== data.assetClass) {
    return { ok: false, error: `${data.symbol} is configured as ${instrument.asset_class}. Change it under Instruments first.`, fieldErrors: { assetClass: "Does not match instrument" } };
  }
  const tz = profile.timezone;
  const executions = data.executions.map((e) => ({
    side: e.side,
    quantity: e.quantity,
    price: e.price,
    executedAt: fromZonedTime(e.executedAt, tz).toISOString(),
    fee: e.fee ?? null,
    commission: e.commission ?? null,
  }));

  let brokerNetPnl: string | null = null;
  if (data.id) {
    const { data: existing } = await sb.from("trades").select("broker_net_pnl:broker_net_pnl::text").eq("id", data.id).maybeSingle();
    if (!existing) return { ok: false, error: "Trade not found." };
    brokerNetPnl = (existing.broker_net_pnl as string | null) ?? null;
  }

  const input: TradeInput = {
    brokerNetPnl,
    direction: data.direction,
    executions,
    instrument: instrumentToSpec(instrument),
    accountCurrency: acct.currency,
    stopLoss: data.stopLoss ?? null,
    takeProfit: data.takeProfit ?? null,
    manualInitialRisk: data.manualInitialRisk ?? null,
    swap: data.swap ?? null,
    matchingPolicy: profile.matching_policy,
    breakevenTolerance: profile.breakeven_tolerance,
  };

  let calc: TradeCalcResult;
  try {
    const fx = await loadFxLookup(sb, instrument.quote_currency, acct.currency, profile.fx_max_stale_days);
    calc = computeTrade(input, fx);
  } catch (e) {
    if (e instanceof TradeCalculationError) return { ok: false, error: e.message, fieldErrors: { executions: e.message } };
    throw e;
  }

  const tagIds = [...(await ensureTagIds(sb, data.tags, "tag")), ...(await ensureTagIds(sb, data.mistakes, "mistake"))];
  const payload = {
    id: data.id ?? null,
    account_id: acct.id,
    instrument_id: instrument.id,
    strategy_id: data.strategyId ?? null,
    symbol: data.symbol,
    asset_class: data.assetClass,
    is_draft: data.isDraft,
    stop_loss: data.stopLoss ?? null,
    take_profit: data.takeProfit ?? null,
    manual_initial_risk: data.manualInitialRisk ?? null,
    swap: data.swap ?? "0",
    broker_net_pnl: brokerNetPnl,
    setup: data.setup ?? null,
    session: data.session ?? null,
    timeframe: data.timeframe ?? null,
    rating: data.rating ?? null,
    confidence: data.confidence ?? null,
    discipline_rating: data.disciplineRating ?? null,
    emotional_state: data.emotionalState ?? null,
    rule_compliant: data.ruleCompliant ?? null,
    checklist_state: data.checklistState ?? {},
    note_entry_reason: data.noteEntryReason ?? null,
    note_expectation: data.noteExpectation ?? null,
    note_exit_reason: data.noteExitReason ?? null,
    note_did_well: data.noteDidWell ?? null,
    note_did_wrong: data.noteDidWrong ?? null,
    note_lesson: data.noteLesson ?? null,
    notes: data.notes ?? null,
    ...calcColumns(calc),
  };
  const execRows = executions.map((e) => ({ side: e.side, quantity: e.quantity, price: e.price, executed_at: e.executedAt, fee: e.fee ?? "0", commission: e.commission ?? "0" }));
  const { data: id, error } = await sb.rpc("save_trade", { p_trade: payload, p_executions: execRows, p_tag_ids: tagIds });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: id as string, calc };
}

/**
 * Recompute stored metrics after instrument specs, FX rates or settings change.
 * Executions are the source of truth; computed columns are derived.
 */
export async function recalculateTrades(ctx: UserContext, filter: { instrumentId?: string; accountId?: string } = {}): Promise<{ updated: number; failed: number }> {
  const { supabase: sb, profile } = ctx;
  const [{ data: accounts }, { data: instruments }] = await Promise.all([
    sb.from("accounts").select(ACCOUNT_COLUMNS),
    sb.from("instruments").select(INSTRUMENT_COLUMNS),
  ]);
  const acctMap = new Map(((accounts ?? []) as unknown as Account[]).map((a) => [a.id, a]));
  const instMap = new Map(((instruments ?? []) as unknown as Instrument[]).map((i) => [i.id, i]));
  const { data: fxRows } = await sb.from("fx_rates").select("base,quote,rate_date,rate:rate::text").limit(50000);
  const fx = createFxLookup((fxRows ?? []).map((r) => ({ base: r.base, quote: r.quote, date: r.rate_date, rate: r.rate as string })), { maxStaleDays: profile.fx_max_stale_days });

  let updated = 0, failed = 0;
  for (let from = 0; ; from += 500) {
    let q = sb.from("trades").select(`${TRADE_COLUMNS},executions(${EXECUTION_COLUMNS})`).order("id").range(from, from + 499);
    if (filter.instrumentId) q = q.eq("instrument_id", filter.instrumentId);
    if (filter.accountId) q = q.eq("account_id", filter.accountId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as (TradeRow & { executions: ExecutionRow[] })[];
    for (const t of rows) {
      const acct = acctMap.get(t.account_id);
      const inst = t.instrument_id ? instMap.get(t.instrument_id) : undefined;
      if (!acct || !inst || !t.executions.length) { failed++; continue; }
      try {
        const calc = computeTrade({
          direction: t.direction,
          executions: t.executions.map((e) => ({ side: e.side, quantity: e.quantity, price: e.price, executedAt: e.executed_at, fee: e.fee, commission: e.commission })),
          instrument: instrumentToSpec(inst),
          accountCurrency: acct.currency,
          stopLoss: t.stop_loss, takeProfit: t.take_profit, manualInitialRisk: t.manual_initial_risk, swap: t.swap,
          brokerNetPnl: t.broker_net_pnl, matchingPolicy: profile.matching_policy, breakevenTolerance: profile.breakeven_tolerance,
        }, fx);
        const { error: uerr } = await sb.from("trades").update({ ...calcColumns(calc), calculated_at: new Date().toISOString() }).eq("id", t.id);
        if (uerr) failed++; else updated++;
      } catch {
        failed++;
      }
    }
    if (rows.length < 500) break;
  }
  return { updated, failed };
}
