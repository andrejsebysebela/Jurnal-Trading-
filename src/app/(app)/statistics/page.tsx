import { BarChart3 } from "lucide-react";
import { DailyPnlBars, EquityCurve, GroupBars, Histogram, MonthlyBars, WinLossDonut } from "@/components/charts/charts";
import { YearSelect } from "@/components/dashboard/year-select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ScopeNote } from "@/components/shared/scope-note";
import { GroupTable } from "@/components/stats/group-table";
import { SummaryKpis } from "@/components/stats/kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { byHour, byWeekday, dailySeries, equityCurve, groupBy, monthlySeries, R_BUCKETS, rBucket } from "@/lib/analytics";
import { toDailyData, toEquityData, toGroupData, toMonthlyData } from "@/lib/analytics/chart-data";
import { requireUser } from "@/lib/db/session";
import { fill } from "@/lib/i18n/config";
import { rangeLabel } from "@/lib/i18n/range";
import { getI18n } from "@/lib/i18n/server";
import { loadAnalytics } from "@/server/services/analytics-service";

export async function generateMetadata() {
  return { title: (await getI18n()).t.statisticsPage.title };
}

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireUser();
  const { t, f } = await getI18n();
  const data = await loadAnalytics(ctx);
  const { trades, summary: s, currency, tz, accounts, filters } = data;
  const header = <PageHeader title={t.statisticsPage.title} description={fill(t.statisticsPage.subtitle, { range: rangeLabel(filters, t), currency })} />;
  if (!trades.length) return <>{header}<ScopeNote excluded={data.excluded} currency={currency} /><EmptyState icon={BarChart3} title={t.statisticsPage.emptyTitle} description={t.statisticsPage.emptyBody} /></>;

  const { year: yearParam } = await searchParams;
  const daily = dailySeries(trades, tz);
  const equity = equityCurve(daily, data.startingBalance);
  const years = [...new Set(daily.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a);
  const year = years.includes(Number(yearParam)) ? Number(yearParam) : years[0];
  const emotions = t.emotions as Record<string, string>;
  const accName = new Map(accounts.map((a) => [a.id, a.name]));

  const byPair = groupBy(trades, (x) => x.symbol);
  const weekday = byWeekday(trades, tz).map((g) => ({ ...g, label: t.stats.weekdays[Number(g.key) - 1] }));
  const hour = byHour(trades, tz);
  const direction = groupBy(trades, (x) => x.direction, (k) => (k === "long" ? t.common.long : t.common.short));
  const emotion = groupBy(trades, (x) => x.emotion ?? "__none", (k) => (k === "__none" ? t.stats.noEmotion : emotions[k] ?? k));
  const account = groupBy(trades, (x) => x.accountId, (k) => accName.get(k) ?? "—");
  const rCounts = R_BUCKETS.map((b) => ({ bucket: b, count: trades.filter((x) => rBucket(x.rMultiple) === b).length, negative: b.startsWith("<") || b.startsWith("-") }));
  const green = daily.filter((d) => Number(d.netPnl) > 0).length;

  return (
    <>
      {header}
      <ScopeNote excluded={data.excluded} currency={currency} />
      <SummaryKpis s={s} currency={currency} t={t} f={f} full />
      <p className="mt-2 text-xs text-muted">{t.stats.tradingDays}: {daily.length} · {t.stats.dayWinRate}: {daily.length ? f.pct((green / daily.length) * 100) : "—"}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader><CardTitle>{t.stats.equityCurve}</CardTitle></CardHeader><CardContent><EquityCurve data={toEquityData(equity, data.startingBalance)} currency={currency} showBalance={!!data.startingBalance} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{t.stats.winLoss}</CardTitle></CardHeader><CardContent className="flex h-[300px] items-center justify-center"><WinLossDonut wins={s.wins} losses={s.losses} breakevens={s.breakevens} /></CardContent></Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle>{t.stats.dailyPnl}</CardTitle></CardHeader><CardContent><DailyPnlBars data={toDailyData(daily.slice(-120))} currency={currency} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{t.stats.monthly}</CardTitle><YearSelect years={years} value={year} /></CardHeader><CardContent><MonthlyBars data={toMonthlyData(monthlySeries(daily, year))} currency={currency} /></CardContent></Card>

        <Card className="xl:col-span-3"><CardHeader><CardTitle>{t.stats.byPair}</CardTitle></CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2"><GroupBars data={toGroupData(byPair, f, 12)} currency={currency} /><GroupTable rows={byPair} currency={currency} label={t.trade.pair} /></CardContent></Card>

        <Card><CardHeader><CardTitle>{t.stats.byWeekday}</CardTitle></CardHeader><CardContent><GroupBars data={toGroupData(weekday, f)} currency={currency} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{t.stats.byHour}</CardTitle></CardHeader><CardContent><GroupBars data={toGroupData(hour, f, 24)} currency={currency} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{t.stats.byDirection}</CardTitle></CardHeader><CardContent><GroupBars data={toGroupData(direction, f)} currency={currency} height={110} /><GroupTable rows={direction} currency={currency} label={t.trade.direction} /></CardContent></Card>

        <Card className="xl:col-span-2"><CardHeader><CardTitle>{t.stats.byEmotion}</CardTitle></CardHeader><CardContent><GroupTable rows={emotion} currency={currency} label={t.trade.emotion} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{t.stats.rDistribution}</CardTitle></CardHeader><CardContent><Histogram data={rCounts} /></CardContent></Card>
        <Card className="xl:col-span-3"><CardHeader><CardTitle>{t.stats.byAccount}</CardTitle></CardHeader><CardContent><GroupTable rows={account} currency={currency} label={t.trade.account} /></CardContent></Card>
      </div>
    </>
  );
}
