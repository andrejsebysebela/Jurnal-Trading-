import { formatInTimeZone } from "date-fns-tz";
import { AppShell } from "@/components/layout/app-shell";
import type { Notice } from "@/components/layout/topbar";
import { propStatus } from "@/lib/analytics";
import { getGlobalFilters, listAccounts, listTrades, toAnalytics } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { fill } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { rangeLabel } from "@/lib/i18n/range";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  const { supabase, user, profile } = ctx;
  const { t, f } = await getI18n();
  const [accounts, filters] = await Promise.all([listAccounts(supabase), getGlobalFilters()]);

  const notices: Notice[] = [];
  if (!accounts.length) notices.push({ id: "no-account", title: t.notices.createAccountTitle, body: t.notices.createAccountBody, href: "/accounts", tone: "info" });
  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");
  for (const a of accounts.filter((x) => x.account_type === "prop" && x.is_active && (x.max_daily_loss || x.max_total_drawdown))) {
    const trades = toAnalytics(await listTrades(supabase, { accountId: a.id }));
    const s = propStatus(trades, { startingBalance: a.starting_balance, profitTarget: a.profit_target, maxDailyLoss: a.max_daily_loss, maxTotalDrawdown: a.max_total_drawdown, drawdownType: a.drawdown_type }, profile.timezone, today);
    if (s.status === "breached") notices.push({ id: `prop-${a.id}`, title: fill(t.notices.breachedTitle, { name: a.name }), body: t.notices.breachedBody, href: "/accounts", tone: "danger" });
    else if (s.status === "danger") notices.push({ id: `prop-${a.id}`, title: fill(t.notices.dangerTitle, { name: a.name }), body: fill(t.notices.dangerBody, { dd: f.num(s.drawdownUsedPct ?? 0, 0), daily: f.num(s.dailyLossUsedPct ?? 0, 0) }), href: "/accounts", tone: "danger" });
  }

  return (
    <AppShell filters={filters} rangeLabel={rangeLabel(filters, t)} accounts={accounts.map(({ id, name, currency }) => ({ id, name, currency }))} email={user.email ?? ""} displayName={profile.display_name} notices={notices}>
      {children}
    </AppShell>
  );
}
