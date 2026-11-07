import "server-only";
import { summarize, type AnalyticsTrade } from "@/lib/analytics";
import { displayCurrency, listAccounts, listFilteredTrades, listStrategies, toAnalytics } from "@/lib/db/queries";
import type { UserContext } from "@/lib/db/session";

/**
 * Loads trades for the global filters and scopes them to ONE currency so money
 * is never summed across currencies. With "All accounts" and mixed currencies,
 * only accounts in the base currency are aggregated (others listed as excluded).
 */
export async function loadAnalytics(ctx: UserContext) {
  const [accounts, strategies, { trades: rows, filters, range }] = await Promise.all([
    listAccounts(ctx.supabase),
    listStrategies(ctx.supabase),
    listFilteredTrades(ctx),
  ]);
  const { currency } = displayCurrency(accounts, filters, ctx.profile.base_currency);
  const inScope = new Set(accounts.filter((a) => a.currency === currency).map((a) => a.id));
  const excluded = filters.accountId === "all" ? accounts.filter((a) => a.currency !== currency).map((a) => ({ name: a.name, currency: a.currency })) : [];
  const scopedRows = rows.filter((r) => inScope.has(r.account_id));
  const trades: AnalyticsTrade[] = toAnalytics(scopedRows, strategies);
  const startingBalance =
    filters.accountId !== "all"
      ? accounts.find((a) => a.id === filters.accountId)?.starting_balance ?? null
      : null;
  const summary = summarize(trades, { startingBalance });
  return { accounts, strategies, rows: scopedRows, trades, summary, filters, range, currency, excluded, startingBalance, tz: ctx.profile.timezone };
}
export type AnalyticsData = Awaited<ReturnType<typeof loadAnalytics>>;
