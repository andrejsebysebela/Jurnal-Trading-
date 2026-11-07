import "server-only";
import { computeTrade, TradeCalculationError, type AssetClass } from "@/lib/engine";
import { ACCOUNT_COLUMNS, TRADE_COLUMNS } from "@/lib/db/columns";
import type { Account, Instrument, TradeRow } from "@/lib/db/types";
import type { UserContext } from "@/lib/db/session";
import { normalizeImport, parseCsv, validateMapping, type ImportMapping, type RowError } from "@/lib/import";
import { calcColumns, ensureInstrument, instrumentToSpec, loadFxLookup } from "./trade-service";

export interface SymbolSetting { symbol: string; assetClass: AssetClass; quoteCurrency: string | null }

export interface ImportSummary {
  batchId: string;
  rows: number;
  imported: number;
  updated: number;
  duplicates: number;
  errors: RowError[];
  unavailablePnl: number;
}

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/**
 * Server-side import: re-parses the CSV (client preview is never trusted),
 * computes every trade with the engine, skips duplicates by fingerprint and
 * merges re-exported partial positions into the existing trade.
 */
export async function importCsv(
  ctx: UserContext,
  args: { accountId: string; fileName: string; csv: string; mapping: ImportMapping; symbols: SymbolSetting[] },
): Promise<ImportSummary> {
  const { supabase: sb, profile } = ctx;
  const mappingErrors = validateMapping(args.mapping);
  if (mappingErrors.length) throw new Error(mappingErrors.join(" "));

  const { data: accountRow } = await sb.from("accounts").select(ACCOUNT_COLUMNS).eq("id", args.accountId).maybeSingle();
  if (!accountRow) throw new Error("Account not found.");
  const account = accountRow as unknown as Account;

  const table = parseCsv(args.csv);
  if (table.rows.length > 20000) throw new Error("File too large: split it into files of at most 20,000 rows.");
  const result = normalizeImport(table, args.mapping);
  const errors: RowError[] = [...result.errors];

  const { data: batch, error: batchErr } = await sb
    .from("import_batches")
    .insert({ account_id: account.id, file_name: args.fileName.slice(0, 200), kind: args.mapping.kind, mapping: args.mapping, row_count: result.rowCount })
    .select("id")
    .single();
  if (batchErr) throw new Error(batchErr.message);

  // Existing trade & execution fingerprints for dedupe/merge.
  const tradeFps = result.trades.map((t) => t.fingerprint);
  const execFps = result.trades.flatMap((t) => t.executions.map((e) => e.fingerprint));
  const existingTrades = new Set<string>();
  for (const c of chunk(tradeFps, 200)) {
    const { data } = await sb.from("trades").select("fingerprint").in("fingerprint", c);
    data?.forEach((r) => r.fingerprint && existingTrades.add(r.fingerprint));
  }
  const execToTrade = new Map<string, string>();
  for (const c of chunk(execFps, 200)) {
    const { data } = await sb.from("executions").select("fingerprint,trade_id").in("fingerprint", c);
    data?.forEach((r) => r.fingerprint && execToTrade.set(r.fingerprint, r.trade_id));
  }

  const settings = new Map(args.symbols.map((s) => [s.symbol.toUpperCase(), s]));
  const instruments = new Map<string, Instrument>();
  const fxCache = new Map<string, Awaited<ReturnType<typeof loadFxLookup>>>();
  let imported = 0, updated = 0, duplicates = 0, unavailablePnl = 0;

  for (const t of result.trades) {
    if (existingTrades.has(t.fingerprint)) { duplicates++; continue; }
    const linked = [...new Set(t.executions.map((e) => execToTrade.get(e.fingerprint)).filter(Boolean))] as string[];
    if (linked.length > 1) {
      errors.push({ row: t.sourceRows[0] ?? 0, message: `${t.symbol}: executions belong to ${linked.length} different existing trades; skipped.` });
      continue;
    }
    const existingId = linked[0] ?? null;

    let inst = instruments.get(t.symbol);
    if (!inst) {
      const s = settings.get(t.symbol);
      if (!s) { errors.push({ row: t.sourceRows[0] ?? 0, message: `${t.symbol}: asset class not specified.` }); continue; }
      inst = await ensureInstrument(sb, t.symbol, s.assetClass, s.quoteCurrency ?? account.currency);
      instruments.set(t.symbol, inst);
    }
    const fxKey = `${inst.quote_currency}/${account.currency}`;
    if (!fxCache.has(fxKey)) fxCache.set(fxKey, await loadFxLookup(sb, inst.quote_currency, account.currency, profile.fx_max_stale_days));

    // Merging into an existing trade keeps the user's risk inputs and journal.
    let prev: TradeRow | null = null;
    if (existingId) {
      const { data } = await sb.from("trades").select(TRADE_COLUMNS).eq("id", existingId).single();
      prev = data as unknown as TradeRow | null;
    }
    const stopLoss = prev?.stop_loss ?? t.stopLoss;
    const takeProfit = prev?.take_profit ?? t.takeProfit;

    let calc;
    try {
      calc = computeTrade({
        direction: t.direction,
        executions: t.executions,
        instrument: instrumentToSpec(inst),
        accountCurrency: account.currency,
        stopLoss, takeProfit, swap: t.swap, brokerNetPnl: t.brokerNetPnl,
        manualInitialRisk: prev?.manual_initial_risk ?? null,
        matchingPolicy: profile.matching_policy, breakevenTolerance: profile.breakeven_tolerance,
      }, fxCache.get(fxKey));
    } catch (e) {
      errors.push({ row: t.sourceRows[0] ?? 0, message: e instanceof TradeCalculationError ? e.message : String(e) });
      continue;
    }
    if (!calc.netPnl && calc.status === "closed") unavailablePnl++;

    const { trade_tags: _tags, activity_at: _act, created_at: _c, updated_at: _u, ...prevFields } = prev ?? ({} as Partial<TradeRow>);
    const payload: Record<string, unknown> = {
      ...prevFields,
      id: existingId,
      account_id: account.id,
      instrument_id: inst.id,
      import_batch_id: batch.id,
      symbol: t.symbol,
      asset_class: inst.asset_class,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      swap: t.swap ?? "0",
      broker_net_pnl: t.brokerNetPnl,
      external_id: t.executions[0]?.externalId ?? null,
      fingerprint: t.fingerprint,
      ...calcColumns(calc),
    };
    const execRows = t.executions.map((e) => ({
      side: e.side, quantity: e.quantity, price: e.price, executed_at: e.executedAt,
      fee: e.fee ?? "0", commission: e.commission ?? "0", external_id: e.externalId, fingerprint: e.fingerprint,
    }));
    const { error } = await sb.rpc("save_trade", { p_trade: payload, p_executions: execRows, p_tag_ids: null });
    if (error) {
      if (error.code === "23505") duplicates++;
      else errors.push({ row: t.sourceRows[0] ?? 0, message: error.message });
      continue;
    }
    if (existingId) updated++; else imported++;
  }

  await sb.from("import_batches").update({
    imported_count: imported + updated, duplicate_count: duplicates, error_count: errors.length, errors: errors.slice(0, 500),
  }).eq("id", batch.id);

  return { batchId: batch.id, rows: result.rowCount, imported, updated, duplicates, errors, unavailablePnl };
}
