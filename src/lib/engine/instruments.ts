import { D, type Dec, parseDec } from "./decimal";
import type { InstrumentSpec } from "./types";

export type MultiplierResult =
  | { ok: true; multiplier: Dec; basis: string }
  | { ok: false; reason: string };

/**
 * Money value (quote currency) of a 1.0 price move per 1 unit of trade quantity.
 *
 * Priority:
 *  1. explicit pointValue
 *  2. tickValue / tickSize
 *  3. asset-class rule using configured contractSize / contractMultiplier
 *  4. stocks & crypto default to 1 (quantity = shares/coins)
 * Forex, CFD and futures without configured specs are UNAVAILABLE — never guessed.
 */
export function pnlMultiplier(spec: InstrumentSpec): MultiplierResult {
  const pointValue = parseDec(spec.pointValue);
  if (pointValue && pointValue.gt(0)) return { ok: true, multiplier: pointValue, basis: "pointValue" };

  const tickValue = parseDec(spec.tickValue);
  const tickSize = parseDec(spec.tickSize);
  if (tickValue && tickSize && tickValue.gt(0) && tickSize.gt(0)) {
    return { ok: true, multiplier: tickValue.div(tickSize), basis: "tickValue/tickSize" };
  }

  const contractSize = parseDec(spec.contractSize);
  const contractMultiplier = parseDec(spec.contractMultiplier);

  switch (spec.assetClass) {
    case "forex":
    case "cfd": {
      if (contractSize && contractSize.gt(0)) {
        const m = contractMultiplier && contractMultiplier.gt(0) ? contractSize.mul(contractMultiplier) : contractSize;
        return { ok: true, multiplier: m, basis: "contractSize" };
      }
      return {
        ok: false,
        reason: `${spec.symbol}: contract size (units per lot) is not configured. Configure it under Instruments.`,
      };
    }
    case "futures": {
      if (contractMultiplier && contractMultiplier.gt(0)) {
        return { ok: true, multiplier: contractMultiplier, basis: "contractMultiplier" };
      }
      return {
        ok: false,
        reason: `${spec.symbol}: point value, tick value/size or contract multiplier is not configured.`,
      };
    }
    case "stock":
    case "crypto": {
      const m = contractMultiplier && contractMultiplier.gt(0) ? contractMultiplier : new D(1);
      return { ok: true, multiplier: m, basis: contractMultiplier ? "contractMultiplier" : "unit" };
    }
  }
}

export interface SpecValidationIssue {
  field: keyof InstrumentSpec;
  message: string;
}

/** Review an instrument spec and list what is missing for accurate P&L. */
export function reviewInstrumentSpec(spec: InstrumentSpec): SpecValidationIssue[] {
  const issues: SpecValidationIssue[] = [];
  const m = pnlMultiplier(spec);
  if (!m.ok) issues.push({ field: "contractSize", message: m.reason });
  if (!spec.quoteCurrency) {
    issues.push({ field: "quoteCurrency", message: "Quote/settlement currency is required to convert P&L." });
  }
  const tickSize = parseDec(spec.tickSize);
  const tickValue = parseDec(spec.tickValue);
  if ((tickSize && !tickValue) || (!tickSize && tickValue)) {
    issues.push({ field: "tickValue", message: "Tick size and tick value must be configured together." });
  }
  return issues;
}

/** Validate a quantity against lot step / min lot if configured. */
export function validateLotQuantity(spec: InstrumentSpec, quantity: string): string | null {
  const q = parseDec(quantity);
  if (!q || q.lte(0)) return "Quantity must be a positive number.";
  const min = parseDec(spec.minLot);
  if (min && q.lt(min)) return `Quantity is below the minimum lot (${min.toFixed()}).`;
  const step = parseDec(spec.lotStep);
  if (step && step.gt(0) && !q.mod(step).isZero()) return `Quantity must be a multiple of ${step.toFixed()}.`;
  return null;
}
