import { sk as skLocale, enUS } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { parseDec } from "@/lib/engine/decimal";
import type { Locale } from "./config";

const TAG: Record<Locale, string> = { sk: "sk-SK", en: "en-US" };

/**
 * Locale-aware formatting. Decimal strings are rounded with decimal.js and passed to
 * Intl.NumberFormat as STRINGS (exact) — never through a JS float.
 */
export function createFormatter(locale: Locale) {
  const tag = TAG[locale];
  const dfLocale = locale === "sk" ? skLocale : enUS;
  const cache = new Map<string, Intl.NumberFormat>();
  const nf = (key: string, opts: Intl.NumberFormatOptions) => {
    let f = cache.get(key);
    if (!f) { f = new Intl.NumberFormat(tag, opts); cache.set(key, f); }
    return f;
  };

  /**
   * Money with the currency symbol ($, €). `kpi: true` abbreviates large amounts (≥ 10 000) for tight tiles:
   * "+100 tis. $" / "+$100K"; the exact value should be shown in a tooltip (use `money()` without `kpi`).
   */
  const money = (v: string | null | undefined, currency = "USD", opts: { sign?: boolean; compact?: boolean; kpi?: boolean } = {}): string => {
    const d = parseDec(v);
    if (!d) return "—";
    const signDisplay = opts.sign ? "exceptZero" : "auto";
    if ((opts.compact || opts.kpi) && d.abs().gte(10000)) {
      return nf(`mc${currency}${signDisplay}`, { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1, signDisplay })
        .format(d.toDecimalPlaces(0).toFixed() as `${number}`);
    }
    return nf(`m${currency}${signDisplay}`, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay })
      .format(d.toDecimalPlaces(2).toFixed(2) as `${number}`);
  };

  const num = (v: string | number | null | undefined, maxDp = 2, minDp = 0): string => {
    const d = parseDec(v);
    if (!d) return "—";
    return nf(`n${maxDp}-${minDp}`, { maximumFractionDigits: maxDp, minimumFractionDigits: minDp }).format(d.toDecimalPlaces(maxDp).toFixed() as `${number}`);
  };

  const pct = (v: string | number | null | undefined, dp = 1): string => {
    const d = parseDec(v);
    if (!d) return "—";
    return `${num(d.toDecimalPlaces(dp).toFixed(dp), dp, dp)} %`.replace(" %", locale === "sk" ? " %" : "%");
  };

  /** Realized R-multiple, e.g. +1.25R */
  const r = (v: string | null | undefined): string => {
    const d = parseDec(v);
    if (!d) return "—";
    return `${d.gt(0) ? "+" : ""}${num(d.toDecimalPlaces(2).toFixed(2), 2, 2)}R`;
  };

  /** Planned reward:risk, e.g. 1:2.5 */
  const rr = (v: string | null | undefined): string => {
    const d = parseDec(v);
    return d ? `1:${num(d.toFixed(), 2)}` : "—";
  };

  const date = (iso: string | null | undefined, tz: string, pattern = "d MMM yyyy"): string =>
    iso ? formatInTimeZone(iso, tz, pattern, { locale: dfLocale }) : "—";

  const duration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return "—";
    const d = locale === "sk" ? { s: "s", m: "min", h: "h", d: "d" } : { s: "s", m: "m", h: "h", d: "d" };
    if (seconds < 60) return `${seconds} ${d.s}`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} ${d.m}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${d.h} ${m % 60} ${d.m}`;
    return `${Math.floor(h / 24)} ${d.d} ${h % 24} ${d.h}`;
  };

  /** Compact axis label for charts (number input is fine here: display only). */
  const axisMoney = (v: number, currency: string) =>
    nf(`ax${currency}`, { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }).format(v);

  return { locale, tag, dfLocale, money, num, pct, r, rr, date, duration, axisMoney };
}

export type Formatter = ReturnType<typeof createFormatter>;
