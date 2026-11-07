import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { Award, Clock, Flame, Layers, ShieldCheck, Target, TrendingDown, TrendingUp, Upload, Wallet, AlertOctagon, Plus } from "lucide-react";
import { DailyPnlBars, EquityCurve, GroupBars, MonthlyBars, WinLossDonut } from "@/components/charts/charts";
import { YearSelect } from "@/components/dashboard/year-select";
import { EmptyState } from "@/components/shared/empty-state";
import { Kpi } from "@/components/shared/kpi";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bestWorstDay, dailySeries, disciplineScore, equityCurve, groupBy, mistakeSummary, monthlySeries } from "@/lib/analytics";
import { toDailyData, toEquityData, toGroupData, toMonthlyData } from "@/lib/analytics/chart-data";
import { requireUser } from "@/lib/db/session";
import { duration, money, pct, ratio, rMultiple, tone } from "@/lib/utils/format";
import { loadAnalytics } from "@/server/services/analytics-service";

export const metadata = { title: "Dashboard" };

function greeting(hour: number) {
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireUser();
  const data = await loadAnalytics(ctx);
  const { summary: s, trades, currency, tz, range, accounts, filters } = data;
  const hour = Number(formatInTimeZone(new Date(), tz, "H"));
  const name = ctx.profile.display_name?.split(" ")[0];
  const account = accounts.find((a) => a.id === filters.accountId);
  const lastUpdate = data.rows.reduce<string | null>((m, r) => (!m || r.updated_at > m ? r.updated_at : m), null);

  const header = (
    <PageHeader
      eyebrow={formatInTimeZone(new Date(), tz, "EEEE, MMMM d")}
      title={`${greeting(hour)}${name ? `, ${name}` : ""}`}
      description={
        <span>
          {range.label} · {account ? account.name : "All accounts"} · {currency}
          {lastUpdate && <span className="text-muted"> · Updated {formatInTimeZone(lastUpdate, tz, "MMM d, HH:mm")}</span>}
        </span>
      }
      actions={<><Button asChild variant="secondary"><Link href="/import"><Upload />Import</Link></Button><Button asChild variant="primary"><Link href="/trades/new"><Plus />Add trade</Link></Button></>}
    />
  );

  if (!trades.length) {
    return (
      <>
        {header}
        <ScopeNote excluded={data.excluded} currency={currency} />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: 1, icon: Wallet, title: "Create an account", body: "Set currency, balance and optional prop firm limits.", href: "/accounts", cta: "Add account", done: accounts.length > 0 },
            { n: 2, icon: Upload, title: "Import your history", body: "Upload a broker CSV and map its columns once.", href: "/import", cta: "Import trades", done: false },
            { n: 3, icon: Layers, title: "Or log a trade", body: "Record entries, exits, partials, risk and notes.", href: "/trades/new", cta: "Add trade", done: false },
          ].map((step) => (
            <Card key={step.n} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg border border-line bg-elevated"><step.icon className="size-4 text-gold" /></div>
                <span className={`text-xs ${step.done ? "text-profit" : "text-muted"}`}>{step.done ? "Done" : `Step ${step.n}`}</span>
              </div>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-fg-2">{step.body}</p>
              <Button asChild variant={step.n === 1 && !step.done ? "primary" : "secondary"} size="sm" className="mt-4"><Link href={step.href}>{step.cta}</Link></Button>
            </Card>
          ))}
        </div>
        <EmptyState className="mt-6" icon={TrendingUp} title="No trades in this period" description="Your equity curve, KPIs and insights appear here as soon as trades are recorded for the selected range and account." />
      </>
    );
  }

  const { year: yearParam } = await searchParams;
  const daily = dailySeries(trades, tz);
  const equity = equityCurve(daily, data.startingBalance);
  const years = [...new Set(daily.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a);
  const year = years.includes(Number(yearParam)) ? Number(yearParam) : years[0] ?? new Date().getFullYear();
  const monthly = monthlySeries(daily, year);
  const byStrategy = groupBy(trades, (t) => t.strategyName ?? "No strategy");
  const byInstrument = groupBy(trades, (t) => t.symbol);
  const byDirection = groupBy(trades, (t) => t.direction, (k) => (k === "long" ? "Long" : "Short"));
  const { best, worst } = bestWorstDay(daily);
  const discipline = disciplineScore(trades);
  const topMistake = mistakeSummary(trades)[0];
  const bestInstrument = byInstrument.find((g) => Number(g.summary.netPnl) > 0);
  const bestStrategy = byStrategy.find((g) => g.key !== "No strategy" && Number(g.summary.netPnl) > 0);
  const m = (v: string | null) => money(v, currency, { sign: true });

  return (
    <>
      {header}
      <ScopeNote excluded={data.excluded} currency={currency} unavailable={s.unavailableTrades} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Key metrics">
        <Kpi testId="kpi-net" label="Net P&L" value={m(s.netPnl)} tone={tone(s.netPnl) === "neutral" ? "neutral" : tone(s.netPnl)} sub={`${s.closedTrades - s.unavailableTrades} closed trades`} />
        <Kpi label="Gross P&L" value={m(s.grossPnl)} sub={`Fees ${money(s.fees, currency)}`} hint="Before commissions and fees" />
        <Kpi testId="kpi-winrate" label="Win rate" value={pct(s.winRate)} sub={`${s.wins}W · ${s.losses}L · ${s.breakevens}BE`} hint="Wins ÷ (wins + losses). Breakevens excluded." />
        <Kpi label="Profit factor" value={s.profitFactorInfinite ? "∞" : ratio(s.profitFactor)} tone={s.profitFactor && Number(s.profitFactor) >= 1 ? "profit" : s.profitFactor ? "loss" : "neutral"} hint="Gross profit of winners ÷ gross loss of losers" />
        <Kpi label="Total trades" value={String(s.totalTrades)} sub={s.openTrades ? `${s.openTrades} open` : "All closed"} />
        <Kpi label="Avg winner" value={money(s.avgWinner, currency)} tone="profit" />
        <Kpi label="Avg loser" value={money(s.avgLoser, currency)} tone="loss" />
        <Kpi label="Expectancy" value={m(s.expectancy)} tone={tone(s.expectancy) === "neutral" ? "neutral" : tone(s.expectancy)} hint="Average net P&L per closed trade" />
        <Kpi label="Avg R-multiple" value={rMultiple(s.avgR)} sub={s.rTradeCount ? `${s.rTradeCount} trades with risk` : "Add stop losses to track R"} tone={tone(s.avgR) === "neutral" ? "neutral" : tone(s.avgR)} />
        <Kpi label="Max drawdown" value={money(s.maxDrawdown, currency)} sub={s.maxDrawdownPct ? pct(s.maxDrawdownPct, 2) + " of peak" : "Peak-to-trough, realized"} tone={Number(s.maxDrawdown) > 0 ? "loss" : "neutral"} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Equity curve</CardTitle><span className="num text-sm"><Pnl value={equity.at(-1)?.cumulativePnl} currency={currency} /></span></CardHeader>
          <CardContent><EquityCurve data={toEquityData(equity, data.startingBalance)} currency={currency} showBalance={!!data.startingBalance} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Win / loss distribution</CardTitle></CardHeader>
          <CardContent className="flex h-[300px] items-center justify-center"><WinLossDonut wins={s.wins} losses={s.losses} breakevens={s.breakevens} /></CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Daily P&amp;L</CardTitle><span className="text-xs text-muted">{daily.length} trading days</span></CardHeader>
          <CardContent><DailyPnlBars data={toDailyData(daily.slice(-90))} currency={currency} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Monthly performance</CardTitle><YearSelect years={years} value={year} /></CardHeader>
          <CardContent><MonthlyBars data={toMonthlyData(monthly)} currency={currency} /></CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>By strategy</CardTitle><Link href="/strategies" className="text-xs text-gold hover:text-gold-hover">Details</Link></CardHeader>
          <CardContent><GroupBars data={toGroupData(byStrategy, 8)} currency={currency} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By instrument</CardTitle><Link href="/instruments" className="text-xs text-gold hover:text-gold-hover">Details</Link></CardHeader>
          <CardContent><GroupBars data={toGroupData(byInstrument, 8)} currency={currency} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Long vs short</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <GroupBars data={toGroupData(byDirection)} currency={currency} height={100} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {byDirection.map((g) => (
                <div key={g.key} className="rounded-lg bg-elevated/60 p-3">
                  <p className="text-xs text-muted">{g.label}</p>
                  <p className="num mt-1 font-semibold"><Pnl value={g.summary.netPnl} currency={currency} /></p>
                  <p className="num text-xs text-fg-2">{g.summary.totalTrades} trades · {pct(g.summary.winRate)} win</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Insights">
        <Insight icon={TrendingUp} label="Best day" value={best ? <Pnl value={best.netPnl} currency={currency} /> : "—"} sub={best ? <Link className="hover:text-gold" href={`/calendar/${best.date}`}>{best.date}</Link> : "No profitable day yet"} />
        <Insight icon={TrendingDown} label="Worst day" value={worst ? <Pnl value={worst.netPnl} currency={currency} /> : "—"} sub={worst ? <Link className="hover:text-gold" href={`/calendar/${worst.date}`}>{worst.date}</Link> : "No losing day"} />
        <Insight icon={Award} label="Best instrument" value={bestInstrument?.label ?? "—"} sub={bestInstrument ? m(bestInstrument.summary.netPnl) : "No profitable instrument"} />
        <Insight icon={Target} label="Best strategy" value={bestStrategy?.label ?? "—"} sub={bestStrategy ? m(bestStrategy.summary.netPnl) : "Assign strategies to trades"} />
        <Insight icon={TrendingUp} label="Largest winner" value={<Pnl value={s.largestWinner} currency={currency} />} sub={<>Largest loser <Pnl value={s.largestLoser} currency={currency} /></>} />
        <Insight icon={Flame} label="Current streak" value={s.currentStreak.type ? `${s.currentStreak.count} ${s.currentStreak.type === "win" ? "win" : "loss"}${s.currentStreak.count > 1 ? (s.currentStreak.type === "win" ? "s" : "es") : ""}` : "—"} sub={`Best ${s.longestWinStreak}W · worst ${s.longestLossStreak}L`} />
        <Insight icon={Clock} label="Avg holding time" value={duration(s.avgHoldingSeconds)} sub="Closed trades" />
        <Insight icon={ShieldCheck} label="Discipline score" value={discipline === null ? "—" : `${discipline}/100`} sub={discipline === null ? "Rate discipline or rule compliance" : "Rules followed & discipline rating"} />
        <Insight icon={AlertOctagon} label="Most common mistake" value={topMistake?.mistake ?? "—"} sub={topMistake ? <>{topMistake.count}× · <Pnl value={topMistake.netPnl} currency={currency} /></> : "Tag mistakes on trades"} />
        <Insight icon={Layers} label="Total R" value={rMultiple(s.totalR)} sub={`${s.rTradeCount} trades with defined risk`} />
      </section>
    </>
  );
}

function Insight({ icon: Icon, label, value, sub }: { icon: typeof Award; label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-elevated"><Icon className="size-4 text-gold" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="num mt-0.5 truncate text-[15px] font-semibold text-fg">{value}</p>
        <p className="num truncate text-xs text-fg-2">{sub}</p>
      </div>
    </Card>
  );
}
