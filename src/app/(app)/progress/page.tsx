import { addDays, format, parseISO, startOfISOWeek, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Flame, NotebookPen, ShieldCheck } from "lucide-react";
import { ScoreLine } from "@/components/charts/charts";
import { RuleChecklist } from "@/components/journal/rule-checklist";
import { Kpi } from "@/components/shared/kpi";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dayKey, disciplineScore, summarize, type AnalyticsTrade } from "@/lib/analytics";
import { D } from "@/lib/engine";
import { dayBounds } from "@/lib/db/filters";
import { listJournals, listRules } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { cn } from "@/lib/utils/cn";
import { money, pct, ratio, rMultiple } from "@/lib/utils/format";
import { loadPeriod } from "@/server/services/period-service";

export const metadata = { title: "Progress Tracker" };

export default async function ProgressPage() {
  const ctx = await requireUser();
  const tz = ctx.profile.timezone;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const t0 = parseISO(today);
  const from = format(addDays(startOfISOWeek(t0), -7 * 11), "yyyy-MM-dd");
  const from30 = format(addDays(t0, -29), "yyyy-MM-dd");
  const { fromUtc } = dayBounds(from < format(subMonths(t0, 2), "yyyy-MM-01") ? from : format(subMonths(t0, 2), "yyyy-MM-01"), tz);
  const { toUtc } = dayBounds(today, tz);
  const [period, rules, journals, { data: checkRows }] = await Promise.all([
    loadPeriod(ctx, fromUtc, toUtc),
    listRules(ctx.supabase),
    listJournals(ctx.supabase, format(addDays(t0, -365), "yyyy-MM-dd"), today),
    ctx.supabase.from("rule_checks").select("rule_id,check_date,followed").gte("check_date", from30).lte("check_date", today),
  ]);
  const { trades, currency } = period;
  const activeRules = rules.filter((r) => r.is_active);
  const checks = checkRows ?? [];
  const todayChecks = Object.fromEntries(checks.filter((c) => c.check_date === today).map((c) => [c.rule_id, c.followed]));

  // Streaks
  const jDates = new Set(journals.map((j) => j.journal_date));
  let journalStreak = 0;
  for (let d = jDates.has(today) ? t0 : addDays(t0, -1); jDates.has(format(d, "yyyy-MM-dd")); d = addDays(d, -1)) journalStreak++;
  const byDay = new Map<string, { followed: number; total: number }>();
  for (const c of checks) { const v = byDay.get(c.check_date) ?? { followed: 0, total: 0 }; v.total++; if (c.followed) v.followed++; byDay.set(c.check_date, v); }
  let ruleStreak = 0;
  for (let d = byDay.has(today) ? t0 : addDays(t0, -1); ; d = addDays(d, -1)) {
    const v = byDay.get(format(d, "yyyy-MM-dd"));
    if (!v || v.followed !== v.total) break;
    ruleStreak++;
  }
  const last30 = Array.from({ length: 30 }, (_, i) => format(addDays(t0, -29 + i), "yyyy-MM-dd"));

  // Weekly trend (12 weeks)
  const weeks = Array.from({ length: 12 }, (_, i) => format(addDays(startOfISOWeek(t0), -7 * (11 - i)), "yyyy-MM-dd"));
  const weekOf = (t: AnalyticsTrade) => format(startOfISOWeek(parseISO(dayKey(t.closedAt!, tz))), "yyyy-MM-dd");
  const closed = trades.filter((t) => t.closedAt);
  const weekly = weeks.map((w) => {
    const list = closed.filter((t) => weekOf(t) === w);
    return { week: w, s: summarize(list), discipline: disciplineScore(list) };
  });

  // Month vs previous month
  const thisMonth = today.slice(0, 7);
  const prevMonth = format(subMonths(t0, 1), "yyyy-MM");
  const inMonth = (m: string) => closed.filter((t) => dayKey(t.closedAt!, tz).startsWith(m));
  const cm = summarize(inMonth(thisMonth)), pm = summarize(inMonth(prevMonth));
  const delta = (a: string | null, b: string | null) => (a && b ? new D(a).minus(b) : null);
  const dWin = delta(cm.winRate, pm.winRate), dExp = delta(cm.expectancy, pm.expectancy), dR = delta(cm.avgR, pm.avgR);

  return (
    <>
      <PageHeader title="Progress Tracker" description="Process over outcome: track rule adherence, journaling consistency and how your key metrics trend week by week." />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Journal streak" value={<span className="flex items-center gap-2"><NotebookPen className="size-5 text-gold" />{journalStreak} day{journalStreak === 1 ? "" : "s"}</span>} />
        <Kpi label="Rule streak" value={<span className="flex items-center gap-2"><Flame className="size-5 text-gold" />{ruleStreak} day{ruleStreak === 1 ? "" : "s"}</span>} sub="Days with every checked rule followed" />
        <Kpi label="Discipline (this month)" value={<span className="flex items-center gap-2"><ShieldCheck className="size-5 text-gold" />{disciplineScore(inMonth(thisMonth)) ?? "—"}</span>} />
        <Kpi label="Rules adherence (30d)" value={(() => { let f = 0, t = 0; byDay.forEach((v) => { f += v.followed; t += v.total; }); return t ? pct((f / t) * 100) : "—"; })()} />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader><CardTitle>Today&apos;s rules</CardTitle><span className="text-xs text-muted">{format(t0, "EEE, MMM d")}</span></CardHeader>
          <CardContent><RuleChecklist rules={activeRules} date={today} checks={todayChecks} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Last 30 days</CardTitle><span className="text-xs text-muted">Rule adherence · journal</span></CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-1.5">
              {last30.map((d) => {
                const v = byDay.get(d);
                const r = v ? v.followed / v.total : null;
                return (
                  <div key={d} title={`${d}: ${v ? `${v.followed}/${v.total} rules followed` : "no check"}${jDates.has(d) ? " · journaled" : ""}`}
                    className={cn("relative flex aspect-square items-center justify-center rounded-md text-[10px] text-fg-2", r === null ? "bg-elevated/50" : r === 1 ? "bg-profit/40" : r >= 0.5 ? "bg-gold/30" : "bg-loss/40")}>
                    {Number(d.slice(8))}
                    {jDates.has(d) && <span className="absolute bottom-0.5 right-0.5 size-1 rounded-full bg-fg" />}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted"><span><span className="mr-1 inline-block size-2 rounded-sm bg-profit/40" />All followed</span><span><span className="mr-1 inline-block size-2 rounded-sm bg-gold/30" />Most</span><span><span className="mr-1 inline-block size-2 rounded-sm bg-loss/40" />Under half</span><span>• dot = journaled</span></p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>This month vs last month</CardTitle><span className="text-xs text-muted">{currency}</span></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            ["Net P&L", <Pnl key="a" value={cm.netPnl} currency={currency} />, <Pnl key="b" value={pm.netPnl} currency={currency} />, null],
            ["Win rate", pct(cm.winRate), pct(pm.winRate), dWin ? `${dWin.gte(0) ? "+" : ""}${dWin.toFixed(1)} pts` : null],
            ["Expectancy", money(cm.expectancy, currency, { sign: true }), money(pm.expectancy, currency, { sign: true }), dExp ? money(dExp.toFixed(), currency, { sign: true }) : null],
            ["Avg R", rMultiple(cm.avgR), rMultiple(pm.avgR), dR ? `${dR.gte(0) ? "+" : ""}${dR.toFixed(2)}R` : null],
            ["Profit factor", cm.profitFactorInfinite ? "∞" : ratio(cm.profitFactor), pm.profitFactorInfinite ? "∞" : ratio(pm.profitFactor), null],
          ].map(([label, now, prev, d]) => (
            <div key={String(label)}>
              <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
              <p className="num mt-1 text-lg font-semibold">{now}</p>
              <p className="num text-xs text-fg-2">Last month {prev}{d ? <span className="ml-1 text-fg">({d})</span> : null}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Weekly win rate</CardTitle></CardHeader><CardContent><ScoreLine data={weekly.map((w) => ({ x: format(parseISO(w.week), "MMM d"), y: w.s.winRate ? Number(w.s.winRate) : null }))} label="Win rate %" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Weekly discipline score</CardTitle></CardHeader><CardContent><ScoreLine data={weekly.map((w) => ({ x: format(parseISO(w.week), "MMM d"), y: w.discipline }))} label="Discipline" /></CardContent></Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Week by week</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-right"><th className="py-2 text-left font-medium">Week of</th><th className="font-medium">Trades</th><th className="font-medium">Net P&amp;L</th><th className="font-medium">Win rate</th><th className="font-medium">Avg R</th><th className="font-medium">Discipline</th></tr></thead>
              <tbody>
                {[...weekly].reverse().map((w) => (
                  <tr key={w.week} className="num border-b border-line/50 text-right text-fg-2 last:border-0">
                    <td className="py-2 text-left text-fg">{format(parseISO(w.week), "MMM d, yyyy")}</td>
                    <td>{w.s.totalTrades || "—"}</td><td>{w.s.totalTrades ? <Pnl value={w.s.netPnl} currency={currency} /> : "—"}</td>
                    <td>{pct(w.s.winRate)}</td><td>{rMultiple(w.s.avgR)}</td><td>{w.discipline ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
