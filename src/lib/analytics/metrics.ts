import { D, type Dec, ZERO, parseDec, sum, toStr } from "@/lib/engine";
import type { AnalyticsTrade, Summary } from "./types";

/** Closed trades with an available net P&L, ordered by close time. */
export function realized(trades: AnalyticsTrade[]): (AnalyticsTrade & { net: Dec })[] {
  return trades
    .filter((t) => t.status === "closed" && t.closedAt && parseDec(t.netPnl) !== null)
    .map((t) => ({ ...t, net: parseDec(t.netPnl)! }))
    .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!) || a.id.localeCompare(b.id));
}

export function maxDrawdown(pnls: Dec[], startingBalance?: Dec | null): { amount: Dec; pct: Dec | null } {
  const start = startingBalance ?? ZERO;
  let equity = start;
  let peak = start;
  let maxDd = ZERO;
  let maxDdPct: Dec | null = null;
  for (const p of pnls) {
    equity = equity.plus(p);
    if (equity.gt(peak)) peak = equity;
    const dd = peak.minus(equity);
    if (dd.gt(maxDd)) {
      maxDd = dd;
      maxDdPct = peak.gt(0) ? dd.div(peak).mul(100) : null;
    }
  }
  return { amount: maxDd, pct: startingBalance && startingBalance.gt(0) ? maxDdPct : null };
}

export function summarize(trades: AnalyticsTrade[], opts: { startingBalance?: string | null } = {}): Summary {
  const closed = trades.filter((t) => t.status === "closed");
  const r = realized(trades);
  const wins = r.filter((t) => t.outcome === "win");
  const losses = r.filter((t) => t.outcome === "loss");
  const bes = r.filter((t) => t.outcome === "breakeven");

  const net = sum(r.map((t) => t.net));
  const gross = sum(r.map((t) => parseDec(t.grossPnl) ?? t.net));
  const fees = sum(r.map((t) => parseDec(t.fees) ?? ZERO));
  const grossProfit = sum(wins.map((t) => t.net));
  const grossLoss = sum(losses.map((t) => t.net)).abs();
  const decided = wins.length + losses.length;

  const rValues = r.map((t) => parseDec(t.rMultiple)).filter((v): v is Dec => v !== null);
  const holding = r.map((t) => t.holdingSeconds).filter((v): v is number => typeof v === "number");

  // Streaks (breakevens neither extend nor break a streak).
  let longestWin = 0, longestLoss = 0, run = 0;
  let runType: "win" | "loss" | null = null;
  for (const t of r) {
    if (t.outcome !== "win" && t.outcome !== "loss") continue;
    if (t.outcome === runType) run++;
    else { runType = t.outcome; run = 1; }
    if (runType === "win") longestWin = Math.max(longestWin, run);
    else longestLoss = Math.max(longestLoss, run);
  }

  const dd = maxDrawdown(r.map((t) => t.net), parseDec(opts.startingBalance));
  const nets = r.map((t) => t.net);

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    unavailableTrades: closed.length - r.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: bes.length,
    netPnl: toStr(net)!,
    grossPnl: toStr(gross)!,
    fees: toStr(fees)!,
    grossProfit: toStr(grossProfit)!,
    grossLoss: toStr(grossLoss)!,
    winRate: decided ? toStr(new D(wins.length).div(decided).mul(100), 4) : null,
    profitFactor: grossLoss.gt(0) ? toStr(grossProfit.div(grossLoss), 4) : null,
    profitFactorInfinite: grossLoss.isZero() && grossProfit.gt(0),
    avgWinner: wins.length ? toStr(grossProfit.div(wins.length)) : null,
    avgLoser: losses.length ? toStr(grossLoss.neg().div(losses.length)) : null,
    expectancy: r.length ? toStr(net.div(r.length)) : null,
    avgR: rValues.length ? toStr(sum(rValues).div(rValues.length), 4) : null,
    rTradeCount: rValues.length,
    totalR: rValues.length ? toStr(sum(rValues), 4) : null,
    largestWinner: nets.length && D.max(...nets).gt(0) ? toStr(D.max(...nets)) : null,
    largestLoser: nets.length && D.min(...nets).lt(0) ? toStr(D.min(...nets)) : null,
    avgHoldingSeconds: holding.length ? Math.round(holding.reduce((a, b) => a + b, 0) / holding.length) : null,
    maxDrawdown: toStr(dd.amount)!,
    maxDrawdownPct: toStr(dd.pct, 4),
    currentStreak: { type: runType, count: run },
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
  };
}
