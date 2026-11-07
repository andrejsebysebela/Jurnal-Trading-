import { type Dec, ZERO, parseDec } from "./decimal";
import type { CalcIssue, Direction, ExecutionInput, MatchingPolicy, Side } from "./types";

export interface NormalizedExecution {
  index: number;
  side: Side;
  quantity: Dec;
  price: Dec;
  executedAt: string;
  time: number;
  cost: Dec;
}

export interface RawLot {
  entryIndex: number;
  exitIndex: number;
  quantity: Dec;
  entryPrice: Dec;
  exitPrice: Dec;
  exitAt: string;
}

export function normalizeExecutions(executions: ExecutionInput[]): { list: NormalizedExecution[]; issues: CalcIssue[] } {
  const issues: CalcIssue[] = [];
  const list: NormalizedExecution[] = [];
  executions.forEach((e, index) => {
    const quantity = parseDec(e.quantity);
    const price = parseDec(e.price);
    const time = Date.parse(e.executedAt);
    const fee = parseDec(e.fee) ?? ZERO;
    const commission = parseDec(e.commission) ?? ZERO;
    if (!quantity || quantity.lte(0) || !price || price.lt(0) || Number.isNaN(time) || (e.side !== "buy" && e.side !== "sell")) {
      issues.push({
        code: "INVALID_EXECUTION",
        severity: "error",
        message: `Execution #${index + 1} has an invalid side, quantity, price or timestamp.`,
      });
      return;
    }
    list.push({ index, side: e.side, quantity, price, executedAt: new Date(time).toISOString(), time, cost: fee.plus(commission) });
  });
  // Stable chronological order; ties keep input order.
  list.sort((a, b) => a.time - b.time || a.index - b.index);
  return { list, issues };
}

export function entrySideFor(direction: Direction): Side {
  return direction === "long" ? "buy" : "sell";
}

/**
 * Match exits against open entry lots. FIFO (default) closes the oldest entry
 * first; LIFO closes the newest. An exit larger than the open position is a
 * position flip, which is rejected inside a single trade — importers split
 * flips into two trades before calling the engine.
 */
export function matchLots(
  list: NormalizedExecution[],
  direction: Direction,
  policy: MatchingPolicy = "fifo",
): { lots: RawLot[]; open: { index: number; quantity: Dec; price: Dec }[]; issues: CalcIssue[] } {
  const entrySide = entrySideFor(direction);
  const open: { index: number; quantity: Dec; price: Dec }[] = [];
  const lots: RawLot[] = [];
  const issues: CalcIssue[] = [];

  for (const ex of list) {
    if (ex.side === entrySide) {
      open.push({ index: ex.index, quantity: ex.quantity, price: ex.price });
      continue;
    }
    let remaining = ex.quantity;
    while (remaining.gt(0) && open.length > 0) {
      const lotIdx = policy === "fifo" ? 0 : open.length - 1;
      const lot = open[lotIdx];
      const q = Dec_min(lot.quantity, remaining);
      lots.push({ entryIndex: lot.index, exitIndex: ex.index, quantity: q, entryPrice: lot.price, exitPrice: ex.price, exitAt: ex.executedAt });
      lot.quantity = lot.quantity.minus(q);
      remaining = remaining.minus(q);
      if (lot.quantity.isZero()) open.splice(lotIdx, 1);
    }
    if (remaining.gt(0)) {
      issues.push({
        code: "POSITION_FLIP",
        severity: "error",
        message: `Execution #${ex.index + 1} closes more than the open position (excess ${remaining.toFixed()}). Split it into a separate trade.`,
      });
    }
  }
  return { lots, open, issues };
}

function Dec_min(a: Dec, b: Dec): Dec {
  return a.lt(b) ? a : b;
}
