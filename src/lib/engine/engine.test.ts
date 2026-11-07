import { describe, expect, it } from "vitest";
import {
  computeTrade,
  createFxLookup,
  groupExecutionsIntoTrades,
  pnlMultiplier,
  reviewInstrumentSpec,
  TradeCalculationError,
  validateLotQuantity,
  type InstrumentSpec,
  type TradeInput,
} from "./index";

const EURUSD: InstrumentSpec = { symbol: "EURUSD", assetClass: "forex", contractSize: "100000", quoteCurrency: "USD", baseCurrency: "EUR" };
const ES: InstrumentSpec = { symbol: "ES", assetClass: "futures", pointValue: "50", quoteCurrency: "USD" };
const NQ: InstrumentSpec = { symbol: "NQ", assetClass: "futures", tickSize: "0.25", tickValue: "5", quoteCurrency: "USD" };
const AAPL: InstrumentSpec = { symbol: "AAPL", assetClass: "stock", quoteCurrency: "USD" };
const USDJPY: InstrumentSpec = { symbol: "USDJPY", assetClass: "forex", contractSize: "100000", quoteCurrency: "JPY", baseCurrency: "USD" };

const t = (h: number, day = "2024-03-05") => `${day}T${String(h).padStart(2, "0")}:00:00.000Z`;

function trade(partial: Partial<TradeInput> & Pick<TradeInput, "executions" | "instrument">): TradeInput {
  return { accountCurrency: "USD", ...partial };
}

describe("instrument multiplier", () => {
  it("prefers pointValue, then tick value/size", () => {
    expect(pnlMultiplier(ES)).toMatchObject({ ok: true, basis: "pointValue" });
    const nq = pnlMultiplier(NQ);
    expect(nq.ok && nq.multiplier.toFixed()).toBe("20");
  });
  it("never invents forex/futures specs", () => {
    expect(pnlMultiplier({ symbol: "GBPUSD", assetClass: "forex" }).ok).toBe(false);
    expect(pnlMultiplier({ symbol: "CL", assetClass: "futures" }).ok).toBe(false);
    expect(reviewInstrumentSpec({ symbol: "X", assetClass: "cfd" }).length).toBeGreaterThan(0);
  });
  it("stocks and crypto default to 1 unit", () => {
    const m = pnlMultiplier(AAPL);
    expect(m.ok && m.multiplier.toFixed()).toBe("1");
  });
  it("validates lot steps", () => {
    const spec = { ...EURUSD, lotStep: "0.01", minLot: "0.01" };
    expect(validateLotQuantity(spec, "0.015")).toMatch(/multiple/);
    expect(validateLotQuantity(spec, "0.001")).toMatch(/minimum/);
    expect(validateLotQuantity(spec, "0.05")).toBeNull();
  });
});

describe("computeTrade", () => {
  it("forex long with commission, stop and R", () => {
    const r = computeTrade(
      trade({
        instrument: EURUSD,
        stopLoss: "1.09500",
        takeProfit: "1.11500",
        executions: [
          { side: "buy", quantity: "1", price: "1.10000", executedAt: t(9), commission: "3.5" },
          { side: "sell", quantity: "1", price: "1.10500", executedAt: t(11), commission: "3.5" },
        ],
      }),
    );
    expect(r.direction).toBe("long");
    expect(r.status).toBe("closed");
    expect(r.grossPnl).toBe("500");
    expect(r.fees).toBe("7");
    expect(r.netPnl).toBe("493");
    expect(r.initialRisk).toBe("500");
    expect(r.rMultiple).toBe("0.986");
    expect(r.plannedRewardRisk).toBe("3");
    expect(r.outcome).toBe("win");
    expect(r.holdingSeconds).toBe(7200);
  });

  it("futures short using point value", () => {
    const r = computeTrade(
      trade({
        instrument: ES,
        executions: [
          { side: "sell", quantity: "2", price: "5000", executedAt: t(14), fee: "2.10" },
          { side: "buy", quantity: "2", price: "4990", executedAt: t(15), fee: "2.10" },
        ],
      }),
    );
    expect(r.direction).toBe("short");
    expect(r.grossPnl).toBe("1000");
    expect(r.netPnl).toBe("995.8");
  });

  it("futures with tick size/value", () => {
    const r = computeTrade(trade({ instrument: NQ, executions: [
      { side: "buy", quantity: "1", price: "15000", executedAt: t(14) },
      { side: "sell", quantity: "1", price: "15010.25", executedAt: t(15) },
    ] }));
    expect(r.grossPnl).toBe("205");
  });

  it("is decimal-exact (no float drift)", () => {
    const r = computeTrade(trade({ instrument: AAPL, executions: [
      { side: "buy", quantity: "3", price: "0.1", executedAt: t(1) },
      { side: "sell", quantity: "3", price: "0.3", executedAt: t(2) },
    ] }));
    expect(r.grossPnl).toBe("0.6");
  });

  it("partial exits with FIFO vs LIFO", () => {
    const execs = [
      { side: "buy" as const, quantity: "1", price: "100", executedAt: t(1) },
      { side: "buy" as const, quantity: "1", price: "110", executedAt: t(2) },
      { side: "sell" as const, quantity: "1", price: "120", executedAt: t(3) },
    ];
    const fifo = computeTrade(trade({ instrument: AAPL, executions: execs }));
    expect(fifo.status).toBe("open");
    expect(fifo.openQuantity).toBe("1");
    expect(fifo.grossPnl).toBe("20");
    expect(fifo.outcome).toBeNull();
    expect(fifo.rMultiple).toBeNull();
    const lifo = computeTrade(trade({ instrument: AAPL, executions: execs, matchingPolicy: "lifo" }));
    expect(lifo.grossPnl).toBe("10");

    const closed = computeTrade(trade({ instrument: AAPL, executions: [...execs, { side: "sell", quantity: "1", price: "105", executedAt: t(4) }] }));
    expect(closed.status).toBe("closed");
    expect(closed.avgEntryPrice).toBe("105");
    expect(closed.avgExitPrice).toBe("112.5");
    expect(closed.grossPnl).toBe("15");
    expect(closed.lots).toHaveLength(2);
  });

  it("sorts executions chronologically regardless of input order", () => {
    const r = computeTrade(trade({ instrument: AAPL, executions: [
      { side: "sell", quantity: "1", price: "12", executedAt: t(5) },
      { side: "buy", quantity: "1", price: "10", executedAt: t(4) },
    ] }));
    expect(r.direction).toBe("long");
    expect(r.grossPnl).toBe("2");
  });

  it("reports unavailable P&L when specs are missing, never guessing", () => {
    const r = computeTrade(trade({ instrument: { symbol: "GBPUSD", assetClass: "forex", quoteCurrency: "USD" }, executions: [
      { side: "buy", quantity: "1", price: "1.25", executedAt: t(1) },
      { side: "sell", quantity: "1", price: "1.26", executedAt: t(2) },
    ] }));
    expect(r.grossPnl).toBeNull();
    expect(r.netPnl).toBeNull();
    expect(r.pnlSource).toBe("unavailable");
    expect(r.outcome).toBeNull();
    expect(r.issues.map((i) => i.code)).toContain("MISSING_INSTRUMENT_SPEC");
  });

  it("falls back to broker-reported P&L and flags it", () => {
    const r = computeTrade(trade({ instrument: { symbol: "GBPUSD", assetClass: "forex", quoteCurrency: "USD" }, brokerNetPnl: "95", executions: [
      { side: "buy", quantity: "1", price: "1.25", executedAt: t(1), commission: "5" },
      { side: "sell", quantity: "1", price: "1.26", executedAt: t(2) },
    ] }));
    expect(r.netPnl).toBe("95");
    expect(r.grossPnl).toBe("100");
    expect(r.pnlSource).toBe("broker");
  });

  it("flags broker reconciliation mismatches", () => {
    const r = computeTrade(trade({ instrument: EURUSD, brokerNetPnl: "480", executions: [
      { side: "buy", quantity: "1", price: "1.1", executedAt: t(1) },
      { side: "sell", quantity: "1", price: "1.105", executedAt: t(2) },
    ] }));
    expect(r.netPnl).toBe("500");
    expect(r.issues.map((i) => i.code)).toContain("BROKER_PNL_MISMATCH");
  });

  it("converts with the historical FX rate of the exit date", () => {
    const fx = createFxLookup([{ base: "USD", quote: "JPY", date: "2024-03-05", rate: "150" }]);
    const r = computeTrade(trade({ instrument: USDJPY, executions: [
      { side: "buy", quantity: "1", price: "150.00", executedAt: t(1) },
      { side: "sell", quantity: "1", price: "151.00", executedAt: t(2) },
    ] }), fx);
    expect(r.grossPnlQuote).toBe("100000");
    expect(r.pnlCurrency).toBe("JPY");
    expect(r.grossPnl).toBe("666.6666666667");
  });

  it("does not substitute another date's FX rate", () => {
    const fx = createFxLookup([{ base: "USD", quote: "JPY", date: "2024-03-04", rate: "150" }]);
    const r = computeTrade(trade({ instrument: USDJPY, executions: [
      { side: "buy", quantity: "1", price: "150.00", executedAt: t(1) },
      { side: "sell", quantity: "1", price: "151.00", executedAt: t(2) },
    ] }), fx);
    expect(r.grossPnl).toBeNull();
    expect(r.issues.map((i) => i.code)).toContain("MISSING_FX_RATE");
    const lenient = createFxLookup([{ base: "USD", quote: "JPY", date: "2024-03-04", rate: "150" }], { maxStaleDays: 3 });
    expect(lenient("USD", "JPY", "2024-03-05")).toBe("150");
    expect(lenient("USD", "JPY", "2024-03-03")).toBeNull();
  });

  it("rejects stops on the wrong side", () => {
    const r = computeTrade(trade({ instrument: AAPL, stopLoss: "105", executions: [
      { side: "buy", quantity: "10", price: "100", executedAt: t(1) },
      { side: "sell", quantity: "10", price: "110", executedAt: t(2) },
    ] }));
    expect(r.initialRisk).toBeNull();
    expect(r.rMultiple).toBeNull();
    expect(r.issues.map((i) => i.code)).toContain("INVALID_STOP_LOSS");
  });

  it("short stop must be above entry; manual risk overrides", () => {
    const r = computeTrade(trade({ instrument: AAPL, stopLoss: "105", executions: [
      { side: "sell", quantity: "10", price: "100", executedAt: t(1) },
      { side: "buy", quantity: "10", price: "110", executedAt: t(2) },
    ] }));
    expect(r.initialRisk).toBe("50");
    expect(r.rMultiple).toBe("-2");
    expect(r.outcome).toBe("loss");
    const m = computeTrade(trade({ instrument: AAPL, manualInitialRisk: "25", executions: [
      { side: "sell", quantity: "10", price: "100", executedAt: t(1) },
      { side: "buy", quantity: "10", price: "110", executedAt: t(2) },
    ] }));
    expect(m.rMultiple).toBe("-4");
  });

  it("applies breakeven tolerance and swap", () => {
    const r = computeTrade(trade({ instrument: AAPL, swap: "-0.5", breakevenTolerance: "1", executions: [
      { side: "buy", quantity: "1", price: "100", executedAt: t(1) },
      { side: "sell", quantity: "1", price: "100.8", executedAt: t(2) },
    ] }));
    expect(r.netPnl).toBe("0.3");
    expect(r.outcome).toBe("breakeven");
  });

  it("throws on invalid structure", () => {
    expect(() => computeTrade(trade({ instrument: AAPL, executions: [] }))).toThrow(TradeCalculationError);
    expect(() => computeTrade(trade({ instrument: AAPL, executions: [{ side: "buy", quantity: "-1", price: "1", executedAt: t(1) }] }))).toThrow(/invalid/);
    expect(() => computeTrade(trade({ instrument: AAPL, executions: [
      { side: "buy", quantity: "1", price: "100", executedAt: t(1) },
      { side: "sell", quantity: "3", price: "101", executedAt: t(2) },
    ] }))).toThrow(/closes more than the open position/);
    expect(() => computeTrade(trade({ instrument: AAPL, direction: "short", executions: [{ side: "buy", quantity: "1", price: "1", executedAt: t(1) }] }))).toThrow(/must be a sell/);
  });
});

describe("groupExecutionsIntoTrades", () => {
  it("splits position flips and pro-rates fees", () => {
    const groups = groupExecutionsIntoTrades([
      { symbol: "aapl", side: "buy", quantity: "2", price: "100", executedAt: t(1) },
      { symbol: "AAPL", side: "sell", quantity: "5", price: "110", executedAt: t(2), fee: "5" },
      { symbol: "AAPL", side: "buy", quantity: "3", price: "105", executedAt: t(3) },
      { symbol: "MSFT", side: "buy", quantity: "1", price: "300", executedAt: t(2) },
    ]);
    expect(groups).toHaveLength(3);
    const [first, second, msft] = groups;
    expect(first).toMatchObject({ symbol: "AAPL", direction: "long", closed: true });
    expect(first.executions[1]).toMatchObject({ quantity: "2", fee: "2" });
    expect(msft).toMatchObject({ symbol: "MSFT", closed: false });
    expect(second).toMatchObject({ direction: "short", closed: true });
    expect(second.executions[0]).toMatchObject({ quantity: "3", fee: "3" });
    const r1 = computeTrade(trade({ instrument: AAPL, executions: first.executions }));
    const r2 = computeTrade(trade({ instrument: AAPL, executions: second.executions }));
    expect(r1.netPnl).toBe("18");
    expect(r2.netPnl).toBe("12");
  });
});
