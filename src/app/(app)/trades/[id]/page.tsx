import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Pnl } from "@/components/shared/pnl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateButton } from "@/components/trades/duplicate-button";
import { ScreenshotGallery } from "@/components/trades/screenshots";
import { emotionKey } from "@/lib/constants";
import { getTrade, listAccounts } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils/cn";
import { tone, toneClass } from "@/lib/utils/format";
import { deleteTrades } from "@/server/actions/trades";
import { accountPhase } from "@/components/accounts/labels";

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, profile, user } = await requireUser();
  const { t, f } = await getI18n();
  const [tr, accounts] = await Promise.all([getTrade(supabase, id), listAccounts(supabase)]);
  if (!tr) notFound();
  const tz = profile.timezone;
  const account = accounts.find((a) => a.id === tr.account_id);
  const cur = account?.currency ?? tr.pnl_currency ?? "USD";
  const emo = emotionKey(tr.emotional_state);
  const emoLabel = emo ? (t.emotions as Record<string, string>)[emo] ?? emo : null;
  const risk = tr.manual_initial_risk ?? tr.initial_risk;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/trades" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3.5" />{t.trade.backToTrades}</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{tr.symbol}</h1>
            <Badge tone={tr.direction === "long" ? "profit" : "loss"}>{tr.direction === "long" ? t.common.long : t.common.short}</Badge>
            {tr.outcome && <Badge tone={tr.outcome === "win" ? "profit" : tr.outcome === "loss" ? "loss" : "neutral"}>{t.common[tr.outcome]}</Badge>}
            {tr.entry_mode === "executions" && <Badge>{t.trade.legacy}</Badge>}
          </div>
          <p className="mt-1 text-sm text-fg-2">
            {account ? <>{account.name} · {accountPhase(account, t)}</> : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link href={`/trades/${tr.id}/edit`}><Pencil />{t.common.edit}</Link></Button>
          <DuplicateButton id={tr.id} />
          <ConfirmButton variant="danger" action={deleteTrades.bind(null, [tr.id])} title={t.trade.deleteTitle} description={t.trade.deleteBody} success={t.trade.deleted} redirectTo="/trades"><Trash2 />{t.common.delete}</ConfirmButton>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={t.trade.preview}>
        <Stat label={t.trade.result} value={<Pnl value={tr.net_pnl} currency={cur} />} big />
        <Stat label={t.trade.riskAmount} value={f.money(risk, cur)} />
        <Stat label={t.trade.rMultiple} value={<span className={toneClass[tone(tr.r_multiple)]}>{f.r(tr.r_multiple)}</span>} />
        <Stat label={t.trade.plannedRR} value={f.rr(tr.planned_rr)} />
        <Stat label={t.trade.duration} value={f.duration(tr.holding_seconds)} />
        <Stat label={t.trade.emotion} value={emoLabel ?? "—"} />
      </section>
      <p className="mt-2 text-xs text-muted">
        {t.trade.opened}: {f.date(tr.opened_at, tz, "EEEE d. MMM yyyy, HH:mm")} · {t.trade.closed}: {f.date(tr.closed_at, tz, "EEEE d. MMM yyyy, HH:mm")} ({tz})
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t.trade.screenshots}</CardTitle>
            {tr.tradingview_url && (
              <Button asChild variant="outline" size="sm"><a href={tr.tradingview_url} target="_blank" rel="noopener noreferrer"><ExternalLink />{t.trade.openTradingview}</a></Button>
            )}
          </CardHeader>
          <CardContent><ScreenshotGallery userId={user.id} tradeId={tr.id} shots={tr.screenshots} /></CardContent>
        </Card>
        <div className="space-y-4">
          <TextCard title={t.trade.psychology} text={tr.psychology_notes} empty={t.trade.psychologyPlaceholder} badge={emoLabel} />
          <TextCard title={t.trade.notes} text={tr.notes ?? [tr.note_entry_reason, tr.note_exit_reason, tr.note_lesson].filter(Boolean).join("\n\n") ?? null} empty={t.trade.notesPlaceholder} />
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

function TextCard({ title, text, empty, badge }: { title: string; text: string | null; empty: string; badge?: string | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle>{badge && <Badge tone="gold">{badge}</Badge>}</CardHeader>
      <CardContent>{text ? <p className="whitespace-pre-wrap text-sm text-fg-2">{text}</p> : <p className="text-sm text-muted">{empty}</p>}</CardContent>
    </Card>
  );
}
