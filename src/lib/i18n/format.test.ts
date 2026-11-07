import { describe, expect, it } from "vitest";
import { plural, negotiateLocale } from "./config";
import { createFormatter } from "./format";

describe("i18n formatting", () => {
  const en = createFormatter("en");
  const sk = createFormatter("sk");
  it("formats money exactly per locale", () => {
    expect(en.money("1234.5", "USD", { sign: true })).toBe("+$1,234.50");
    expect(en.money("-804.2", "USD")).toBe("-$804.20");
    expect(sk.money("1234.5", "EUR").replace(/\s/g, " ")).toBe("1 234,50 €");
    expect(sk.money("-0.005", "EUR")).not.toContain("NaN");
    expect(en.money("123456789012345678.125", "USD")).toBe("$123,456,789,012,345,678.13");
    expect(en.money(null)).toBe("—");
  });
  it("formats R, RR and percent", () => {
    expect(en.r("1.255")).toBe("+1.26R");
    expect(sk.r("-0.5")).toBe("-0,50R");
    expect(en.rr("2.5")).toBe("1:2.5");
    expect(sk.rr("2.5")).toBe("1:2,5");
    expect(en.pct("66.6667")).toBe("66.7%");
    expect(sk.pct("66.6667").replace(/\s/g, " ")).toBe("66,7 %");
  });
  it("formats dates and durations", () => {
    expect(sk.date("2026-11-05T10:00:00Z", "Europe/Bratislava", "d. MMMM yyyy")).toBe("5. novembra 2026");
    expect(en.duration(9000)).toBe("2 h 30 m");
    expect(sk.duration(9000)).toBe("2 h 30 min");
  });
  it("pluralizes Slovak correctly", () => {
    const f = { one: "{n} obchod", few: "{n} obchody", other: "{n} obchodov" };
    expect([1, 2, 4, 5, 0].map((n) => plural("sk", n, f))).toEqual(["1 obchod", "2 obchody", "4 obchody", "5 obchodov", "0 obchodov"]);
    expect(plural("en", 2, { one: "{n} trade", other: "{n} trades" })).toBe("2 trades");
  });
  it("negotiates locale", () => {
    expect(negotiateLocale("sk-SK,sk;q=0.9,en;q=0.8")).toBe("sk");
    expect(negotiateLocale("cs-CZ")).toBe("sk");
    expect(negotiateLocale("de-DE,en;q=0.5")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });
});
