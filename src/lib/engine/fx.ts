import { type Dec, parseDec } from "./decimal";
import type { FxRateLookup } from "./types";

export interface FxRateRow {
  base: string;
  quote: string;
  /** YYYY-MM-DD (UTC) */
  date: string;
  rate: string;
}

/**
 * Build a strict historical lookup. Only exact-date rates (direct or inverse)
 * are used — there is intentionally NO fallback to the latest rate. An
 * optional `maxStaleDays` allows using the closest PRIOR rate (e.g. weekends),
 * never a future one.
 */
export function createFxLookup(rows: FxRateRow[], opts: { maxStaleDays?: number } = {}): FxRateLookup {
  const byPair = new Map<string, FxRateRow[]>();
  for (const r of rows) {
    const key = `${r.base.toUpperCase()}/${r.quote.toUpperCase()}`;
    const list = byPair.get(key) ?? [];
    list.push(r);
    byPair.set(key, list);
  }
  for (const list of byPair.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  const maxStale = opts.maxStaleDays ?? 0;

  const find = (base: string, quote: string, date: string): Dec | null => {
    const list = byPair.get(`${base}/${quote}`);
    if (!list) return null;
    let best: FxRateRow | null = null;
    for (const r of list) {
      if (r.date > date) break;
      best = r;
    }
    if (!best) return null;
    const ageDays = (Date.parse(date) - Date.parse(best.date)) / 86_400_000;
    if (ageDays > maxStale) return null;
    const rate = parseDec(best.rate);
    return rate && rate.gt(0) ? rate : null;
  };

  return (from, to, date) => {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return "1";
    const direct = find(f, t, date);
    if (direct) return direct.toFixed();
    const inverse = find(t, f, date);
    if (inverse) return inverse.pow(-1).toFixed();
    return null;
  };
}

/** Convert an amount; returns null when the rate is unavailable. */
export function convert(amount: Dec, from: string, to: string, date: string, lookup?: FxRateLookup): Dec | null {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  if (!lookup) return null;
  const rate = parseDec(lookup(from, to, date));
  return rate ? amount.mul(rate) : null;
}
