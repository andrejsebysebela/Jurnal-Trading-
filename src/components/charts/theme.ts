/** Chart tokens. Profit/loss green-red fails deutan CVD separation (ΔE 4.6), so
 * polarity is ALWAYS double-encoded: position relative to a zero baseline + signed labels. */
export const C = {
  profit: "#39B980",
  loss: "#E45D67",
  gold: "#C6A15B",
  neutral: "#657080",
  grid: "#1F2530",
  axis: "#657080",
  surface: "#141922",
};

export const axisProps = {
  stroke: C.axis,
  tickLine: false,
  axisLine: false,
  fontSize: 11,
} as const;

export function compactMoney(v: number, currency = "USD") {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0);
  return `${v < 0 ? "-" : ""}${sym}${s}`;
}
