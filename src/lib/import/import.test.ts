import { describe, expect, it } from "vitest";
import { computeTrade } from "@/lib/engine";
import { autoDetectMapping, fingerprint, normalizeImport, parseCsv, parseNumber, parseSide, parseTimestamp, validateMapping, type ImportMapping } from "./index";

describe("parsers", () => {
  it("parses broker number formats", () => {
    expect(parseNumber("1,234.50")).toBe("1234.5");
    expect(parseNumber("1.234,50", ",")).toBe("1234.5");
    expect(parseNumber("(12.30)")).toBe("-12.3");
    expect(parseNumber("$-5")).toBe("-5");
    expect(parseNumber("12 USD")).toBe("12");
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
  it("parses timestamps in the source timezone to UTC", () => {
    expect(parseTimestamp("2024-03-05T14:30:00Z", "iso", "Europe/Prague")).toBe("2024-03-05T14:30:00.000Z");
    expect(parseTimestamp("2024-03-05 14:30:00", "iso", "Europe/Prague")).toBe("2024-03-05T13:30:00.000Z");
    expect(parseTimestamp("2024.07.05 14:30:00", "yyyy.MM.dd HH:mm:ss", "Europe/Prague")).toBe("2024-07-05T12:30:00.000Z");
    expect(parseTimestamp("03/05/2024 2:30:00 PM", "MM/dd/yyyy h:mm:ss a", "America/New_York")).toBe("2024-03-05T19:30:00.000Z");
    expect(parseTimestamp("1709649000", "unix_s", "UTC")).toBe("2024-03-05T14:30:00.000Z");
    expect(parseTimestamp("not a date", "iso", "UTC")).toBeNull();
    expect(parseTimestamp("31/02/2024 10:00", "dd/MM/yyyy HH:mm", "UTC")).toBeNull();
  });
  it("parses sides", () => {
    expect(parseSide("BOT")).toBe("buy");
    expect(parseSide("Sell Short")).toBe("sell");
    expect(parseSide("??")).toBeNull();
  });
  it("fingerprints deterministically", () => {
    expect(fingerprint(["a", "b"])).toBe(fingerprint(["A ", "b"]));
    expect(fingerprint(["a", "b"])).not.toBe(fingerprint(["a", "c"]));
  });
});

describe("execution import", () => {
  const csv = `Account,Exec ID,Symbol,Side,Qty,Price,Time,Commission
Main,1,ES,Buy,2,5000.25,2024-03-05T14:30:00Z,2.10
Main,2,ES,Sell,1,5005.50,2024-03-05T14:45:00Z,1.05
Main,3,ES,Sell,1,5010,2024-03-05T15:05:00Z,1.05
Main,4,ES,Sell,x,5010,2024-03-05T15:05:00Z,1.05`;
  const table = parseCsv(csv);
  const detected = autoDetectMapping(table.headers);
  const mapping: ImportMapping = { ...detected, dateFormat: "iso", timeZone: "UTC", decimalSeparator: ".", profitIsNet: true };

  it("auto-detects an execution mapping", () => {
    expect(detected.kind).toBe("executions");
    expect(detected.columns).toMatchObject({ symbol: "Symbol", side: "Side", quantity: "Qty", price: "Price", executedAt: "Time", externalId: "Exec ID", account: "Account" });
    expect(validateMapping(mapping)).toEqual([]);
  });
  it("groups executions into a trade and reports bad rows", () => {
    const res = normalizeImport(table, mapping);
    expect(res.errors).toEqual([{ row: 5, message: "invalid quantity" }]);
    expect(res.trades).toHaveLength(1);
    const t = res.trades[0];
    expect(t).toMatchObject({ symbol: "ES", direction: "long", closed: true, accountKey: "Main" });
    expect(t.executions).toHaveLength(3);
    const calc = computeTrade({ instrument: { symbol: "ES", assetClass: "futures", pointValue: "50", quoteCurrency: "USD" }, accountCurrency: "USD", executions: t.executions });
    // (5005.5-5000.25)*1*50 + (5010-5000.25)*1*50 = 262.5 + 487.5 = 750; fees 4.2
    expect(calc.grossPnl).toBe("750");
    expect(calc.netPnl).toBe("745.8");
  });
  it("is stable across re-imports (dedupe)", () => {
    const a = normalizeImport(table, mapping).trades[0].fingerprint;
    const b = normalizeImport(parseCsv(csv), mapping).trades[0].fingerprint;
    expect(a).toBe(b);
  });
});

describe("trade-row import", () => {
  const csv = `trade_id,symbol,side,quantity,entry_price,exit_price,open_time,close_time,stop_loss,commission,swap,profit
5001,EURUSD,buy,1.00,1.08500,1.08750,2024.03.05 08:00:00,2024.03.05 10:30:00,1.08300,7.00,-1.5,250.00
5002,EURUSD,sell,1,1.0875,1.0870,2024.03.05 11:00:00,2024.03.05 10:00:00,,,,`;
  const table = parseCsv(csv);
  const detected = autoDetectMapping(table.headers);
  it("maps, converts gross broker profit to net, rejects inverted times", () => {
    expect(detected.kind).toBe("trades");
    const res = normalizeImport(table, { ...detected, dateFormat: "yyyy.MM.dd HH:mm:ss", timeZone: "UTC", decimalSeparator: ".", profitIsNet: false });
    expect(res.errors[0]).toMatchObject({ row: 3 });
    expect(res.errors[0].message).toMatch(/before open/);
    const t = res.trades[0];
    expect(t.brokerNetPnl).toBe("241.5");
    expect(t.stopLoss).toBe("1.083");
    const calc = computeTrade({
      instrument: { symbol: "EURUSD", assetClass: "forex", contractSize: "100000", quoteCurrency: "USD" },
      accountCurrency: "USD", executions: t.executions, stopLoss: t.stopLoss, swap: t.swap, brokerNetPnl: t.brokerNetPnl,
    });
    expect(calc.netPnl).toBe("241.5");
    expect(calc.issues.map((i) => i.code)).not.toContain("BROKER_PNL_MISMATCH");
    expect(calc.rMultiple).toBe("1.2075");
  });
});
