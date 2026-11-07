import { formatInTimeZone } from "date-fns-tz";
import { AppShell } from "@/components/layout/app-shell";
import type { Notice } from "@/components/layout/topbar";
import { propStatus } from "@/lib/analytics";
import { getGlobalFilters, listAccounts, listTrades, toAnalytics } from "@/lib/db/queries";
import { resolveRange } from "@/lib/db/filters";
import { requireUser } from "@/lib/db/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  const { supabase, user, profile } = ctx;
  const [accounts, filters] = await Promise.all([listAccounts(supabase), getGlobalFilters()]);
  const range = resolveRange(filters, profile.timezone);

  const notices: Notice[] = [];
  const [{ count: unreviewed }, { count: unavailable }] = await Promise.all([
    supabase.from("instruments").select("id", { count: "exact", head: true }).eq("reviewed", false),
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("pnl_source", "unavailable").eq("status", "closed").eq("is_draft", false),
  ]);
  if (!accounts.length) notices.push({ id: "no-account", title: "Create your first account", body: "Trades are recorded per account.", href: "/accounts", tone: "info" });
  if (unreviewed) notices.push({ id: "instruments", title: `${unreviewed} instrument spec${unreviewed > 1 ? "s" : ""} to review`, body: "Confirm contract size, tick value and currency.", href: "/instruments", tone: "warning" });
  if (unavailable) notices.push({ id: "pnl", title: `${unavailable} trade${unavailable > 1 ? "s" : ""} without P&L`, body: "Missing instrument specification or FX rate.", href: "/trades?pnl=unavailable", tone: "warning" });

  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");
  for (const a of accounts.filter((x) => x.account_type === "prop" && x.is_active && (x.max_daily_loss || x.max_total_drawdown))) {
    const trades = toAnalytics(await listTrades(supabase, { accountId: a.id }));
    const s = propStatus(trades, { startingBalance: a.starting_balance, profitTarget: a.profit_target, maxDailyLoss: a.max_daily_loss, maxTotalDrawdown: a.max_total_drawdown, drawdownType: a.drawdown_type }, profile.timezone, today);
    if (s.status === "breached") notices.push({ id: `prop-${a.id}`, title: `${a.name}: limit breached`, body: "A prop firm loss limit has been reached.", href: "/accounts", tone: "danger" });
    else if (s.status === "danger") notices.push({ id: `prop-${a.id}`, title: `${a.name}: close to limit`, body: `Drawdown ${Math.round(s.drawdownUsedPct ?? 0)}% · daily loss ${Math.round(s.dailyLossUsedPct ?? 0)}% used.`, href: "/accounts", tone: "danger" });
  }

  return (
    <AppShell filters={filters} rangeLabel={range.label} accounts={accounts.map(({ id, name, currency }) => ({ id, name, currency }))} email={user.email ?? ""} displayName={profile.display_name} notices={notices}>
      {children}
    </AppShell>
  );
}
