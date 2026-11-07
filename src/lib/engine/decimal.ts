/**
 * Decimal configuration for all EDGELOG financial math.
 * RULE: never use JS number arithmetic for money, prices or quantities.
 * Values cross module boundaries as strings (DecimalString) and are only
 * converted to `number` at the very edge for charts.
 */
import Decimal from "decimal.js";

export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type DecimalString = string;
export type DecInput = Dec | string | number;

/** Fixed precision used when persisting money (matches numeric(28,10)). */
export const STORAGE_DP = 10;

export const ZERO = new D(0);

export function dec(v: DecInput): Dec {
  if (v instanceof D) return v;
  if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`Non-finite number: ${v}`);
  return new D(v);
}

/** Parse untrusted input; returns null for empty/invalid values instead of throwing. */
export function parseDec(v: unknown): Dec | null {
  if (v === null || v === undefined) return null;
  if (v instanceof D) return v;
  const s = String(v).trim();
  if (s === "") return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  try {
    const d = new D(s);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export function toStr(v: Dec | null | undefined, dp: number = STORAGE_DP): DecimalString | null {
  if (v === null || v === undefined) return null;
  return v.toDecimalPlaces(dp).toFixed();
}

export function sum(values: Dec[]): Dec {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

/** Convert to a JS number for display/charting ONLY. */
export function toChartNumber(v: DecInput | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return dec(v).toNumber();
}
