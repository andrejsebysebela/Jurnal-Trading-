import { formatInTimeZone } from "date-fns-tz";
import { D, parseDec } from "@/lib/engine";

/** Format a decimal string as money. Accepts null → "—". Never does float math on the value. */
export function money(v: string | null | undefined, currency = "USD", opts: { sign?: boolean; compact?: boolean } = {}): string {
  const d = parseDec(v);
  if (!d) return "—";
  const rounded = d.toDecimalPlaces(2);
  const abs = rounded.abs();
  const sym = currencySymbol(currency);
  let body: string;
  if (opts.compact && abs.gte(10000)) {
    body = abs.gte(1_000_000) ? `${abs.div(1_000_000).toDecimalPlaces(2).toFixed()}M` : `${abs.div(1000).toDecimalPlaces(1).toFixed()}K`;
  } else {
    body = groupThousands(abs.toFixed(2));
  }
  const sign = rounded.isNeg() && !rounded.isZero() ? "-" : opts.sign && rounded.gt(0) ? "+" : "";
  return `${sign}${sym}${body}`;
}

export function groupThousands(fixed: string): string {
  const [int, frac] = fixed.split(".");
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac !== undefined ? `${g}.${frac}` : g;
}

export function currencySymbol(c: string): string {
  const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ", AUD: "A$", CAD: "C$", NZD: "NZ$", CZK: "Kč " };
  return map[c?.toUpperCase()] ?? `${c} `;
}

export function pct(v: string | number | null | undefined, dp = 1): string {
  if (v === null || v === undefined) return "—";
  const d = parseDec(v);
  return d ? `${d.toDecimalPlaces(dp).toFixed(dp)}%` : "—";
}

export function ratio(v: string | null | undefined, dp = 2): string {
  const d = parseDec(v);
  return d ? d.toDecimalPlaces(dp).toFixed(dp) : "—";
}

export function rMultiple(v: string | null | undefined): string {
  const d = parseDec(v);
  if (!d) return "—";
  return `${d.gt(0) ? "+" : ""}${d.toDecimalPlaces(2).toFixed(2)}R`;
}

/** Trim trailing zeros of a stored decimal (prices/quantities). */
export function plain(v: string | null | undefined, maxDp = 6): string {
  const d = parseDec(v);
  return d ? groupThousands(d.toDecimalPlaces(maxDp).toFixed()) : "—";
}

export function tone(v: string | null | undefined): "profit" | "loss" | "neutral" {
  const d = parseDec(v);
  if (!d || d.isZero()) return "neutral";
  return d.gt(0) ? "profit" : "loss";
}

export const toneClass = { profit: "text-profit", loss: "text-loss", neutral: "text-fg-2" } as const;

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function fmtDate(iso: string | null | undefined, tz: string, pattern = "MMM d, yyyy"): string {
  if (!iso) return "—";
  return formatInTimeZone(iso, tz, pattern);
}

export function isZeroOrNull(v: string | null | undefined) {
  const d = parseDec(v);
  return !d || d.isZero();
}

export { D };

/** Stored decimal → form input value (trailing zeros removed, no grouping). */
export function inputDec(v: string | null | undefined): string {
  const d = parseDec(v);
  return d ? d.toFixed() : "";
}
