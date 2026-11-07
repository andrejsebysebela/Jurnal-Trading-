import "server-only";
import { cookies } from "next/headers";
import type { AnalyticsTrade } from "@/lib/analytics";
import { emotionKey } from "@/lib/constants";
import { ACCOUNT_COLUMNS, EXECUTION_COLUMNS, INSTRUMENT_COLUMNS, TRADE_COLUMNS } from "./columns";
import { FILTER_COOKIE, parseFilters, resolveRange, type GlobalFilters } from "./filters";
import type { UserContext } from "./session";
import type { Account, DailyJournal, FxRate, Instrument, Screenshot, Strategy, Tag, TradeRow, TradeWithRelations, TradingRule } from "./types";

type SB = UserContext["supabase"];
const PAGE = 1000;

/** Page through PostgREST's max-rows limit. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function getGlobalFilters(): Promise<GlobalFilters> {
  const store = await cookies();
  return parseFilters(store.get(FILTER_COOKIE)?.value);
}

export async function listAccounts(sb: SB): Promise<Account[]> {
  const { data, error } = await sb.from("accounts").select(ACCOUNT_COLUMNS).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Account[];
}

export async function listInstruments(sb: SB): Promise<Instrument[]> {
  const { data, error } = await sb.from("instruments").select(INSTRUMENT_COLUMNS).order("symbol");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Instrument[];
}

export async function listStrategies(sb: SB): Promise<Strategy[]> {
  const { data, error } = await sb.from("strategies").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Strategy[];
}

export async function listTags(sb: SB): Promise<Tag[]> {
  const { data, error } = await sb.from("tags").select("id,name,kind").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Tag[];
}

export async function listRules(sb: SB): Promise<TradingRule[]> {
  const { data, error } = await sb.from("trading_rules").select("id,text,category,is_active,sort_index").order("sort_index").order("text");
  if (error) throw new Error(error.message);
  return (data ?? []) as TradingRule[];
}

export async function listFxRates(sb: SB): Promise<FxRate[]> {
  const { data, error } = await sb.from("fx_rates").select("id,base,quote,rate_date,source,rate:rate::text").order("rate_date", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as FxRate[];
}

export interface TradeQuery {
  fromUtc?: string | null;
  toUtc?: string | null;
  accountId?: string | "all";
  includeDrafts?: boolean;
  strategyId?: string;
  symbol?: string;
}

export async function listTrades(sb: SB, q: TradeQuery = {}): Promise<TradeRow[]> {
  return fetchAll<TradeRow>((from, to) => {
    let query = sb.from("trades").select(TRADE_COLUMNS).order("activity_at", { ascending: false }).order("id").range(from, to);
    if (q.fromUtc) query = query.gte("activity_at", q.fromUtc);
    if (q.toUtc) query = query.lt("activity_at", q.toUtc);
    if (q.accountId && q.accountId !== "all") query = query.eq("account_id", q.accountId);
    if (!q.includeDrafts) query = query.eq("is_draft", false);
    if (q.strategyId) query = query.eq("strategy_id", q.strategyId);
    if (q.symbol) query = query.eq("symbol", q.symbol);
    return query;
  });
}

/** Trades for the current global filters (date range + account). */
export async function listFilteredTrades(ctx: UserContext, extra: Omit<TradeQuery, "fromUtc" | "toUtc" | "accountId"> = {}) {
  const filters = await getGlobalFilters();
  const range = resolveRange(filters, ctx.profile.timezone);
  const trades = await listTrades(ctx.supabase, { ...extra, fromUtc: range.fromUtc, toUtc: range.toUtc, accountId: filters.accountId });
  return { trades, filters, range };
}

export async function getTrade(sb: SB, id: string): Promise<TradeWithRelations | null> {
  const { data, error } = await sb.from("trades").select(`${TRADE_COLUMNS},executions(${EXECUTION_COLUMNS}),screenshots(*)`).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const t = data as unknown as TradeWithRelations;
  t.executions.sort((a, b) => a.executed_at.localeCompare(b.executed_at) || a.sort_index - b.sort_index);
  t.screenshots = await signScreenshots(sb, t.screenshots);
  return t;
}

export async function signScreenshots(sb: SB, shots: Screenshot[]): Promise<Screenshot[]> {
  if (!shots.length) return shots;
  const { data } = await sb.storage.from("screenshots").createSignedUrls(shots.map((s) => s.storage_path), 3600);
  return shots.map((s, i) => ({ ...s, url: data?.[i]?.signedUrl ?? undefined }));
}

export async function getJournal(sb: SB, date: string): Promise<(DailyJournal & { screenshots: Screenshot[] }) | null> {
  const { data, error } = await sb.from("daily_journals").select("*,screenshots(*)").eq("journal_date", date).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const j = data as DailyJournal & { screenshots: Screenshot[] };
  j.screenshots = await signScreenshots(sb, j.screenshots);
  return j;
}

export async function listJournals(sb: SB, fromDate?: string | null, toDate?: string | null): Promise<DailyJournal[]> {
  let q = sb.from("daily_journals").select("id,journal_date,pre_market_plan,post_market_review,notes,emotions,rule_violations,mood,discipline_score,updated_at").order("journal_date", { ascending: false }).limit(1000);
  if (fromDate) q = q.gte("journal_date", fromDate);
  if (toDate) q = q.lte("journal_date", toDate);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyJournal[];
}

/** Map stored trades to the analytics engine shape. */
export function toAnalytics(rows: TradeRow[], strategies: Strategy[] = []): AnalyticsTrade[] {
  const names = new Map(strategies.map((s) => [s.id, s.name]));
  return rows.map((t) => {
    const tags = t.trade_tags ?? [];
    return {
      id: t.id,
      accountId: t.account_id,
      symbol: t.symbol,
      assetClass: t.asset_class ?? "",
      direction: t.direction,
      status: t.status,
      openedAt: t.opened_at,
      closedAt: t.closed_at,
      netPnl: t.net_pnl,
      grossPnl: t.gross_pnl,
      fees: t.fees,
      rMultiple: t.r_multiple,
      holdingSeconds: t.holding_seconds,
      outcome: t.outcome,
      strategyId: t.strategy_id,
      strategyName: t.strategy_id ? names.get(t.strategy_id) ?? null : null,
      session: t.session,
      timeframe: t.timeframe,
      tags: tags.filter((x) => x.tags?.kind === "tag").map((x) => x.tags!.name),
      mistakes: tags.filter((x) => x.tags?.kind === "mistake").map((x) => x.tags!.name),
      ruleCompliant: t.rule_compliant,
      disciplineRating: t.discipline_rating,
      emotion: emotionKey(t.emotional_state),
    };
  });
}

export { tradeTagNames } from "./tag-names";

/** Display currency for aggregated metrics: the selected account's, else the profile base currency. */
export function displayCurrency(accounts: Account[], filters: GlobalFilters, base: string): { currency: string; mixed: boolean } {
  if (filters.accountId !== "all") return { currency: accounts.find((a) => a.id === filters.accountId)?.currency ?? base, mixed: false };
  const set = new Set(accounts.map((a) => a.currency));
  return { currency: set.size === 1 ? [...set][0] : base, mixed: set.size > 1 };
}
