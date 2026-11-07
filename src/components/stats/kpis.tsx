import { Kpi } from "@/components/shared/kpi";
import type { Summary } from "@/lib/analytics";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Formatter } from "@/lib/i18n/format";
import { fill, plural } from "@/lib/i18n/config";
import { tone } from "@/lib/utils/format";

const kTone = (v: string | null) => { const x = tone(v); return x === "neutral" ? "neutral" : x; };

/** KPI tiles shared by Dashboard (compact) and Statistics (full). */
export function SummaryKpis({ s, currency, t, f, full }: { s: Summary; currency: string; t: Dictionary; f: Formatter; full?: boolean }) {
  /** Abbreviated for the tile; exact value in the tooltip. */
  const m = (v: string | null, sign = true) => f.money(v, currency, { sign, kpi: true });
  const exact = (v: string | null, sign = true) => f.money(v, currency, { sign });
  const streak = s.currentStreak.type ? plural(f.locale, s.currentStreak.count, s.currentStreak.type === "win" ? t.stats.winStreak : t.stats.lossStreak) : "—";
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="KPI">
      <Kpi testId="kpi-net" label={t.stats.netPnl} value={m(s.netPnl)} title={exact(s.netPnl)} tone={kTone(s.netPnl)} sub={plural(f.locale, s.closedTrades - s.unavailableTrades, t.common.trades)} />
      <Kpi testId="kpi-winrate" label={t.stats.winRate} value={f.pct(s.winRate)} sub={fill(t.stats.wlb, { w: s.wins, l: s.losses, b: s.breakevens })} hint={t.stats.winRateHint} />
      <Kpi label={t.stats.profitFactor} value={s.profitFactorInfinite ? "∞" : f.num(s.profitFactor, 2, 2)} tone={s.profitFactor ? (Number(s.profitFactor) >= 1 ? "profit" : "loss") : "neutral"} hint={t.stats.profitFactorHint} />
      <Kpi testId="kpi-avgr" label={t.stats.avgR} value={f.r(s.avgR)} tone={kTone(s.avgR)} sub={`${t.stats.totalR}: ${f.r(s.totalR)}`} />
      <Kpi label={t.stats.expectancy} value={m(s.expectancy)} title={exact(s.expectancy)} tone={kTone(s.expectancy)} hint={t.stats.expectancyHint} />
      <Kpi label={t.stats.maxDrawdown} value={m(s.maxDrawdown, false)} title={exact(s.maxDrawdown, false)} tone={Number(s.maxDrawdown) > 0 ? "loss" : "neutral"} sub={s.maxDrawdownPct ? f.pct(s.maxDrawdownPct, 2) : undefined} hint={t.stats.maxDrawdownHint} />
      {full && (
        <>
          <Kpi label={t.stats.avgWinner} value={m(s.avgWinner, false)} title={exact(s.avgWinner, false)} tone="profit" />
          <Kpi label={t.stats.avgLoser} value={m(s.avgLoser, false)} title={exact(s.avgLoser, false)} tone="loss" />
          <Kpi label={t.stats.bestTrade} value={m(s.largestWinner)} title={exact(s.largestWinner)} tone="profit" />
          <Kpi label={t.stats.worstTrade} value={m(s.largestLoser)} title={exact(s.largestLoser)} tone="loss" />
          <Kpi label={t.stats.avgDuration} value={f.duration(s.avgHoldingSeconds)} />
          <Kpi label={t.stats.streak} value={streak} sub={fill(t.stats.streakMax, { w: s.longestWinStreak, l: s.longestLossStreak })} />
        </>
      )}
    </section>
  );
}
