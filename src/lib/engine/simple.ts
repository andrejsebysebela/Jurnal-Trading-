import { type Dec, parseDec, toStr } from "./decimal";
import { classifyOutcome } from "./trade";
import type { Outcome } from "./types";

/**
 * Simple journal entry: the trader records the money risked and the realized result directly
 * (account currency). No instrument specs or FX are involved, so nothing is guessed.
 */
export interface SimpleTradeInput {
  /** Money at risk on the trade (> 0), account currency. */
  risk: string;
  /** Realized result after costs (may be negative or zero), account currency. */
  result: string;
  /** Planned reward:risk, e.g. "2" for 1:2 (optional, > 0). */
  plannedRR?: string | null;
  openedAt: string; // ISO UTC
  closedAt: string; // ISO UTC
}

export interface SimpleTradeResult {
  netPnl: string;
  initialRisk: string;
  rMultiple: string;
  plannedRR: string | null;
  outcome: Outcome;
  holdingSeconds: number;
}

export class SimpleTradeError extends Error {
  constructor(public field: keyof SimpleTradeInput, message: string) {
    super(message);
  }
}

export function computeSimpleTrade(input: SimpleTradeInput): SimpleTradeResult {
  const risk = parseDec(input.risk);
  const result = parseDec(input.result);
  if (!risk || risk.lte(0)) throw new SimpleTradeError("risk", "Risk must be greater than zero.");
  if (!result) throw new SimpleTradeError("result", "Result must be a number.");
  let rr: Dec | null = null;
  if (input.plannedRR != null && String(input.plannedRR).trim() !== "") {
    rr = parseDec(input.plannedRR);
    if (!rr || rr.lte(0)) throw new SimpleTradeError("plannedRR", "RR must be greater than zero.");
  }
  const open = Date.parse(input.openedAt);
  const close = Date.parse(input.closedAt);
  if (Number.isNaN(open)) throw new SimpleTradeError("openedAt", "Invalid open time.");
  if (Number.isNaN(close)) throw new SimpleTradeError("closedAt", "Invalid close time.");
  if (close < open) throw new SimpleTradeError("closedAt", "Close time is before open time.");
  return {
    netPnl: toStr(result)!,
    initialRisk: toStr(risk)!,
    rMultiple: toStr(result.div(risk), 4)!,
    plannedRR: toStr(rr, 4),
    outcome: classifyOutcome(result),
    holdingSeconds: Math.round((close - open) / 1000),
  };
}
