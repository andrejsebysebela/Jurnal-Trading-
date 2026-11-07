import type { DecimalString, Direction, Outcome } from "@/lib/engine";

/** Minimal trade shape analytics needs (values from stored, engine-computed columns). */
export interface AnalyticsTrade {
  id: string;
  accountId: string;
  symbol: string;
  assetClass: string;
  direction: Direction;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  netPnl: DecimalString | null;
  grossPnl: DecimalString | null;
  fees: DecimalString | null;
  rMultiple: DecimalString | null;
  holdingSeconds: number | null;
  outcome: Outcome | null;
  strategyId: string | null;
  strategyName: string | null;
  session: string | null;
  timeframe?: string | null;
  tags: string[];
  mistakes: string[];
  ruleCompliant: boolean | null;
  disciplineRating: number | null;
  emotion?: string | null;
}

export interface Summary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  /** closed trades whose P&L could not be computed (missing spec / FX). */
  unavailableTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  netPnl: DecimalString;
  grossPnl: DecimalString;
  fees: DecimalString;
  grossProfit: DecimalString;
  grossLoss: DecimalString;
  /** Percent 0-100; null when no decided trades. */
  winRate: DecimalString | null;
  /** null when there are no losses (undefined ratio) — UI shows "—" or "∞". */
  profitFactor: DecimalString | null;
  profitFactorInfinite: boolean;
  avgWinner: DecimalString | null;
  avgLoser: DecimalString | null;
  expectancy: DecimalString | null;
  avgR: DecimalString | null;
  rTradeCount: number;
  totalR: DecimalString | null;
  largestWinner: DecimalString | null;
  largestLoser: DecimalString | null;
  avgHoldingSeconds: number | null;
  maxDrawdown: DecimalString;
  maxDrawdownPct: DecimalString | null;
  currentStreak: { type: "win" | "loss" | null; count: number };
  longestWinStreak: number;
  longestLossStreak: number;
}
