import { addDays, format, parseISO } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Kpi } from "@/components/shared/kpi";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarize } from "@/lib/analytics";
import { emotionKey } from "@/lib/constants";
import { dayBounds } from "@/lib/db/filters";
import { requireUser } from "@/lib/db/session";
import { fill } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { tone } from "@/lib/utils/format";
import { loadPeriod } from "@/server/services/period-service";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) notFound();
  const ctx = await requireUser();
  const { t, f } = await getI18n();
  const tz = ctx.profile.timezone;
  const { fromUtc, toUtc } = dayBounds(date, tz);
  const { rows, trades, currency, excluded, accounts } = await loadPeriod(ctx, fromUtc, toUtc);
  const s = summarize(trades);
  const d = parseISO(date);
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const emotions = t.emotions as Record<string, string>;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/calendar?month=${date.slice(0, 7)}`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3.5" />{t.calendar.backToCalendar}</Link>
          <h1 className="text-2xl font-semibold capitalize">{format(d, "EEEE d. MMMM yyyy", { locale: f.dfLocale })}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm"><Link href={`/calendar/${format(addDays(d, -1), "yyyy-MM-dd")}`}><ChevronLeft />{t.calendar.prevDay}</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href={`/calendar/${format(addDays(d, 1), "yyyy-MM-dd")}`}>{t.calendar.nextDay}<ChevronRight /></Link></Button>
        </div>
      </div>
      <ScopeNote excluded={excluded} currency={currency} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t.stats.dayPnl} value={f.money(s.netPnl, currency, { sign: true })} tone={tone(s.netPnl) === "neutral" ? "neutral" : tone(s.netPnl)} />
        <Kpi label={t.stats.trades} value={String(s.totalTrades)} sub={fill(t.stats.wlb, { w: s.wins, l: s.losses, b: s.breakevens })} />
        <Kpi label={t.stats.winRate} value={f.pct(s.winRate)} />
        <Kpi label={t.stats.avgR} value={f.r(s.avgR)} />
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>{t.trades.title}</CardTitle><Link href="/trades/new" className="text-xs text-gold hover:text-gold-hover">{t.topbar.addTrade}</Link></CardHeader>
        <CardContent className="overflow-x-auto">
          {!rows.length ? <p className="py-6 text-center text-sm text-muted">{t.calendar.noTradesDay}</p> : (
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-left">
                <th className="py-2 font-medium">{t.trades.columns.date}</th><th className="font-medium">{t.trades.columns.pair}</th><th className="font-medium">{t.trades.columns.direction}</th><th className="font-medium">{t.trades.columns.account}</th><th className="text-right font-medium">{t.trades.columns.result}</th><th className="text-right font-medium">R</th><th className="pl-4 font-medium">{t.trades.columns.emotion}</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const e = emotionKey(r.emotional_state);
                  return (
                    <tr key={r.id} className="num border-b border-line/50 text-fg-2 last:border-0">
                      <td className="py-2"><Link href={`/trades/${r.id}`} className="text-fg hover:text-gold">{f.date(r.opened_at, tz, "HH:mm")}–{f.date(r.closed_at, tz, "HH:mm")}</Link></td>
                      <td className="font-medium text-fg">{r.symbol}</td>
                      <td className={r.direction === "long" ? "text-profit" : "text-loss"}>{r.direction === "long" ? t.common.long : t.common.short}</td>
                      <td>{accName.get(r.account_id)}</td>
                      <td className="text-right font-semibold"><Pnl value={r.net_pnl} currency={currency} /></td>
                      <td className="text-right">{f.r(r.r_multiple)}</td>
                      <td className="pl-4">{e ? <Badge>{emotions[e] ?? e}</Badge> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
