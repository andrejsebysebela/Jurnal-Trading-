import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Info, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Pnl } from "@/components/shared/pnl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineSelect, InlineText } from "@/components/trades/inline-fields";
import { Screenshots } from "@/components/trades/screenshots";
import { EMOTIONS } from "@/lib/constants";
import { getTrade, listAccounts, listStrategies } from "@/lib/db/queries";
import { tradeTagNames } from "@/lib/db/tag-names";
import { requireUser } from "@/lib/db/session";
import { duration, money, plain, rMultiple, tone, toneClass } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { deleteTrades } from "@/server/actions/trades";

export const metadata = { title: "Trade" };

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, profile, user } = await requireUser();
  const [t, accounts, strategies] = await Promise.all([getTrade(supabase, id), listAccounts(supabase), listStrategies(supabase)]);
  if (!t) notFound();
  const tz = profile.timezone;
  const account = accounts.find((a) => a.id === t.account_id);
  const cur = account?.currency ?? "USD";
  const strategy = strategies.find((s) => s.id === t.strategy_id);
  const entrySide = t.direction === "long" ? "buy" : "sell";
  const tags = tradeTagNames(t, "tag");
  const mistakes = tradeTagNames(t, "mistake");
  const issues = t.calc_issues.filter((i) => i.code !== "OPEN_POSITION");
  const scale = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/trades" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3.5" />Trades</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{t.symbol}</h1>
            <Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Long" : "Short"}</Badge>
            <Badge>{t.asset_class}</Badge>
            {t.status === "open" && <Badge tone="gold">open</Badge>}
            {t.is_draft && <Badge>draft</Badge>}
            {t.outcome && <Badge tone={t.outcome === "win" ? "profit" : t.outcome === "loss" ? "loss" : "neutral"}>{t.outcome}</Badge>}
          </div>
          <p className="mt-1 text-sm text-fg-2">
            {account?.name} · {formatInTimeZone(t.opened_at, tz, "EEE, MMM d yyyy HH:mm")}
            {t.closed_at && ` → ${formatInTimeZone(t.closed_at, tz, t.closed_at.slice(0, 10) === t.opened_at.slice(0, 10) ? "HH:mm" : "MMM d HH:mm")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary"><Link href={`/trades/${t.id}/edit`}><Pencil />Edit</Link></Button>
          <ConfirmButton variant="danger" action={deleteTrades.bind(null, [t.id])} title="Delete this trade?" description="Executions, notes and screenshots are deleted permanently." success="Trade deleted" redirectTo="/trades"><Trash2 />Delete</ConfirmButton>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mb-5 space-y-1.5 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-sm text-fg-2">
          {issues.map((i) => (
            <p key={i.code + i.message} className="flex gap-2">{i.severity === "info" ? <Info className="mt-0.5 size-4 shrink-0 text-fg-2" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />}{i.message}</p>
          ))}
          {issues.some((i) => i.code === "MISSING_INSTRUMENT_SPEC") && <Link href="/instruments" className="inline-block text-gold hover:text-gold-hover">Configure instrument →</Link>}
          {issues.some((i) => i.code === "MISSING_FX_RATE") && <Link href="/settings#fx" className="ml-4 inline-block text-gold hover:text-gold-hover">Add FX rate →</Link>}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" aria-label="Overview">
        <Stat label="Net P&L" value={<Pnl value={t.net_pnl} currency={cur} unavailableLabel="Unavailable" />} big />
        <Stat label="Gross P&L" value={<Pnl value={t.gross_pnl} currency={cur} />} />
        <Stat label="Fees" value={money(t.fees, cur)} />
        <Stat label="R-multiple" value={<span className={toneClass[tone(t.r_multiple)]}>{rMultiple(t.r_multiple)}</span>} />
        <Stat label="Initial risk" value={money(t.initial_risk, cur)} />
        <Stat label="Avg entry" value={plain(t.avg_entry_price)} />
        <Stat label="Avg exit" value={plain(t.avg_exit_price)} />
        <Stat label="Holding" value={duration(t.holding_seconds)} />
      </section>
      <p className="mt-2 text-xs text-muted">
        Position {plain(t.entry_quantity)}{t.status === "open" ? ` · ${plain(t.open_quantity)} open` : ""} · Stop {plain(t.stop_loss)} · Target {plain(t.take_profit)}
        {t.planned_rr && ` · Planned 1:${Number(t.planned_rr).toFixed(2)}`}
        {t.pnl_currency && t.pnl_currency !== cur && t.gross_pnl_quote && ` · Gross in ${t.pnl_currency}: ${money(t.gross_pnl_quote, t.pnl_currency, { sign: true })}`}
        {t.pnl_source === "broker" && " · P&L from broker report"}
        {Number(t.swap) !== 0 && ` · Swap ${money(t.swap, cur, { sign: true })}`}
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Executions</CardTitle><span className="text-xs text-muted">{t.executions.length} fills</span></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] uppercase tracking-wider text-muted">
                  <tr className="border-b border-line"><th className="py-2 text-left font-medium">Type</th><th className="text-left font-medium">Side</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">Commission</th><th className="text-right font-medium">Fees</th><th className="text-right font-medium">Time</th></tr>
                </thead>
                <tbody>
                  {t.executions.map((e) => (
                    <tr key={e.id} className="num border-b border-line/50 text-fg-2 last:border-0">
                      <td className="py-2">{e.side === entrySide ? <span className="text-fg">Entry</span> : <span className="text-gold">Exit</span>}</td>
                      <td className="uppercase">{e.side}</td>
                      <td className="text-right">{plain(e.quantity)}</td>
                      <td className="text-right text-fg">{plain(e.price)}</td>
                      <td className="text-right">{money(e.commission, cur)}</td>
                      <td className="text-right">{money(e.fee, cur)}</td>
                      <td className="text-right">{formatInTimeZone(e.executed_at, tz, "MMM d, HH:mm:ss")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Charts</CardTitle></CardHeader>
            <CardContent><Screenshots userId={user.id} tradeId={t.id} shots={t.screenshots} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle><span className="text-xs text-muted">Saved automatically</span></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InlineText tradeId={t.id} field="note_entry_reason" label="Why I entered" value={t.note_entry_reason} />
              <InlineText tradeId={t.id} field="note_expectation" label="What I expected" value={t.note_expectation} />
              <InlineText tradeId={t.id} field="note_exit_reason" label="Why I exited" value={t.note_exit_reason} />
              <InlineText tradeId={t.id} field="note_did_well" label="What I did well" value={t.note_did_well} />
              <InlineText tradeId={t.id} field="note_did_wrong" label="What I did wrong" value={t.note_did_wrong} />
              <InlineText tradeId={t.id} field="note_lesson" label="What I learned" value={t.note_lesson} />
              <div className="md:col-span-2"><InlineText tradeId={t.id} field="notes" label="Other notes" value={t.notes} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Setup</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Line label="Strategy" value={strategy ? <Link href="/strategies" className="text-gold hover:text-gold-hover">{strategy.name}</Link> : "—"} />
              <Line label="Setup" value={t.setup ?? "—"} />
              <Line label="Timeframe" value={t.timeframe ?? "—"} />
              <Line label="Session" value={t.session ?? "—"} />
              <Line label="Rating" value={t.rating ? <span className="text-gold">{"★".repeat(t.rating)}</span> : "—"} />
              {tags.length > 0 && <div className="flex flex-wrap gap-1 pt-1">{tags.map((x) => <Badge key={x}>{x}</Badge>)}</div>}
              {strategy && strategy.checklist.length > 0 && (
                <div className="border-t border-line pt-3">
                  <p className="mb-2 text-xs font-medium text-fg-2">Entry checklist</p>
                  <ul className="space-y-1.5">
                    {strategy.checklist.map((item) => {
                      const ok = !!t.checklist_state?.[item];
                      return <li key={item} className={cn("flex items-center gap-2", ok ? "text-fg" : "text-muted")}>{ok ? <CheckCircle2 className="size-4 text-profit" /> : <Circle className="size-4" />}{item}</li>;
                    })}
                  </ul>
                </div>
              )}
              {strategy?.entry_criteria && <div className="border-t border-line pt-3"><p className="mb-1 text-xs font-medium text-fg-2">Entry conditions</p><p className="whitespace-pre-wrap text-fg-2">{strategy.entry_criteria}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Psychology</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <InlineSelect tradeId={t.id} field="emotional_state" label="Emotional state" value={t.emotional_state ?? ""} options={EMOTIONS.map((e) => ({ value: e, label: e }))} />
              <InlineSelect tradeId={t.id} field="confidence" label="Confidence" value={t.confidence ? String(t.confidence) : ""} options={scale} />
              <InlineSelect tradeId={t.id} field="discipline_rating" label="Discipline" value={t.discipline_rating ? String(t.discipline_rating) : ""} options={scale} />
              <InlineSelect tradeId={t.id} field="rule_compliant" label="Followed rules" value={t.rule_compliant === null ? "" : t.rule_compliant ? "yes" : "no"} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
              <div className="col-span-2">
                <p className="mb-1.5 text-xs font-medium text-fg-2">Mistakes</p>
                {mistakes.length ? <div className="flex flex-wrap gap-1">{mistakes.map((m) => <Badge key={m} tone="loss">{m}</Badge>)}</div> : <p className="text-sm text-muted">None tagged. <Link href={`/trades/${t.id}/edit`} className="text-gold">Add</Link></p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, big }: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line/70 bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={cn("num mt-1 font-semibold", big ? "text-xl" : "text-[15px]")}>{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-fg-2">{label}</span><span className="text-right text-fg">{value}</span></div>;
}
