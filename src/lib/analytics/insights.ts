import { D, type Dec, ZERO, parseDec, sum, toStr } from "@/lib/engine";
import { realized } from "./metrics";
import { dailySeries, dayKey, type DailyPoint } from "./series";
import type { AnalyticsTrade } from "./types";

export interface MistakeRow { mistake: string; count: number; netPnl: string }

/** Mistakes ranked by frequency, with total net P&L of trades where they occurred. */
export function mistakeSummary(trades: AnalyticsTrade[]): MistakeRow[] {
  const map = new Map<string, { count: number; net: Dec }>();
  for (const t of trades) {
    for (const m of t.mistakes) {
      const v = map.get(m) ?? { count: 0, net: ZERO };
      v.count++;
      v.net = v.net.plus(parseDec(t.netPnl) ?? ZERO);
      map.set(m, v);
    }
  }
  return [...map.entries()]
    .map(([mistake, v]) => ({ mistake, count: v.count, netPnl: toStr(v.net)! }))
    .sort((a, b) => b.count - a.count || new D(a.netPnl).comparedTo(new D(b.netPnl)));
}

/**
 * Discipline score 0–100:
 *   60% rule compliance (share of reviewed trades with all rules followed)
 *   40% average discipline rating (1–10 scaled)
 * Uses whichever components have data; null if neither does.
 */
export function disciplineScore(trades: AnalyticsTrade[]): number | null {
  const reviewed = trades.filter((t) => t.ruleCompliant !== null);
  const rated = trades.filter((t) => t.disciplineRating !== null);
  const compliance = reviewed.length ? reviewed.filter((t) => t.ruleCompliant).length / reviewed.length : null;
  const rating = rated.length ? rated.reduce((a, t) => a + (t.disciplineRating ?? 0), 0) / rated.length / 10 : null;
  if (compliance === null && rating === null) return null;
  if (compliance === null) return Math.round(rating! * 100);
  if (rating === null) return Math.round(compliance * 100);
  return Math.round((compliance * 0.6 + rating * 0.4) * 100);
}

export function bestWorstDay(daily: DailyPoint[]): { best: DailyPoint | null; worst: DailyPoint | null } {
  if (!daily.length) return { best: null, worst: null };
  let best = daily[0], worst = daily[0];
  for (const d of daily) {
    if (new D(d.netPnl).gt(best.netPnl)) best = d;
    if (new D(d.netPnl).lt(worst.netPnl)) worst = d;
  }
  return { best: new D(best.netPnl).gt(0) ? best : null, worst: new D(worst.netPnl).lt(0) ? worst : null };
}

export interface PropRules {
  startingBalance: string | null;
  profitTarget: string | null;
  maxDailyLoss: string | null;
  maxTotalDrawdown: string | null;
  /** "static": from starting balance; "trailing": from peak equity. */
  drawdownType: "static" | "trailing";
}

export interface PropStatus {
  balance: string | null;
  netPnl: string;
  profitTargetProgressPct: number | null;
  todayPnl: string;
  dailyLossUsedPct: number | null;
  drawdownUsed: string;
  drawdownUsedPct: number | null;
  remainingDrawdown: string | null;
  breached: boolean;
  status: "ok" | "warning" | "danger" | "breached" | "passed";
}

/** Prop-firm rule tracking from realized trades. All amounts in account currency. */
export function propStatus(trades: AnalyticsTrade[], rules: PropRules, timeZone: string, today: string): PropStatus {
  const r = realized(trades);
  const start = parseDec(rules.startingBalance) ?? ZERO;
  const net = sum(r.map((t) => t.net));
  const daily = dailySeries(trades, timeZone);
  const todayPnl = parseDec(daily.find((d) => d.date === today)?.netPnl) ?? ZERO;

  let equity = start, peak = start, worstFromRef = ZERO;
  for (const t of r) {
    equity = equity.plus(t.net);
    if (equity.gt(peak)) peak = equity;
  }
  const ref = rules.drawdownType === "trailing" ? peak : start;
  worstFromRef = D.max(ZERO, ref.minus(equity));

  const target = parseDec(rules.profitTarget);
  const maxDaily = parseDec(rules.maxDailyLoss);
  const maxDd = parseDec(rules.maxTotalDrawdown);
  const pct = (a: Dec, b: Dec | null) => (b && b.gt(0) ? Math.min(100, Math.max(0, a.div(b).mul(100).toNumber())) : null);

  const dailyUsed = todayPnl.lt(0) ? pct(todayPnl.abs(), maxDaily) : maxDaily ? 0 : null;
  const ddUsedPct = pct(worstFromRef, maxDd);
  const breached = (maxDd !== null && worstFromRef.gte(maxDd)) || (maxDaily !== null && todayPnl.lte(maxDaily.neg()));
  const progress = target ? pct(D.max(ZERO, net), target) : null;
  const worst = Math.max(dailyUsed ?? 0, ddUsedPct ?? 0);
  const status: PropStatus["status"] = breached ? "breached" : progress !== null && progress >= 100 ? "passed" : worst >= 80 ? "danger" : worst >= 50 ? "warning" : "ok";

  return {
    balance: rules.startingBalance ? toStr(start.plus(net)) : null,
    netPnl: toStr(net)!,
    profitTargetProgressPct: progress,
    todayPnl: toStr(todayPnl)!,
    dailyLossUsedPct: dailyUsed,
    drawdownUsed: toStr(worstFromRef)!,
    drawdownUsedPct: ddUsedPct,
    remainingDrawdown: maxDd ? toStr(D.max(ZERO, maxDd.minus(worstFromRef))) : null,
    breached,
    status,
  };
}

export { dayKey };
