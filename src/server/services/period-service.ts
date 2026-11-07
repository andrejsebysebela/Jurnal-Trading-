import "server-only";
import { listAccounts, listStrategies, listTrades, toAnalytics, getGlobalFilters, displayCurrency } from "@/lib/db/queries";
import type { UserContext } from "@/lib/db/session";

/** Trades between two UTC instants for the selected account (ignores the global date range). */
export async function loadPeriod(ctx: UserContext, fromUtc: string, toUtc: string) {
  const [accounts, strategies, filters] = await Promise.all([listAccounts(ctx.supabase), listStrategies(ctx.supabase), getGlobalFilters()]);
  const { currency } = displayCurrency(accounts, filters, ctx.profile.base_currency);
  const inScope = new Set(accounts.filter((a) => a.currency === currency).map((a) => a.id));
  const rows = (await listTrades(ctx.supabase, { fromUtc, toUtc, accountId: filters.accountId })).filter((r) => inScope.has(r.account_id));
  const excluded = filters.accountId === "all" ? accounts.filter((a) => a.currency !== currency).map((a) => ({ name: a.name, currency: a.currency })) : [];
  return { rows, trades: toAnalytics(rows, strategies), accounts, strategies, currency, excluded };
}
