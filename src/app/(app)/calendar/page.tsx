import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Kpi } from "@/components/shared/kpi";
import { PageHeader } from "@/components/shared/page-header";
import { ScopeNote } from "@/components/shared/scope-note";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dailySeries, summarize } from "@/lib/analytics";
import { D } from "@/lib/engine";
import { dayBounds } from "@/lib/db/filters";
import { requireUser } from "@/lib/db/session";
import { fill, plural } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils/cn";
import { tone } from "@/lib/utils/format";
import { loadPeriod } from "@/server/services/period-service";

export async function generateMetadata() {
  return { title: (await getI18n()).t.calendar.title };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireUser();
  const { t, f } = await getI18n();
  const tz = ctx.profile.timezone;
  const { month: mParam } = await searchParams;
  const month = mParam && /^\d{4}-\d{2}$/.test(mParam) ? mParam : formatInTimeZone(new Date(), tz, "yyyy-MM");
  const first = parseISO(`${month}-01`);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(first), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }) }).map((d) => format(d, "yyyy-MM-dd"));
  const { trades, currency, excluded } = await loadPeriod(ctx, dayBounds(days[0], tz).fromUtc, dayBounds(days.at(-1)!, tz).toUtc);
  const daily = new Map(dailySeries(trades, tz).map((d) => [d.date, d]));
  const ms = summarize(trades.filter((x) => x.closedAt && formatInTimeZone(x.closedAt, tz, "yyyy-MM") === month));
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const monthDays = [...daily.values()].filter((d) => d.date.startsWith(month));
  const green = monthDays.filter((d) => new D(d.netPnl).gt(0)).length;
  const monthTitle = format(first, "LLLL yyyy", { locale: f.dfLocale });

  return (
    <>
      <PageHeader
        title={t.calendar.title}
        description={fill(t.calendar.subtitle, { tz })}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="icon" aria-label={t.calendar.prevMonth}><Link href={`/calendar?month=${format(addMonths(first, -1), "yyyy-MM")}`}><ChevronLeft /></Link></Button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize">{monthTitle}</span>
            <Button asChild variant="secondary" size="icon" aria-label={t.calendar.nextMonth}><Link href={`/calendar?month=${format(addMonths(first, 1), "yyyy-MM")}`}><ChevronRight /></Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/calendar">{t.common.today}</Link></Button>
          </div>
        }
      />
      <ScopeNote excluded={excluded} currency={currency} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t.calendar.monthPnl} value={f.money(ms.netPnl, currency, { sign: true, kpi: true })} title={f.money(ms.netPnl, currency, { sign: true })} tone={tone(ms.netPnl) === "neutral" ? "neutral" : tone(ms.netPnl)} />
        <Kpi label={t.calendar.tradingDays} value={String(monthDays.length)} sub={fill(t.calendar.greenRed, { green, red: monthDays.length - green })} />
        <Kpi label={t.stats.winRate} value={f.pct(ms.winRate)} sub={plural(f.locale, ms.closedTrades, t.common.trades)} />
        <Kpi label={t.stats.avgR} value={f.r(ms.avgR)} />
      </div>
      <Card className="overflow-x-auto p-3">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[repeat(7,1fr)_110px] gap-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            {t.stats.weekdays.map((d) => <div key={d} className="px-2">{d}</div>)}
            <div className="px-2 text-right">{t.calendar.week}</div>
          </div>
          {weeks.map((week) => {
            const wk = week.reduce((acc, d) => acc.plus(daily.get(d)?.netPnl ?? 0), new D(0));
            const wkTrades = week.reduce((n, d) => n + (daily.get(d)?.trades ?? 0), 0);
            return (
              <div key={week[0]} className="grid grid-cols-[repeat(7,1fr)_110px] gap-2 pb-2">
                {week.map((d) => {
                  const day = daily.get(d);
                  const val = day ? new D(day.netPnl) : null;
                  return (
                    <Link key={d} href={`/calendar/${d}`} data-testid={`cal-${d}`}
                      className={cn("flex min-h-[92px] flex-col rounded-lg border p-2 transition-colors", !d.startsWith(month) && "opacity-35",
                        val === null ? "border-line/60 bg-bg/40 hover:border-line" : val.gt(0) ? "border-profit/25 bg-profit/[0.07] hover:border-profit/50" : val.lt(0) ? "border-loss/25 bg-loss/[0.07] hover:border-loss/50" : "border-line bg-elevated/40",
                        d === today && "ring-1 ring-gold/60")}>
                      <span className={cn("text-xs font-medium", d === today ? "text-gold" : "text-fg-2")}>{Number(d.slice(8))}</span>
                      {day && (
                        <div className="mt-auto">
                          <p className={cn("num text-sm font-semibold", val!.gt(0) ? "text-profit" : val!.lt(0) ? "text-loss" : "text-fg-2")}>{f.money(day.netPnl, currency, { sign: true, compact: true })}</p>
                          <p className="num text-[11px] text-muted">{plural(f.locale, day.trades, t.common.trades)} · {day.wins}W {day.losses}L</p>
                        </div>
                      )}
                    </Link>
                  );
                })}
                <div className="flex flex-col items-end justify-center rounded-lg bg-elevated/40 px-2 text-right">
                  {wkTrades ? <><p className={cn("num text-sm font-semibold", wk.gt(0) ? "text-profit" : wk.lt(0) ? "text-loss" : "text-fg-2")}>{f.money(wk.toFixed(), currency, { sign: true, compact: true })}</p><p className="text-[11px] text-muted">{plural(f.locale, wkTrades, t.common.trades)}</p></> : <span className="text-xs text-muted">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
