import { format, parseISO, startOfISOWeek } from "date-fns";
import { LineChart } from "lucide-react";
import { DailyPnlBars, EquityCurve, ScoreLine } from "@/components/charts/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { GroupTable } from "@/components/shared/group-table";
import { Kpi } from "@/components/shared/kpi";
import { PageHeader } from "@/components/shared/page-header";
import { ScopeNote } from "@/components/shared/scope-note";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dailySeries, dayKey, equityCurve, groupBy } from "@/lib/analytics";
import { toDailyData, toEquityData } from "@/lib/analytics/chart-data";
import { D, type Dec } from "@/lib/engine";
import { requireUser } from "@/lib/db/session";
import { cn } from "@/lib/utils/cn";
import { money, pct, ratio, rMultiple, tone } from "@/lib/utils/format";
import { loadAnalytics } from "@/server/services/analytics-service";

export const metadata = { title: "Performance" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function PerformancePage() {
  const ctx = await requireUser();
  const data = await loadAnalytics(ctx);
  const { trades, summary: s, currency, tz } = data;
  if (!trades.length) return (<><PageHeader title="Performance" /><EmptyState icon={LineChart} title="No performance data yet" description="Track your equity, drawdown and consistency over time once trades are recorded." /></>);

  const daily = dailySeries(trades, tz);
  const equity = equityCurve(daily, data.startingBalance);
  const closed = trades.filter((t) => t.closedAt);
  const weekly = groupBy(closed, (t) => format(startOfISOWeek(parseISO(dayKey(t.closedAt!, tz))), "yyyy-MM-dd"), (k) => `Week of ${format(parseISO(k), "MMM d, yyyy")}`).sort((a, b) => a.key.localeCompare(b.key));
  const weeklyWin = weekly.map((w) => ({ x: format(parseISO(w.key), "MMM d"), y: w.summary.winRate ? Number(w.summary.winRate) : null }));
  // Drawdown series (from running peak of cumulative P&L).
  let peak = new D(0);
  const ddPoints = equity.map((p) => { const c = new D(p.cumulativePnl); if (c.gt(peak)) peak = c; return { date: p.date, pnl: -peak.minus(c).toNumber(), trades: 0 }; });
  const monthly = new Map<string, Dec>();
  for (const d of daily) monthly.set(d.date.slice(0, 7), (monthly.get(d.date.slice(0, 7)) ?? new D(0)).plus(d.netPnl));
  const years = [...new Set([...monthly.keys()].map((k) => k.slice(0, 4)))].sort().reverse();
  const green = daily.filter((d) => new D(d.netPnl).gt(0)).length;
  const avgDay = daily.length ? daily.reduce((a, d) => a.plus(d.netPnl), new D(0)).div(daily.length).toFixed() : null;

  return (
    <>
      <PageHeader title="Performance" description={`${data.range.label} · ${currency}`} />
      <ScopeNote excluded={data.excluded} currency={currency} unavailable={s.unavailableTrades} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Trading days" value={String(daily.length)} sub={`${green} green · ${daily.length - green} red/flat`} />
        <Kpi label="Day win rate" value={daily.length ? pct((green / daily.length) * 100) : "—"} />
        <Kpi label="Avg daily P&L" value={money(avgDay, currency, { sign: true })} tone={tone(avgDay) === "neutral" ? "neutral" : tone(avgDay)} />
        <Kpi label="Max drawdown" value={money(s.maxDrawdown, currency)} tone={Number(s.maxDrawdown) > 0 ? "loss" : "neutral"} />
        <Kpi label="Profit factor" value={s.profitFactorInfinite ? "∞" : ratio(s.profitFactor)} />
        <Kpi label="Total R" value={rMultiple(s.totalR)} />
      </section>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Equity curve</CardTitle></CardHeader><CardContent><EquityCurve data={toEquityData(equity, data.startingBalance)} currency={currency} showBalance={!!data.startingBalance} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Drawdown from peak</CardTitle></CardHeader><CardContent><DailyPnlBars data={ddPoints} currency={currency} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Weekly win rate</CardTitle></CardHeader><CardContent><ScoreLine data={weeklyWin} label="Win rate %" /></CardContent></Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Daily P&amp;L</CardTitle></CardHeader><CardContent><DailyPnlBars data={toDailyData(daily)} currency={currency} /></CardContent></Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Monthly returns</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted"><tr><th className="py-2 text-left font-medium">Year</th>{MONTHS.map((m) => <th key={m} className="text-right font-medium">{m}</th>)}<th className="text-right font-medium">Total</th></tr></thead>
              <tbody>
                {years.map((y) => {
                  const total = MONTHS.reduce((acc, _, i) => acc.plus(monthly.get(`${y}-${String(i + 1).padStart(2, "0")}`) ?? 0), new D(0));
                  return (
                    <tr key={y} className="num border-t border-line/50">
                      <td className="py-2 font-medium">{y}</td>
                      {MONTHS.map((_, i) => {
                        const v = monthly.get(`${y}-${String(i + 1).padStart(2, "0")}`);
                        return <td key={i} className={cn("px-1 text-right", !v ? "text-muted" : v.gt(0) ? "text-profit" : v.lt(0) ? "text-loss" : "text-fg-2")}>{v ? money(v.toFixed(), currency, { sign: true, compact: true }) : "—"}</td>;
                      })}
                      <td className={cn("text-right font-semibold", total.gt(0) ? "text-profit" : total.lt(0) ? "text-loss" : "")}>{money(total.toFixed(), currency, { sign: true, compact: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Weekly breakdown</CardTitle></CardHeader><CardContent><GroupTable rows={[...weekly].reverse()} currency={currency} label="Week" /></CardContent></Card>
      </div>
    </>
  );
}
