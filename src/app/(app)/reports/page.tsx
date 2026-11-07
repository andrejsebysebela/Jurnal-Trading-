import { BarChart3 } from "lucide-react";
import { GroupBars, Histogram } from "@/components/charts/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { GroupTable } from "@/components/shared/group-table";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { byHour, byWeekday, groupBy, holdingBucket, mistakeSummary, R_BUCKETS, rBucket } from "@/lib/analytics";
import { toGroupData } from "@/lib/analytics/chart-data";
import { requireUser } from "@/lib/db/session";
import { duration, money, pct, ratio, rMultiple } from "@/lib/utils/format";
import { loadAnalytics } from "@/server/services/analytics-service";

export const metadata = { title: "Reports" };
const HOLD_ORDER = ["< 5m", "5–30m", "30–60m", "1–4h", "4–24h", "1–7d", "> 7d"];

export default async function ReportsPage() {
  const ctx = await requireUser();
  const data = await loadAnalytics(ctx);
  const { trades, summary: s, currency, tz } = data;
  if (!trades.length) {
    return (<><PageHeader title="Reports" /><EmptyState icon={BarChart3} title="No trades to report on" description="Reports break down your performance by time, setup, risk and behaviour once you have trades in the selected range." /></>);
  }
  const weekday = byWeekday(trades, tz);
  const hour = byHour(trades, tz);
  const session = groupBy(trades, (t) => t.session ?? "Unassigned");
  const timeframe = groupBy(trades, (t) => t.timeframe ?? "Unassigned");
  const hold = groupBy(trades.filter((t) => t.status === "closed"), (t) => holdingBucket(t.holdingSeconds)).sort((a, b) => HOLD_ORDER.indexOf(a.key) - HOLD_ORDER.indexOf(b.key));
  const tags = groupBy(trades, (t) => t.tags);
  const mistakes = mistakeSummary(trades);
  const compliance = groupBy(trades, (t) => (t.ruleCompliant === null ? "Not reviewed" : t.ruleCompliant ? "Rules followed" : "Rules broken"));
  const rCounts = R_BUCKETS.map((b) => ({ bucket: b, count: trades.filter((t) => rBucket(t.rMultiple) === b).length, negative: b.startsWith("<") || b.startsWith("-") }));

  const rows: [string, React.ReactNode][] = [
    ["Net P&L", <Pnl key="n" value={s.netPnl} currency={currency} />], ["Gross P&L", <Pnl key="g" value={s.grossPnl} currency={currency} />],
    ["Total fees", money(s.fees, currency)], ["Gross profit (winners)", money(s.grossProfit, currency)], ["Gross loss (losers)", money(s.grossLoss, currency)],
    ["Total trades", s.totalTrades], ["Closed / open", `${s.closedTrades} / ${s.openTrades}`], ["P&L unavailable", s.unavailableTrades],
    ["Wins / losses / breakeven", `${s.wins} / ${s.losses} / ${s.breakevens}`], ["Win rate", pct(s.winRate)],
    ["Profit factor", s.profitFactorInfinite ? "∞" : ratio(s.profitFactor)], ["Expectancy per trade", money(s.expectancy, currency, { sign: true })],
    ["Average winner", money(s.avgWinner, currency)], ["Average loser", money(s.avgLoser, currency)],
    ["Largest winner", money(s.largestWinner, currency)], ["Largest loser", money(s.largestLoser, currency)],
    ["Average R", rMultiple(s.avgR)], ["Total R", rMultiple(s.totalR)], ["Trades with defined risk", s.rTradeCount],
    ["Max drawdown", money(s.maxDrawdown, currency)], ["Average holding time", duration(s.avgHoldingSeconds)],
    ["Longest win streak", s.longestWinStreak], ["Longest loss streak", s.longestLossStreak],
  ];

  return (
    <>
      <PageHeader title="Reports" description={`${data.range.label} · ${currency} · times in ${tz}`} />
      <ScopeNote excluded={data.excluded} currency={currency} unavailable={s.unavailableTrades} />
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="time">Days &amp; times</TabsTrigger>
          <TabsTrigger value="risk">Risk &amp; R</TabsTrigger>
          <TabsTrigger value="behaviour">Tags &amp; mistakes</TabsTrigger>
          <TabsTrigger value="context">Sessions &amp; timeframes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card><CardContent className="grid gap-x-10 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-line/50 py-2 text-sm"><span className="text-fg-2">{k}</span><span className="num font-medium">{v}</span></div>)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="time" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>By weekday (entry)</CardTitle></CardHeader><CardContent><GroupBars data={toGroupData(weekday)} currency={currency} /><GroupTable rows={weekday} currency={currency} label="Day" /></CardContent></Card>
          <Card><CardHeader><CardTitle>By hour of entry</CardTitle></CardHeader><CardContent><GroupBars data={toGroupData(hour, 24)} currency={currency} /><GroupTable rows={hour} currency={currency} label="Hour" /></CardContent></Card>
          <Card className="xl:col-span-2"><CardHeader><CardTitle>By holding time</CardTitle></CardHeader><CardContent><GroupTable rows={hold} currency={currency} label="Duration" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="risk" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>R-multiple distribution</CardTitle><span className="text-xs text-muted">{s.rTradeCount} trades with risk</span></CardHeader><CardContent><Histogram data={rCounts} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Risk summary</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
            {[["Average R", rMultiple(s.avgR)], ["Total R", rMultiple(s.totalR)], ["Trades without stop/risk", String(s.closedTrades - s.rTradeCount)], ["Max drawdown", money(s.maxDrawdown, currency)], ["Largest loser", money(s.largestLoser, currency)], ["Avg loser vs avg winner", s.avgWinner && s.avgLoser ? `1 : ${(Number(s.avgWinner) / Math.abs(Number(s.avgLoser))).toFixed(2)}` : "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line/50 py-2"><span className="text-fg-2">{k}</span><span className="num">{v}</span></div>
            ))}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="behaviour" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>Mistakes by frequency &amp; cost</CardTitle></CardHeader><CardContent>
            {!mistakes.length ? <p className="py-6 text-center text-sm text-muted">No mistakes tagged in this period.</p> : (
              <table className="w-full text-[13px]"><thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-right"><th className="py-2 text-left font-medium">Mistake</th><th className="font-medium">Occurrences</th><th className="font-medium">Net P&amp;L of trades</th></tr></thead>
                <tbody>{mistakes.map((m) => <tr key={m.mistake} className="num border-b border-line/50 text-right last:border-0"><td className="py-2 text-left text-fg">{m.mistake}</td><td className="text-fg-2">{m.count}</td><td><Pnl value={m.netPnl} currency={currency} /></td></tr>)}</tbody></table>
            )}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Rule compliance</CardTitle></CardHeader><CardContent><GroupTable rows={compliance} currency={currency} label="Compliance" /></CardContent></Card>
          <Card className="xl:col-span-2"><CardHeader><CardTitle>By tag</CardTitle></CardHeader><CardContent><GroupTable rows={tags} currency={currency} label="Tag" empty="No tags in this period." /></CardContent></Card>
        </TabsContent>
        <TabsContent value="context" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>By session</CardTitle></CardHeader><CardContent><GroupTable rows={session} currency={currency} label="Session" /></CardContent></Card>
          <Card><CardHeader><CardTitle>By timeframe</CardTitle></CardHeader><CardContent><GroupTable rows={timeframe} currency={currency} label="Timeframe" /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
