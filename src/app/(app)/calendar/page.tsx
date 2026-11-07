import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dailySeries, summarize } from "@/lib/analytics";
import { D } from "@/lib/engine";
import { dayBounds } from "@/lib/db/filters";
import { listJournals } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { cn } from "@/lib/utils/cn";
import { money, pct } from "@/lib/utils/format";
import { loadPeriod } from "@/server/services/period-service";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireUser();
  const tz = ctx.profile.timezone;
  const { month: mParam } = await searchParams;
  const month = mParam && /^\d{4}-\d{2}$/.test(mParam) ? mParam : formatInTimeZone(new Date(), tz, "yyyy-MM");
  const first = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => format(d, "yyyy-MM-dd"));
  const { fromUtc } = dayBounds(days[0], tz);
  const { toUtc } = dayBounds(days.at(-1)!, tz);
  const [{ trades, currency, excluded }, journals] = await Promise.all([loadPeriod(ctx, fromUtc, toUtc), listJournals(ctx.supabase, days[0], days.at(-1))]);
  const daily = new Map(dailySeries(trades, tz).map((d) => [d.date, d]));
  const journalByDate = new Map(journals.map((j) => [j.journal_date, j]));
  const monthTrades = trades.filter((t) => t.closedAt && formatInTimeZone(t.closedAt, tz, "yyyy-MM") === month);
  const ms = summarize(monthTrades);
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const tradingDays = [...daily.values()].filter((d) => d.date.startsWith(month));
  const greenDays = tradingDays.filter((d) => new D(d.netPnl).gt(0)).length;

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`Daily realized P&L by close date (${tz}). Click a day for the full review.`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="icon" aria-label="Previous month"><Link href={`/calendar?month=${format(addMonths(first, -1), "yyyy-MM")}`}><ChevronLeft /></Link></Button>
            <span className="min-w-36 text-center text-sm font-semibold">{format(first, "MMMM yyyy")}</span>
            <Button asChild variant="secondary" size="icon" aria-label="Next month"><Link href={`/calendar?month=${format(addMonths(first, 1), "yyyy-MM")}`}><ChevronRight /></Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/calendar">Today</Link></Button>
          </div>
        }
      />
      <ScopeNote excluded={excluded} currency={currency} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Summary label="Month net P&L" value={<Pnl value={ms.netPnl} currency={currency} />} />
        <Summary label="Trading days" value={`${tradingDays.length}`} sub={`${greenDays} green · ${tradingDays.length - greenDays} red/flat`} />
        <Summary label="Trades" value={String(ms.closedTrades)} />
        <Summary label="Win rate" value={pct(ms.winRate)} />
        <Summary label="Profit factor" value={ms.profitFactorInfinite ? "∞" : ms.profitFactor ? new D(ms.profitFactor).toFixed(2) : "—"} />
      </div>

      <Card className="overflow-x-auto p-3">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[repeat(7,1fr)_110px] gap-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2">{d}</div>)}
            <div className="px-2 text-right">Week</div>
          </div>
          {weeks.map((week) => {
            const wk = week.reduce((acc, d) => acc.plus(daily.get(d)?.netPnl ?? 0), new D(0));
            const wkTrades = week.reduce((n, d) => n + (daily.get(d)?.trades ?? 0), 0);
            return (
              <div key={week[0]} className="grid grid-cols-[repeat(7,1fr)_110px] gap-2 pb-2">
                {week.map((d) => {
                  const day = daily.get(d);
                  const j = journalByDate.get(d);
                  const inMonth = d.startsWith(month);
                  const v = day ? new D(day.netPnl) : null;
                  return (
                    <Link
                      key={d}
                      href={`/calendar/${d}`}
                      data-testid={`cal-${d}`}
                      className={cn(
                        "group flex min-h-[96px] flex-col rounded-lg border p-2 transition-colors",
                        !inMonth && "opacity-35",
                        v === null ? "border-line/60 bg-bg/40 hover:border-line" : v.gt(0) ? "border-profit/25 bg-profit/[0.07] hover:border-profit/50" : v.lt(0) ? "border-loss/25 bg-loss/[0.07] hover:border-loss/50" : "border-line bg-elevated/40",
                        d === today && "ring-1 ring-gold/60",
                      )}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn("font-medium", d === today ? "text-gold" : "text-fg-2")}>{Number(d.slice(8))}</span>
                        {j && <span className="size-1.5 rounded-full bg-gold" title="Journal entry" />}
                      </div>
                      {day && (
                        <div className="mt-auto">
                          <p className={cn("num text-sm font-semibold", v!.gt(0) ? "text-profit" : v!.lt(0) ? "text-loss" : "text-fg-2")}>{money(day.netPnl, currency, { sign: true, compact: true })}</p>
                          <p className="num text-[11px] text-muted">{day.trades} trade{day.trades > 1 ? "s" : ""} · {day.wins}W {day.losses}L</p>
                          {j?.discipline_score != null && <p className="num text-[11px] text-gold/80">Discipline {j.discipline_score}</p>}
                        </div>
                      )}
                    </Link>
                  );
                })}
                <div className="flex flex-col items-end justify-center rounded-lg bg-elevated/40 px-2 text-right">
                  {wkTrades ? <><p className={cn("num text-sm font-semibold", wk.gt(0) ? "text-profit" : wk.lt(0) ? "text-loss" : "text-fg-2")}>{money(wk.toFixed(), currency, { sign: true, compact: true })}</p><p className="text-[11px] text-muted">{wkTrades} trades</p></> : <span className="text-xs text-muted">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function Summary({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-fg-2">{sub}</p>}
    </Card>
  );
}
