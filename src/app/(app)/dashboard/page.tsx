import { formatInTimeZone } from "date-fns-tz";
import { BarChart3, Layers, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { AccountSummary } from "@/components/accounts/account-summary";
import { DailyPnlBars, EquityCurve, WinLossDonut } from "@/components/charts/charts";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { SummaryKpis } from "@/components/stats/kpis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dailySeries, equityCurve, groupBy } from "@/lib/analytics";
import { toDailyData, toEquityData } from "@/lib/analytics/chart-data";
import { listTrades, toAnalytics } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { fill, plural } from "@/lib/i18n/config";
import { rangeLabel } from "@/lib/i18n/range";
import { getI18n } from "@/lib/i18n/server";
import { loadAnalytics } from "@/server/services/analytics-service";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.dashboard };
}

export default async function DashboardPage() {
  const ctx = await requireUser();
  const { t, f } = await getI18n();
  const data = await loadAnalytics(ctx);
  const { summary: s, trades, rows, currency, tz, accounts, filters } = data;
  const hour = Number(formatInTimeZone(new Date(), tz, "H"));
  const greet = hour < 5 || hour >= 18 ? t.dashboard.evening : hour < 12 ? t.dashboard.morning : t.dashboard.afternoon;
  const name = ctx.profile.display_name?.split(" ")[0];
  const account = accounts.find((a) => a.id === filters.accountId);
  const lastUpdate = rows.reduce<string | null>((m, r) => (!m || r.updated_at > m ? r.updated_at : m), null);
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");

  const header = (
    <PageHeader
      eyebrow={f.date(new Date().toISOString(), tz, "EEEE d. MMMM")}
      title={`${greet}${name ? `, ${name}` : ""}`}
      description={<span>{rangeLabel(filters, t)} · {account ? account.name : t.topbar.allAccounts} · {currency}{lastUpdate && <span className="text-muted"> · {fill(t.dashboard.updated, { time: f.date(lastUpdate, tz, "d MMM, HH:mm") })}</span>}</span>}
      actions={<Button asChild variant="primary"><Link href="/trades/new"><Plus />{t.topbar.addTrade}</Link></Button>}
    />
  );

  // Account overview: all-time stats per account (independent of the date range).
  const shown = (filters.accountId === "all" ? accounts.filter((a) => a.is_active) : accounts.filter((a) => a.id === filters.accountId)).slice(0, 6);
  const allTrades = shown.length ? toAnalytics(await listTrades(ctx.supabase, { accountId: filters.accountId })) : [];
  const accountsCard = shown.length > 0 && (
    <Card className="mt-4">
      <CardHeader><CardTitle>{t.dashboard.accountsOverview}</CardTitle><Link href="/accounts" className="text-xs text-gold hover:text-gold-hover">{t.dashboard.viewAll}</Link></CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {shown.map((a) => (
          <div key={a.id} className="rounded-xl border border-line/70 p-4" data-testid="dashboard-account">
            <p className="mb-3 font-semibold">{a.name}</p>
            <AccountSummary a={a} trades={allTrades.filter((x) => x.accountId === a.id)} t={t} f={f} timeZone={tz} today={today} compact />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (!trades.length) {
    const steps = [
      { n: 1, icon: Wallet, title: t.dashboard.step1Title, body: t.dashboard.step1Body, href: "/accounts", cta: t.accounts.new, done: accounts.length > 0 },
      { n: 2, icon: Layers, title: t.dashboard.step2Title, body: t.dashboard.step2Body, href: "/trades/new", cta: t.topbar.addTrade, done: false },
      { n: 3, icon: BarChart3, title: t.dashboard.step3Title, body: t.dashboard.step3Body, href: "/statistics", cta: t.nav.statistics, done: false },
    ];
    return (
      <>
        {header}
        <ScopeNote excluded={data.excluded} currency={currency} />
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((st) => (
            <Card key={st.n} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg border border-line bg-elevated"><st.icon className="size-4 text-gold" /></div>
                <span className={`text-xs ${st.done ? "text-profit" : "text-muted"}`}>{st.done ? t.dashboard.done : fill(t.dashboard.step, { n: st.n })}</span>
              </div>
              <h3 className="mt-4 text-sm font-semibold">{st.title}</h3>
              <p className="mt-1 text-sm text-fg-2">{st.body}</p>
              <Button asChild variant={(st.n === 1 && !st.done) || (st.n === 2 && accounts.length > 0) ? "primary" : "secondary"} size="sm" className="mt-4"><Link href={st.href}>{st.cta}</Link></Button>
            </Card>
          ))}
        </div>
        {accountsCard}
      </>
    );
  }

  const daily = dailySeries(trades, tz);
  const equity = equityCurve(daily, data.startingBalance);
  const bestPair = groupBy(trades, (x) => x.symbol).find((g) => Number(g.summary.netPnl) > 0);
  const recent = rows.slice(0, 8);
  const accCur = new Map(accounts.map((a) => [a.id, a.currency]));

  return (
    <>
      {header}
      <ScopeNote excluded={data.excluded} currency={currency} />
      <SummaryKpis s={s} currency={currency} t={t} f={f} />
      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>{t.stats.equityCurve}</CardTitle><span className="num text-sm"><Pnl value={equity.at(-1)?.cumulativePnl} currency={currency} /></span></CardHeader>
          <CardContent><EquityCurve data={toEquityData(equity, data.startingBalance)} currency={currency} showBalance={!!data.startingBalance} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.stats.winLoss}</CardTitle>{bestPair && <span className="text-xs text-muted">{t.dashboard.bestPair}: <span className="text-fg">{bestPair.label}</span></span>}</CardHeader>
          <CardContent className="flex h-[300px] items-center justify-center"><WinLossDonut wins={s.wins} losses={s.losses} breakevens={s.breakevens} /></CardContent>
        </Card>
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t.stats.dailyPnl}</CardTitle><span className="text-xs text-muted">{plural(f.locale, daily.length, t.common.days)}</span></CardHeader>
          <CardContent><DailyPnlBars data={toDailyData(daily.slice(-60))} currency={currency} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.dashboard.recentTrades}</CardTitle><Link href="/trades" className="text-xs text-gold hover:text-gold-hover">{t.dashboard.viewAll}</Link></CardHeader>
          <CardContent className="divide-y divide-line/60">
            {recent.map((r) => (
              <Link key={r.id} href={`/trades/${r.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-gold">
                <span className="w-24 shrink-0 text-xs text-muted">{f.date(r.activity_at, tz, "d MMM, HH:mm")}</span>
                <span className="w-20 font-medium">{r.symbol}</span>
                <Badge tone={r.direction === "long" ? "profit" : "loss"}>{r.direction === "long" ? t.common.long : t.common.short}</Badge>
                <span className="ml-auto num text-xs text-fg-2">{f.r(r.r_multiple)}</span>
                <span className="w-28 text-right"><Pnl value={r.net_pnl} currency={accCur.get(r.account_id) ?? currency} /></span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
      {accountsCard}
    </>
  );
}
