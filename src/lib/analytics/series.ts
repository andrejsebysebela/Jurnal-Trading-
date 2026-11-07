import { formatInTimeZone } from "date-fns-tz";
import { type Dec, ZERO, parseDec, toStr, D } from "@/lib/engine";
import { realized, summarize } from "./metrics";
import type { AnalyticsTrade, Summary } from "./types";

export function dayKey(iso: string, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, "yyyy-MM-dd");
}

export interface DailyPoint {
  date: string;
  netPnl: string;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
}

/** Daily realized P&L, keyed by close date in the user's timezone. */
export function dailySeries(trades: AnalyticsTrade[], timeZone: string): DailyPoint[] {
  const map = new Map<string, { net: Dec; trades: number; wins: number; losses: number; breakevens: number }>();
  for (const t of realized(trades)) {
    const key = dayKey(t.closedAt!, timeZone);
    const d = map.get(key) ?? { net: ZERO, trades: 0, wins: 0, losses: 0, breakevens: 0 };
    d.net = d.net.plus(t.net);
    d.trades++;
    if (t.outcome === "win") d.wins++;
    else if (t.outcome === "loss") d.losses++;
    else if (t.outcome === "breakeven") d.breakevens++;
    map.set(key, d);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, netPnl: toStr(d.net)!, trades: d.trades, wins: d.wins, losses: d.losses, breakevens: d.breakevens }));
}

export interface EquityPoint {
  date: string;
  dailyPnl: string;
  cumulativePnl: string;
  equity: string | null;
}

export function equityCurve(daily: DailyPoint[], startingBalance?: string | null): EquityPoint[] {
  const start = parseDec(startingBalance);
  let cum = ZERO;
  return daily.map((d) => {
    cum = cum.plus(parseDec(d.netPnl)!);
    return { date: d.date, dailyPnl: d.netPnl, cumulativePnl: toStr(cum)!, equity: start ? toStr(start.plus(cum)) : null };
  });
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  netPnl: string;
  trades: number;
}

export function monthlySeries(daily: DailyPoint[], year?: number): MonthlyPoint[] {
  const map = new Map<string, { net: Dec; trades: number }>();
  if (year) for (let m = 1; m <= 12; m++) map.set(`${year}-${String(m).padStart(2, "0")}`, { net: ZERO, trades: 0 });
  for (const d of daily) {
    const key = d.date.slice(0, 7);
    if (year && !key.startsWith(String(year))) continue;
    const v = map.get(key) ?? { net: ZERO, trades: 0 };
    v.net = v.net.plus(parseDec(d.netPnl)!);
    v.trades += d.trades;
    map.set(key, v);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, netPnl: toStr(v.net)!, trades: v.trades }));
}

export interface GroupRow {
  key: string;
  label: string;
  summary: Summary;
}

export function groupBy(trades: AnalyticsTrade[], keyFn: (t: AnalyticsTrade) => string | string[] | null, labelFn?: (key: string) => string): GroupRow[] {
  const map = new Map<string, AnalyticsTrade[]>();
  for (const t of trades) {
    const raw = keyFn(t);
    const keys = raw === null ? ["—"] : Array.isArray(raw) ? (raw.length ? raw : []) : [raw];
    for (const k of keys) {
      const list = map.get(k) ?? [];
      list.push(t);
      map.set(k, list);
    }
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, label: labelFn ? labelFn(key) : key, summary: summarize(list) }))
    .sort((a, b) => new D(b.summary.netPnl).comparedTo(new D(a.summary.netPnl)));
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function byWeekday(trades: AnalyticsTrade[], timeZone: string): GroupRow[] {
  const rows = groupBy(trades.filter((t) => t.closedAt), (t) => formatInTimeZone(t.openedAt, timeZone, "i"));
  return rows.map((r) => ({ ...r, label: WEEKDAYS[Number(r.key) - 1] })).sort((a, b) => Number(a.key) - Number(b.key));
}

export function byHour(trades: AnalyticsTrade[], timeZone: string): GroupRow[] {
  const rows = groupBy(trades, (t) => formatInTimeZone(t.openedAt, timeZone, "HH"));
  return rows.map((r) => ({ ...r, label: `${r.key}:00` })).sort((a, b) => a.key.localeCompare(b.key));
}

export function holdingBucket(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 300) return "< 5m";
  if (seconds < 1800) return "5–30m";
  if (seconds < 3600) return "30–60m";
  if (seconds < 4 * 3600) return "1–4h";
  if (seconds < 86400) return "4–24h";
  if (seconds < 7 * 86400) return "1–7d";
  return "> 7d";
}

export function rBucket(r: string | null): string | null {
  const v = parseDec(r);
  if (!v) return null;
  if (v.lt(-2)) return "< -2R";
  if (v.lt(-1)) return "-2R to -1R";
  if (v.lt(0)) return "-1R to 0R";
  if (v.lt(1)) return "0R to 1R";
  if (v.lt(2)) return "1R to 2R";
  if (v.lt(3)) return "2R to 3R";
  return "≥ 3R";
}
export const R_BUCKETS = ["< -2R", "-2R to -1R", "-1R to 0R", "0R to 1R", "1R to 2R", "2R to 3R", "≥ 3R"];
