import { describe, expect, it } from "vitest";
import {
  bestWorstDay, byWeekday, dailySeries, disciplineScore, equityCurve, groupBy, maxDrawdown, mistakeSummary,
  monthlySeries, propStatus, rBucket, summarize, type AnalyticsTrade,
} from "./index";
import { D } from "@/lib/engine";

let n = 0;
function tr(p: Partial<AnalyticsTrade>): AnalyticsTrade {
  n++;
  return {
    id: `t${String(n).padStart(3, "0")}`, accountId: "a1", symbol: "ES", assetClass: "futures", direction: "long",
    status: "closed", openedAt: p.closedAt ?? "2024-01-01T00:00:00Z", closedAt: null, netPnl: null, grossPnl: null,
    fees: "0", rMultiple: null, holdingSeconds: 600, outcome: null, strategyId: null, strategyName: null, session: null,
    tags: [], mistakes: [], ruleCompliant: null, disciplineRating: null, ...p,
  };
}

const trades: AnalyticsTrade[] = [
  tr({ closedAt: "2024-01-02T10:00:00Z", netPnl: "100", grossPnl: "104", fees: "4", rMultiple: "1", outcome: "win", strategyName: "ORB", mistakes: [] }),
  tr({ closedAt: "2024-01-02T15:00:00Z", netPnl: "-50", grossPnl: "-46", fees: "4", rMultiple: "-1", outcome: "loss", strategyName: "ORB", mistakes: ["FOMO"] }),
  tr({ closedAt: "2024-01-03T10:00:00Z", netPnl: "200", grossPnl: "204", fees: "4", rMultiple: "2", outcome: "win", strategyName: "Pullback", symbol: "NQ" }),
  tr({ closedAt: "2024-01-04T10:00:00Z", netPnl: "0", grossPnl: "4", fees: "4", outcome: "breakeven", strategyName: "Pullback" }),
  tr({ closedAt: "2024-01-05T10:00:00Z", netPnl: "-150", grossPnl: "-146", fees: "4", rMultiple: "-1.5", outcome: "loss", mistakes: ["FOMO", "Moved stop"], direction: "short" }),
  tr({ closedAt: "2024-01-05T11:00:00Z", netPnl: null, outcome: null }),
  tr({ status: "open", closedAt: null, openedAt: "2024-01-06T10:00:00Z" }),
];

describe("summarize", () => {
  const s = summarize(trades, { startingBalance: "10000" });
  it("counts trades", () => {
    expect(s).toMatchObject({ totalTrades: 7, closedTrades: 6, openTrades: 1, unavailableTrades: 1, wins: 2, losses: 2, breakevens: 1 });
  });
  it("computes money metrics exactly", () => {
    expect(s.netPnl).toBe("100");
    expect(s.grossPnl).toBe("120");
    expect(s.fees).toBe("20");
    expect(s.winRate).toBe("50");
    expect(s.profitFactor).toBe("1.5");
    expect(s.avgWinner).toBe("150");
    expect(s.avgLoser).toBe("-100");
    expect(s.expectancy).toBe("20");
    expect(s.avgR).toBe("0.125");
    expect(s.largestWinner).toBe("200");
    expect(s.largestLoser).toBe("-150");
  });
  it("computes drawdown and streaks", () => {
    expect(s.maxDrawdown).toBe("150");
    expect(new D(s.maxDrawdownPct!).toFixed(4)).toBe("1.4634");
    expect(s.currentStreak).toEqual({ type: "loss", count: 1 });
    expect(s.longestWinStreak).toBe(1);
  });
  it("handles empty and loss-free sets", () => {
    const e = summarize([]);
    expect(e.netPnl).toBe("0");
    expect(e.winRate).toBeNull();
    expect(e.profitFactor).toBeNull();
    const w = summarize([trades[0]]);
    expect(w.profitFactor).toBeNull();
    expect(w.profitFactorInfinite).toBe(true);
  });
});

describe("series", () => {
  const daily = dailySeries(trades, "UTC");
  it("aggregates by day", () => {
    expect(daily.map((d) => [d.date, d.netPnl, d.trades])).toEqual([
      ["2024-01-02", "50", 2], ["2024-01-03", "200", 1], ["2024-01-04", "0", 1], ["2024-01-05", "-150", 1],
    ]);
  });
  it("respects the user's timezone", () => {
    const late = [tr({ closedAt: "2024-01-02T23:30:00Z", netPnl: "10", outcome: "win" })];
    expect(dailySeries(late, "America/New_York")[0].date).toBe("2024-01-02");
    expect(dailySeries(late, "Asia/Tokyo")[0].date).toBe("2024-01-03");
  });
  it("builds equity curve and months", () => {
    const eq = equityCurve(daily, "10000");
    expect(eq.map((p) => p.cumulativePnl)).toEqual(["50", "250", "250", "100"]);
    expect(eq.at(-1)!.equity).toBe("10100");
    const m = monthlySeries(daily, 2024);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ month: "2024-01", netPnl: "100", trades: 5 });
  });
  it("groups by strategy and weekday", () => {
    const g = groupBy(trades, (t) => t.strategyName);
    expect(g[0].key).toBe("Pullback");
    expect(g.find((x) => x.key === "ORB")!.summary.netPnl).toBe("50");
    const wd = byWeekday(trades, "UTC");
    expect(wd[0].label).toBe("Tue");
  });
  it("buckets R", () => {
    expect(rBucket("-1")).toBe("-1R to 0R");
    expect(rBucket("3")).toBe("≥ 3R");
    expect(rBucket(null)).toBeNull();
  });
});

describe("insights", () => {
  it("ranks mistakes by frequency and cost", () => {
    expect(mistakeSummary(trades)).toEqual([
      { mistake: "FOMO", count: 2, netPnl: "-200" },
      { mistake: "Moved stop", count: 1, netPnl: "-150" },
    ]);
  });
  it("discipline score blends compliance and rating", () => {
    expect(disciplineScore([])).toBeNull();
    expect(disciplineScore([tr({ ruleCompliant: true }), tr({ ruleCompliant: false })])).toBe(50);
    expect(disciplineScore([tr({ ruleCompliant: true, disciplineRating: 5 })])).toBe(80);
  });
  it("best/worst day", () => {
    const { best, worst } = bestWorstDay(dailySeries(trades, "UTC"));
    expect(best!.date).toBe("2024-01-03");
    expect(worst!.date).toBe("2024-01-05");
  });
  it("max drawdown without starting balance has no pct", () => {
    const r = maxDrawdown([new D(-10), new D(5)]);
    expect(r.amount.toFixed()).toBe("10");
    expect(r.pct).toBeNull();
  });
  it("prop firm static vs trailing drawdown", () => {
    const base = { startingBalance: "10000", profitTarget: "1000", maxDailyLoss: "200", maxTotalDrawdown: "500" };
    const s = propStatus(trades, { ...base, drawdownType: "static" }, "UTC", "2024-01-05");
    expect(s).toMatchObject({ balance: "10100", profitTargetProgressPct: 10, drawdownUsed: "0", todayPnl: "-150", dailyLossUsedPct: 75, breached: false });
    const tr2 = propStatus(trades, { ...base, drawdownType: "trailing" }, "UTC", "2024-01-05");
    expect(tr2.drawdownUsed).toBe("150");
    expect(tr2.drawdownUsedPct).toBe(30);
    expect(tr2.remainingDrawdown).toBe("350");
    const breach = propStatus(trades, { ...base, maxDailyLoss: "150", drawdownType: "static" }, "UTC", "2024-01-05");
    expect(breach.status).toBe("breached");
  });
});
