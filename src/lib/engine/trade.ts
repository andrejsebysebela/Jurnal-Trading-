import { D, type Dec, ZERO, parseDec, sum, toStr } from "./decimal";
import { convert } from "./fx";
import { pnlMultiplier } from "./instruments";
import { entrySideFor, matchLots, normalizeExecutions } from "./matching";
import type { CalcIssue, Direction, FxRateLookup, MatchedLot, Outcome, PnlSource, TradeCalcResult, TradeInput } from "./types";

/** Broker-vs-calculated mismatch threshold (account currency). */
const RECONCILE_TOLERANCE = new D("0.01");

export class TradeCalculationError extends Error {
  constructor(public issues: CalcIssue[]) {
    super(issues.map((i) => i.message).join(" "));
  }
}

function weightedAverage(items: { quantity: Dec; price: Dec }[]): Dec | null {
  const qty = sum(items.map((i) => i.quantity));
  if (qty.isZero()) return null;
  return sum(items.map((i) => i.quantity.mul(i.price))).div(qty);
}

export function classifyOutcome(netPnl: Dec, tolerance: Dec = ZERO): Outcome {
  if (netPnl.abs().lte(tolerance)) return "breakeven";
  return netPnl.gt(0) ? "win" : "loss";
}

/**
 * Compute every derived trade metric from executions.
 * Throws TradeCalculationError only for structurally invalid input
 * (no/invalid executions, flips). Missing specs or FX rates produce
 * null values plus issues — the UI shows them as "unavailable".
 */
export function computeTrade(input: TradeInput, fx?: FxRateLookup): TradeCalcResult {
  const { list, issues } = normalizeExecutions(input.executions);
  if (issues.length) throw new TradeCalculationError(issues);
  if (list.length === 0) {
    throw new TradeCalculationError([{ code: "NO_EXECUTIONS", severity: "error", message: "A trade needs at least one execution." }]);
  }

  const direction: Direction = input.direction ?? (list[0].side === "buy" ? "long" : "short");
  const entrySide = entrySideFor(direction);
  if (list[0].side !== entrySide) {
    throw new TradeCalculationError([
      { code: "INVALID_EXECUTION", severity: "error", message: `The first execution of a ${direction} trade must be a ${entrySide}.` },
    ]);
  }

  const matched = matchLots(list, direction, input.matchingPolicy ?? "fifo");
  if (matched.issues.length) throw new TradeCalculationError(matched.issues);

  const out: CalcIssue[] = [];
  const entries = list.filter((e) => e.side === entrySide);
  const exits = list.filter((e) => e.side !== entrySide);
  const entryQty = sum(entries.map((e) => e.quantity));
  const exitQty = sum(exits.map((e) => e.quantity));
  const openQty = entryQty.minus(exitQty);
  const status = openQty.isZero() ? "closed" : "open";
  if (status === "open") {
    out.push({ code: "OPEN_POSITION", severity: "info", message: `Position still open: ${openQty.toFixed()} remaining. P&L is realized only.` });
  }

  const avgEntry = weightedAverage(entries);
  const avgExit = weightedAverage(exits);
  const sign = direction === "long" ? 1 : -1;
  const pnlCurrency = input.instrument.quoteCurrency?.toUpperCase() ?? null;
  const accountCurrency = input.accountCurrency.toUpperCase();
  const mult = pnlMultiplier(input.instrument);
  if (!mult.ok) out.push({ code: "MISSING_INSTRUMENT_SPEC", severity: "warning", message: mult.reason });
  if (!pnlCurrency) {
    out.push({ code: "MISSING_INSTRUMENT_SPEC", severity: "warning", message: `${input.instrument.symbol}: quote currency is not configured.` });
  }

  // Per-lot realized P&L in quote currency, converted at each lot's exit date.
  let grossQuote: Dec | null = mult.ok ? ZERO : null;
  let grossAccount: Dec | null = mult.ok && pnlCurrency ? ZERO : null;
  const missingRates = new Set<string>();
  const lots: MatchedLot[] = matched.lots.map((lot) => {
    const pnlQuote = mult.ok ? lot.exitPrice.minus(lot.entryPrice).mul(lot.quantity).mul(mult.multiplier).mul(sign) : null;
    if (pnlQuote && grossQuote) grossQuote = grossQuote.plus(pnlQuote);
    if (pnlQuote && grossAccount && pnlCurrency) {
      const date = lot.exitAt.slice(0, 10);
      const converted = convert(pnlQuote, pnlCurrency, accountCurrency, date, fx);
      if (converted) grossAccount = grossAccount.plus(converted);
      else {
        missingRates.add(`${pnlCurrency}/${accountCurrency} on ${date}`);
        grossAccount = null;
      }
    }
    return {
      entryExecutionIndex: lot.entryIndex,
      exitExecutionIndex: lot.exitIndex,
      quantity: lot.quantity.toFixed(),
      entryPrice: lot.entryPrice.toFixed(),
      exitPrice: lot.exitPrice.toFixed(),
      exitAt: lot.exitAt,
      pnlQuote: toStr(pnlQuote),
    };
  });
  if (missingRates.size) {
    out.push({
      code: "MISSING_FX_RATE",
      severity: "warning",
      message: `Historical FX rate missing for ${[...missingRates].join(", ")}. Add it under Settings → FX rates; today's rate is never substituted.`,
    });
  }

  const fees = sum(list.map((e) => e.cost));
  const swap = parseDec(input.swap) ?? ZERO;
  let netPnl: Dec | null = grossAccount ? grossAccount.minus(fees).plus(swap) : null;
  let grossPnl: Dec | null = grossAccount;
  let pnlSource: PnlSource = netPnl ? "calculated" : "unavailable";

  const brokerNet = parseDec(input.brokerNetPnl);
  if (brokerNet) {
    if (netPnl && status === "closed" && netPnl.minus(brokerNet).abs().gt(RECONCILE_TOLERANCE)) {
      out.push({
        code: "BROKER_PNL_MISMATCH",
        severity: "warning",
        message: `Calculated net P&L ${netPnl.toFixed(2)} differs from broker-reported ${brokerNet.toFixed(2)}. Review the instrument specification.`,
      });
    } else if (!netPnl) {
      netPnl = brokerNet;
      grossPnl = brokerNet.plus(fees).minus(swap);
      pnlSource = "broker";
      out.push({ code: "USED_BROKER_PNL", severity: "info", message: "Using broker-reported P&L because the calculated value is unavailable." });
    }
  }

  // Initial risk (account currency).
  let initialRisk: Dec | null = null;
  let plannedRR: Dec | null = null;
  const manualRisk = parseDec(input.manualInitialRisk);
  const stop = parseDec(input.stopLoss);
  const target = parseDec(input.takeProfit);
  if (stop && avgEntry) {
    const stopValid = direction === "long" ? stop.lt(avgEntry) : stop.gt(avgEntry);
    if (!stopValid) {
      out.push({ code: "INVALID_STOP_LOSS", severity: "warning", message: `Stop loss must be ${direction === "long" ? "below" : "above"} the average entry for a ${direction} trade.` });
    } else {
      const riskPerUnit = avgEntry.minus(stop).abs();
      if (target) {
        const targetValid = direction === "long" ? target.gt(avgEntry) : target.lt(avgEntry);
        if (targetValid) plannedRR = target.minus(avgEntry).abs().div(riskPerUnit);
      }
      if (!manualRisk && mult.ok && pnlCurrency) {
        const riskQuote = riskPerUnit.mul(entryQty).mul(mult.multiplier);
        const riskDate = list[0].executedAt.slice(0, 10);
        initialRisk = convert(riskQuote, pnlCurrency, accountCurrency, riskDate, fx);
        if (!initialRisk) {
          out.push({ code: "MISSING_FX_RATE", severity: "warning", message: `FX rate ${pnlCurrency}/${accountCurrency} on ${riskDate} missing; initial risk unavailable.` });
        }
      }
    }
  }
  if (manualRisk && manualRisk.gt(0)) initialRisk = manualRisk;
  if (!initialRisk && !stop && !manualRisk) {
    out.push({ code: "NO_STOP_LOSS", severity: "info", message: "No stop loss or initial risk recorded; R-multiple unavailable." });
  }

  const rMultiple = netPnl && initialRisk && initialRisk.gt(0) && status === "closed" ? netPnl.div(initialRisk) : null;
  const tolerance = parseDec(input.breakevenTolerance) ?? ZERO;
  const outcome = netPnl && status === "closed" ? classifyOutcome(netPnl, tolerance) : null;
  const openedAt = list[0].executedAt;
  const closedAt = status === "closed" ? exits[exits.length - 1].executedAt : null;

  return {
    direction,
    status,
    entryQuantity: entryQty.toFixed(),
    exitQuantity: exitQty.toFixed(),
    openQuantity: openQty.toFixed(),
    avgEntryPrice: toStr(avgEntry),
    avgExitPrice: toStr(avgExit),
    openedAt,
    closedAt,
    holdingSeconds: closedAt ? Math.round((Date.parse(closedAt) - Date.parse(openedAt)) / 1000) : null,
    pnlCurrency,
    grossPnlQuote: toStr(grossQuote),
    grossPnl: toStr(grossPnl),
    fees: toStr(fees)!,
    swap: toStr(swap)!,
    netPnl: toStr(netPnl),
    pnlSource,
    initialRisk: toStr(initialRisk),
    rMultiple: toStr(rMultiple, 4),
    plannedRewardRisk: toStr(plannedRR, 4),
    outcome,
    lots,
    issues: out,
  };
}
