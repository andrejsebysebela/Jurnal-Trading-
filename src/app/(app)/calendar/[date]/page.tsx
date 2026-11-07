import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JournalEditor } from "@/components/journal/journal-editor";
import { Kpi } from "@/components/shared/kpi";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Screenshots } from "@/components/trades/screenshots";
import { summarize } from "@/lib/analytics";
import { dayBounds } from "@/lib/db/filters";
import { getJournal, listRules } from "@/lib/db/queries";
import { tradeTagNames } from "@/lib/db/tag-names";
import { requireUser } from "@/lib/db/session";
import { money, plain, rMultiple, tone } from "@/lib/utils/format";
import { loadPeriod } from "@/server/services/period-service";

export const metadata = { title: "Day view" };

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) notFound();
  const ctx = await requireUser();
  const tz = ctx.profile.timezone;
  const { fromUtc, toUtc } = dayBounds(date, tz);
  const [{ rows, trades, currency, excluded, strategies }, journal, rules] = await Promise.all([loadPeriod(ctx, fromUtc, toUtc), getJournal(ctx.supabase, date), listRules(ctx.supabase)]);
  const s = summarize(trades);
  const d = parseISO(date);
  const prev = format(addDays(d, -1), "yyyy-MM-dd");
  const next = format(addDays(d, 1), "yyyy-MM-dd");
  const strat = new Map(strategies.map((x) => [x.id, x.name]));

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/calendar?month=${date.slice(0, 7)}`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3.5" />Calendar</Link>
          <h1 className="text-2xl font-semibold">{format(d, "EEEE, MMMM d, yyyy")}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm"><Link href={`/calendar/${prev}`}><ChevronLeft />Previous day</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href={`/calendar/${next}`}>Next day<ChevronRight /></Link></Button>
        </div>
      </div>
      <ScopeNote excluded={excluded} currency={currency} unavailable={s.unavailableTrades} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Daily P&L" value={money(s.netPnl, currency, { sign: true })} tone={tone(s.netPnl) === "neutral" ? "neutral" : tone(s.netPnl)} />
        <Kpi label="Trades" value={String(s.totalTrades)} />
        <Kpi label="Winners" value={String(s.wins)} tone="profit" />
        <Kpi label="Losers" value={String(s.losses)} tone="loss" />
        <Kpi label="Average R" value={rMultiple(s.avgR)} />
        <Kpi label="Total fees" value={money(s.fees, currency)} />
      </section>

      <Card className="mt-4">
        <CardHeader><CardTitle>Trades</CardTitle><Link href="/trades/new" className="text-xs text-gold hover:text-gold-hover">Add trade</Link></CardHeader>
        <CardContent className="overflow-x-auto">
          {!rows.length ? <p className="py-6 text-center text-sm text-muted">No trades closed on this day.</p> : (
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-left"><th className="py-2 font-medium">Time</th><th className="font-medium">Instrument</th><th className="font-medium">Side</th><th className="text-right font-medium">Entry</th><th className="text-right font-medium">Exit</th><th className="text-right font-medium">Net P&amp;L</th><th className="text-right font-medium">R</th><th className="pl-4 font-medium">Strategy</th><th className="font-medium">Mistakes</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="num border-b border-line/50 text-fg-2 last:border-0">
                    <td className="py-2"><Link href={`/trades/${t.id}`} className="text-fg hover:text-gold">{formatInTimeZone(t.opened_at, tz, "HH:mm")}</Link></td>
                    <td className="font-medium text-fg">{t.symbol}</td>
                    <td className={t.direction === "long" ? "text-profit" : "text-loss"}>{t.direction}</td>
                    <td className="text-right">{plain(t.avg_entry_price)}</td><td className="text-right">{plain(t.avg_exit_price)}</td>
                    <td className="text-right font-semibold"><Pnl value={t.net_pnl} currency={currency} /></td>
                    <td className="text-right">{rMultiple(t.r_multiple)}</td>
                    <td className="pl-4">{strat.get(t.strategy_id ?? "") ?? "—"}</td>
                    <td>{tradeTagNames(t, "mistake").map((m) => <Badge key={m} tone="loss" className="mr-1">{m}</Badge>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Daily journal</CardTitle>{journal && <span className="text-xs text-muted">Updated {formatInTimeZone(journal.updated_at, tz, "MMM d, HH:mm")}</span>}</CardHeader>
          <CardContent><JournalEditor key={journal?.updated_at ?? date} date={date} journal={journal} rules={rules.filter((r) => r.is_active).map((r) => r.text)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Screenshots</CardTitle></CardHeader>
          <CardContent>
            {journal ? <Screenshots userId={ctx.user.id} journalId={journal.id} shots={journal.screenshots} /> : <p className="text-sm text-muted">Save the journal first to attach screenshots.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
