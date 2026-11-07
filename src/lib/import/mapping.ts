import type { DateFormatId } from "./parse";

export type ImportKind = "executions" | "trades";

export const EXECUTION_FIELDS = ["symbol", "side", "quantity", "price", "executedAt", "commission", "fee", "externalId", "account"] as const;
export const TRADE_FIELDS = [
  "symbol", "side", "quantity", "entryPrice", "exitPrice", "openedAt", "closedAt",
  "stopLoss", "takeProfit", "commission", "fee", "swap", "profit", "externalId", "account",
] as const;
export type ExecutionField = (typeof EXECUTION_FIELDS)[number];
export type TradeField = (typeof TRADE_FIELDS)[number];

export const REQUIRED: Record<ImportKind, string[]> = {
  executions: ["symbol", "side", "quantity", "price", "executedAt"],
  trades: ["symbol", "side", "quantity", "entryPrice", "exitPrice", "openedAt", "closedAt"],
};

export const FIELD_LABELS: Record<string, string> = {
  symbol: "Symbol", side: "Side / Direction", quantity: "Quantity / Volume", price: "Price", executedAt: "Execution time",
  commission: "Commission", fee: "Fees", externalId: "Broker ID", account: "Account", entryPrice: "Entry price",
  exitPrice: "Exit price", openedAt: "Open time", closedAt: "Close time", stopLoss: "Stop loss", takeProfit: "Take profit",
  swap: "Swap / Financing", profit: "Broker net P&L",
};

export interface ImportMapping {
  kind: ImportKind;
  columns: Partial<Record<string, string>>;
  dateFormat: DateFormatId;
  timeZone: string;
  decimalSeparator: "." | ",";
  /** When true, the profit column is broker NET P&L (after commission & swap). */
  profitIsNet: boolean;
}

const SYNONYMS: Record<string, string[]> = {
  symbol: ["symbol", "instrument", "ticker", "market", "contract", "pair"],
  side: ["side", "type", "direction", "action", "buy/sell", "b/s"],
  quantity: ["quantity", "qty", "volume", "size", "lots", "contracts", "shares", "amount"],
  price: ["price", "fill price", "exec price", "avg price", "execution price"],
  executedAt: ["time", "date/time", "datetime", "executed at", "execution time", "fill time", "timestamp", "date"],
  commission: ["commission", "commissions", "comm"],
  fee: ["fee", "fees", "exchange fee", "reg fee"],
  externalId: ["id", "ticket", "order id", "trade id", "position", "deal", "execution id", "exec id"],
  account: ["account", "account id", "account number"],
  entryPrice: ["entry price", "open price", "entry", "price open", "avg entry"],
  exitPrice: ["exit price", "close price", "exit", "price close", "avg exit"],
  openedAt: ["open time", "entry time", "opened", "open date", "time open", "entry date"],
  closedAt: ["close time", "exit time", "closed", "close date", "time close", "exit date"],
  stopLoss: ["stop loss", "sl", "s/l", "stop"],
  takeProfit: ["take profit", "tp", "t/p", "target"],
  swap: ["swap", "swaps", "financing", "rollover"],
  profit: ["profit", "p&l", "pnl", "net p&l", "net pnl", "realized p&l", "net profit"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Suggest a column mapping from header names (user always reviews it). */
export function autoDetectMapping(headers: string[], kind?: ImportKind): Pick<ImportMapping, "kind" | "columns"> {
  const normalized = headers.map((h) => ({ h, n: norm(h) }));
  const hasTradeShape = normalized.some((x) => SYNONYMS.entryPrice.includes(x.n) || SYNONYMS.openedAt.includes(x.n));
  const k: ImportKind = kind ?? (hasTradeShape ? "trades" : "executions");
  const fields = k === "trades" ? TRADE_FIELDS : EXECUTION_FIELDS;
  const used = new Set<string>();
  const columns: Partial<Record<string, string>> = {};
  for (const field of fields) {
    const syn = SYNONYMS[field] ?? [];
    const match = normalized.find((x) => !used.has(x.h) && (x.n === norm(field) || syn.includes(x.n)));
    if (match) { columns[field] = match.h; used.add(match.h); }
  }
  return { kind: k, columns };
}

const BUY = ["buy", "b", "long", "bot", "bought", "buy to open", "buy to cover", "buy to close"];
const SELL = ["sell", "s", "short", "sld", "sold", "sell short", "sell to open", "sell to close"];

export function parseSide(v: string | undefined): "buy" | "sell" | null {
  const s = norm(v ?? "");
  if (BUY.includes(s)) return "buy";
  if (SELL.includes(s)) return "sell";
  if (s.startsWith("buy")) return "buy";
  if (s.startsWith("sell")) return "sell";
  return null;
}
