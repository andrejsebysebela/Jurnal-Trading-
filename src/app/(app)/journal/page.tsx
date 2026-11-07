import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { JournalEditor } from "@/components/journal/journal-editor";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Screenshots } from "@/components/trades/screenshots";
import { dailySeries, summarize } from "@/lib/analytics";
import { dayBounds } from "@/lib/db/filters";
import { getJournal, listJournals, listRules } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { cn } from "@/lib/utils/cn";
import { pct } from "@/lib/utils/format";
import { loadPeriod } from "@/server/services/period-service";

export const metadata = { title: "Daily Journal" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireUser();
  const tz = ctx.profile.timezone;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const { date: dParam } = await searchParams;
  const date = dParam && /^\d{4}-\d{2}-\d{2}$/.test(dParam) ? dParam : today;
  const listFrom = format(addDays(parseISO(today), -60), "yyyy-MM-dd");
  const { fromUtc } = dayBounds(listFrom, tz);
  const { toUtc } = dayBounds(today > date ? today : date, tz);
  const [journal, journals, rules, period] = await Promise.all([getJournal(ctx.supabase, date), listJournals(ctx.supabase, listFrom, null), listRules(ctx.supabase), loadPeriod(ctx, fromUtc, toUtc)]);
  const daily = new Map(dailySeries(period.trades, tz).map((d) => [d.date, d]));
  const dayTrades = period.trades.filter((t) => t.closedAt && formatInTimeZone(t.closedAt, tz, "yyyy-MM-dd") === date);
  const s = summarize(dayTrades);
  const dates = [...new Set([...journals.map((j) => j.journal_date), ...daily.keys()])].sort().reverse().slice(0, 40);
  const jMap = new Map(journals.map((j) => [j.journal_date, j]));
  const d = parseISO(date);

  return (
    <>
      <PageHeader
        title="Daily Journal"
        description="Plan before the session, review after it. Consistent journaling is the habit behind consistent trading."
        actions={<div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="icon" aria-label="Previous day"><Link href={`/journal?date=${format(addDays(d, -1), "yyyy-MM-dd")}`}><ChevronLeft /></Link></Button>
          <span className="min-w-40 text-center text-sm font-semibold">{format(d, "EEE, MMM d, yyyy")}</span>
          <Button asChild variant="secondary" size="icon" aria-label="Next day"><Link href={`/journal?date=${format(addDays(d, 1), "yyyy-MM-dd")}`}><ChevronRight /></Link></Button>
          {date !== today && <Button asChild variant="ghost" size="sm"><Link href="/journal">Today</Link></Button>}
        </div>}
      />
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card className="self-start">
          <CardHeader><CardTitle>Recent days</CardTitle></CardHeader>
          <CardContent className="max-h-[640px] space-y-1 overflow-y-auto px-2">
            {!dates.length && <p className="px-3 text-sm text-muted">No entries yet.</p>}
            {dates.map((x) => {
              const j = jMap.get(x);
              const dd = daily.get(x);
              return (
                <Link key={x} href={`/journal?date=${x}`} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", x === date ? "bg-elevated text-fg" : "text-fg-2 hover:bg-elevated/60")}>
                  <span className="flex items-center gap-2">{j ? <span className="size-1.5 rounded-full bg-gold" title="Journaled" /> : <span className="size-1.5 rounded-full bg-line" title="No journal" />}{format(parseISO(x), "EEE, MMM d")}</span>
                  {dd && <Pnl value={dd.netPnl} currency={period.currency} className="text-xs" />}
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap gap-x-8 gap-y-2 pt-4 text-sm">
              <span className="text-fg-2">Day P&amp;L <Pnl value={s.netPnl} currency={period.currency} className="ml-1 font-semibold" /></span>
              <span className="text-fg-2">Trades <span className="num ml-1 text-fg">{s.totalTrades}</span></span>
              <span className="text-fg-2">Win rate <span className="num ml-1 text-fg">{pct(s.winRate)}</span></span>
              <Link href={`/calendar/${date}`} className="ml-auto text-gold hover:text-gold-hover">Open day view →</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Journal entry</CardTitle></CardHeader>
            <CardContent><JournalEditor key={`${date}-${journal?.updated_at ?? "new"}`} date={date} journal={journal} rules={rules.filter((r) => r.is_active).map((r) => r.text)} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Screenshots</CardTitle></CardHeader>
            <CardContent>{journal ? <Screenshots userId={ctx.user.id} journalId={journal.id} shots={journal.screenshots} /> : <p className="text-sm text-muted">Save the entry first to attach screenshots.</p>}</CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
