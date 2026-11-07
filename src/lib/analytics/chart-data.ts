import { format, parseISO, subDays } from "date-fns";
import { toChartNumber } from "@/lib/engine";
import type { Formatter } from "@/lib/i18n/format";
import type { DailyPoint, EquityPoint, GroupRow, MonthlyPoint } from "./series";

/** Conversion to JS numbers happens ONLY here, for rendering. */
/** Equity series anchored at 0 (or the starting balance) the day before the first trade. */
export const toEquityData = (pts: EquityPoint[], startingBalance?: string | null) => {
  const data = pts.map((p) => ({ date: p.date, cumulative: toChartNumber(p.cumulativePnl), daily: toChartNumber(p.dailyPnl), equity: p.equity ? toChartNumber(p.equity) : null }));
  if (!data.length) return data;
  const origin = format(subDays(parseISO(data[0].date), 1), "yyyy-MM-dd");
  return [{ date: origin, cumulative: 0, daily: 0, equity: startingBalance ? toChartNumber(startingBalance) : null }, ...data];
};
export const toDailyData = (pts: DailyPoint[]) => pts.map((p) => ({ date: p.date, pnl: toChartNumber(p.netPnl), trades: p.trades }));
export const toMonthlyData = (pts: MonthlyPoint[]) => pts.map((p) => ({ month: p.month, pnl: toChartNumber(p.netPnl), trades: p.trades }));
export const toGroupData = (rows: GroupRow[], f: Formatter, limit = 10) =>
  rows.slice(0, limit).map((r) => ({ label: r.label, pnl: toChartNumber(r.summary.netPnl), trades: r.summary.totalTrades, winRate: f.pct(r.summary.winRate) }));
