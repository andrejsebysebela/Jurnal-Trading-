import { ProgressBar } from "@/components/shared/progress-bar";
import { Pnl } from "@/components/shared/pnl";
import { Badge } from "@/components/ui/badge";
import { propStatus, summarize, type AnalyticsTrade } from "@/lib/analytics";
import { D } from "@/lib/engine";
import type { Account } from "@/lib/db/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Formatter } from "@/lib/i18n/format";
import { fill, plural } from "@/lib/i18n/config";
import { accountKind, accountPhaseKey } from "./labels";

/** Per-account statistics + prop firm rule progress (all-time, closed trades). */
export function AccountSummary({ a, trades, t, f, timeZone, today, compact }: {
  a: Account; trades: AnalyticsTrade[]; t: Dictionary; f: Formatter; timeZone: string; today: string; compact?: boolean;
}) {
  const s = summarize(trades, { startingBalance: a.starting_balance });
  const isProp = accountKind(a) === "prop";
  const phase = accountPhaseKey(a);
  const ps = isProp && (a.profit_target || a.max_daily_loss || a.max_total_drawdown)
    ? propStatus(trades, { startingBalance: a.starting_balance, profitTarget: a.profit_target, maxDailyLoss: a.max_daily_loss, maxTotalDrawdown: a.max_total_drawdown, drawdownType: a.drawdown_type }, timeZone, today)
    : null;
  const balance = a.starting_balance ? new D(a.starting_balance).plus(s.netPnl).toFixed() : null;
  const statusTone = ps ? (ps.status === "breached" || ps.status === "danger" ? "loss" : ps.status === "warning" ? "warning" : ps.status === "passed" ? "profit" : "neutral") : "neutral";
  const bar = (v: number | null): "loss" | "warn" | "gold" => ((v ?? 0) >= 80 ? "loss" : (v ?? 0) >= 50 ? "warn" : "gold");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={isProp ? "gold" : "neutral"}>{isProp ? a.prop_firm || t.account.prop : t.account.personal}</Badge>
        <Badge tone={phase === "funded" || phase === "live" ? "profit" : "neutral"}>{t.account.phase[phase]}</Badge>
        {!a.is_active && <Badge>{t.account.inactive}</Badge>}
        {ps && <Badge tone={statusTone}>{t.accounts.status[ps.status]}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={t.accounts.balance} value={balance ? f.money(balance, a.currency) : "—"} />
        <Metric label={t.stats.netPnl} value={<Pnl value={s.netPnl} currency={a.currency} />} />
        <Metric label={t.stats.winRate} value={f.pct(s.winRate)} sub={plural(f.locale, s.totalTrades, t.common.trades)} />
        <Metric label={t.stats.avgR} value={f.r(s.avgR)} />
        {!compact && <Metric label={t.stats.profitFactor} value={s.profitFactorInfinite ? "∞" : f.num(s.profitFactor, 2, 2)} />}
        {!compact && <Metric label={t.stats.maxDrawdown} value={f.money(s.maxDrawdown, a.currency)} />}
        {!compact && <Metric label={t.stats.avgWinner} value={f.money(s.avgWinner, a.currency)} />}
        {!compact && <Metric label={t.stats.avgLoser} value={f.money(s.avgLoser, a.currency)} />}
      </div>
      {ps && (
        <div className="space-y-3 rounded-xl border border-line bg-elevated/40 p-4">
          {a.profit_target && <Rule label={t.accounts.targetProgress} detail={`${f.money(ps.netPnl, a.currency, { sign: true })} / ${f.money(a.profit_target, a.currency)}`} value={ps.profitTargetProgressPct} tone="profit" />}
          {a.max_daily_loss && <Rule label={t.accounts.dailyUsed} detail={`${f.money(ps.todayPnl, a.currency, { sign: true })} / -${f.money(a.max_daily_loss, a.currency)}`} value={ps.dailyLossUsedPct} tone={bar(ps.dailyLossUsedPct)} />}
          {a.max_total_drawdown && <Rule label={`${t.accounts.ddUsed} (${a.drawdown_type === "trailing" ? "trailing" : "static"})`} detail={`${f.money(ps.drawdownUsed, a.currency)} / ${f.money(a.max_total_drawdown, a.currency)} · ${fill(t.accounts.left, { amount: f.money(ps.remainingDrawdown, a.currency) })}`} value={ps.drawdownUsedPct} tone={bar(ps.drawdownUsedPct)} />}
          <p className="text-[11px] text-muted">{t.accounts.rulesNote}</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return <div><p className="text-[11px] uppercase tracking-wider text-muted">{label}</p><p className="num mt-1 text-sm font-semibold">{value}</p>{sub && <p className="text-[11px] text-muted">{sub}</p>}</div>;
}

function Rule({ label, detail, value, tone }: { label: string; detail: string; value: number | null; tone: "gold" | "profit" | "loss" | "warn" }) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap justify-between gap-x-2 text-xs"><span className="text-fg-2">{label}</span><span className="num text-muted">{detail}</span></div>
      <ProgressBar value={value} tone={tone} label={label} />
    </div>
  );
}
