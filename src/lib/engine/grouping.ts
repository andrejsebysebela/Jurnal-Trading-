import { type Dec, ZERO, parseDec } from "./decimal";
import type { Direction, ExecutionInput } from "./types";

export interface GroupableExecution extends ExecutionInput {
  symbol: string;
  accountKey?: string;
}

export interface ExecutionGroup {
  symbol: string;
  accountKey?: string;
  direction: Direction;
  executions: ExecutionInput[];
  closed: boolean;
}

/**
 * Group a flat execution stream into round-trip trades (flat → flat) per
 * account+symbol. When an execution flips the position (e.g. long 2, sell 5)
 * it is split proportionally: part closes the current trade, the remainder
 * opens a new trade in the opposite direction. Fees are split pro-rata.
 */
export function groupExecutionsIntoTrades(executions: GroupableExecution[]): ExecutionGroup[] {
  const sorted = executions
    .map((e, i) => ({ e, i, t: Date.parse(e.executedAt) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.e);

  const groups: ExecutionGroup[] = [];
  const current = new Map<string, { group: ExecutionGroup; position: Dec }>();

  for (const ex of sorted) {
    const key = `${ex.accountKey ?? ""}::${ex.symbol.toUpperCase()}`;
    const qty = parseDec(ex.quantity);
    if (!qty || qty.lte(0)) continue;
    const signed = ex.side === "buy" ? qty : qty.neg();
    const state = current.get(key);
    const base: ExecutionInput = { ...ex };
    delete (base as Partial<GroupableExecution>).symbol;
    delete (base as Partial<GroupableExecution>).accountKey;

    if (!state) {
      const group: ExecutionGroup = {
        symbol: ex.symbol.toUpperCase(),
        accountKey: ex.accountKey,
        direction: ex.side === "buy" ? "long" : "short",
        executions: [base],
        closed: false,
      };
      groups.push(group);
      current.set(key, { group, position: signed });
      continue;
    }

    const newPosition = state.position.plus(signed);
    const flips = !newPosition.isZero() && newPosition.isNeg() !== state.position.isNeg();
    if (!flips) {
      state.group.executions.push(base);
      state.position = newPosition;
      if (newPosition.isZero()) {
        state.group.closed = true;
        current.delete(key);
      }
      continue;
    }

    // Split the flipping execution.
    const closingQty = state.position.abs();
    const openingQty = qty.minus(closingQty);
    const ratio = closingQty.div(qty);
    const splitCost = (v: string | null | undefined, part: Dec) => {
      const d = parseDec(v);
      return d ? d.mul(part).toFixed() : null;
    };
    state.group.executions.push({
      ...base,
      quantity: closingQty.toFixed(),
      fee: splitCost(ex.fee, ratio),
      commission: splitCost(ex.commission, ratio),
      id: ex.id ? `${ex.id}:close` : undefined,
    });
    state.group.closed = true;
    const opening: ExecutionGroup = {
      symbol: ex.symbol.toUpperCase(),
      accountKey: ex.accountKey,
      direction: ex.side === "buy" ? "long" : "short",
      executions: [
        {
          ...base,
          quantity: openingQty.toFixed(),
          fee: splitCost(ex.fee, ZERO.plus(1).minus(ratio)),
          commission: splitCost(ex.commission, ZERO.plus(1).minus(ratio)),
          id: ex.id ? `${ex.id}:open` : undefined,
        },
      ],
      closed: false,
    };
    groups.push(opening);
    current.set(key, { group: opening, position: newPosition });
  }
  return groups;
}
