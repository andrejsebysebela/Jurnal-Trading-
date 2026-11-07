import { describe, expect, it } from "vitest";
import { computeSimpleTrade, SimpleTradeError } from "./simple";

const base = { openedAt: "2026-11-05T09:00:00Z", closedAt: "2026-11-05T11:30:00Z" };

describe("computeSimpleTrade", () => {
  it("computes R, outcome and holding time exactly", () => {
    const r = computeSimpleTrade({ ...base, risk: "100", result: "250.5", plannedRR: "2.5" });
    expect(r).toEqual({ netPnl: "250.5", initialRisk: "100", rMultiple: "2.505", plannedRR: "2.5", outcome: "win", holdingSeconds: 9000 });
  });
  it("handles losses, breakeven and decimal precision", () => {
    expect(computeSimpleTrade({ ...base, risk: "0.3", result: "-0.1" }).rMultiple).toBe("-0.3333");
    expect(computeSimpleTrade({ ...base, risk: "50", result: "-50" }).outcome).toBe("loss");
    const be = computeSimpleTrade({ ...base, risk: "50", result: "0" });
    expect(be.outcome).toBe("breakeven");
    expect(be.rMultiple).toBe("0");
    expect(computeSimpleTrade({ ...base, risk: "33.3", result: "0.1", plannedRR: "" }).plannedRR).toBeNull();
  });
  it("rejects invalid input", () => {
    expect(() => computeSimpleTrade({ ...base, risk: "0", result: "10" })).toThrow(SimpleTradeError);
    expect(() => computeSimpleTrade({ ...base, risk: "abc", result: "10" })).toThrow(/Risk/);
    expect(() => computeSimpleTrade({ ...base, risk: "10", result: "x" })).toThrow(/Result/);
    expect(() => computeSimpleTrade({ ...base, risk: "10", result: "1", plannedRR: "-1" })).toThrow(/RR/);
    expect(() => computeSimpleTrade({ risk: "10", result: "1", openedAt: base.closedAt, closedAt: base.openedAt })).toThrow(/before/);
  });
});
