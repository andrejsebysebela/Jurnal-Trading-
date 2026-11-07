import type { DecimalString } from "./decimal";

export const ASSET_CLASSES = ["forex", "cfd", "futures", "stock", "crypto"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export type Side = "buy" | "sell";
export type Direction = "long" | "short";
export type MatchingPolicy = "fifo" | "lifo";
export type Outcome = "win" | "loss" | "breakeven";
export type TradeStatus = "open" | "closed";

/**
 * Instrument contract specification. Every field is user/broker supplied —
 * EDGELOG never invents tick values or lot sizes. Missing fields lead to an
 * explicit "unavailable" result, never a guess.
 */
export interface InstrumentSpec {
  symbol: string;
  assetClass: AssetClass;
  /** Money value of a 1.0 price move for 1 unit of quantity, in quote currency. Highest priority. */
  pointValue?: DecimalString | null;
  /** Units of the underlying per 1 lot (e.g. 100000 for a standard FX lot — must be configured). */
  contractSize?: DecimalString | null;
  /** Futures/CFD multiplier. */
  contractMultiplier?: DecimalString | null;
  tickSize?: DecimalString | null;
  tickValue?: DecimalString | null;
  /** Currency the P&L is denominated in before conversion. */
  quoteCurrency?: string | null;
  baseCurrency?: string | null;
  lotStep?: DecimalString | null;
  minLot?: DecimalString | null;
}

export interface ExecutionInput {
  id?: string;
  side: Side;
  quantity: DecimalString;
  price: DecimalString;
  /** ISO-8601 UTC timestamp. */
  executedAt: string;
  /** Fees/commissions are assumed to be in the ACCOUNT currency, as a positive cost. */
  fee?: DecimalString | null;
  commission?: DecimalString | null;
}

export interface TradeInput {
  direction?: Direction;
  executions: ExecutionInput[];
  instrument: InstrumentSpec;
  accountCurrency: string;
  stopLoss?: DecimalString | null;
  takeProfit?: DecimalString | null;
  /** Manual initial risk in account currency; overrides the stop-loss derived value. */
  manualInitialRisk?: DecimalString | null;
  /** Additional costs (swap/financing) in account currency; negative = cost. */
  swap?: DecimalString | null;
  /** Broker-reported net P&L in account currency (used for reconciliation / fallback). */
  brokerNetPnl?: DecimalString | null;
  matchingPolicy?: MatchingPolicy;
  /** |net P&L| <= tolerance counts as breakeven. Account currency. */
  breakevenTolerance?: DecimalString | null;
}

export type CalcIssueCode =
  | "NO_EXECUTIONS"
  | "INVALID_EXECUTION"
  | "POSITION_FLIP"
  | "MISSING_INSTRUMENT_SPEC"
  | "MISSING_FX_RATE"
  | "INVALID_STOP_LOSS"
  | "NO_STOP_LOSS"
  | "BROKER_PNL_MISMATCH"
  | "USED_BROKER_PNL"
  | "OPEN_POSITION";

export interface CalcIssue {
  code: CalcIssueCode;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface MatchedLot {
  entryExecutionIndex: number;
  exitExecutionIndex: number;
  quantity: DecimalString;
  entryPrice: DecimalString;
  exitPrice: DecimalString;
  exitAt: string;
  /** P&L in instrument quote currency. */
  pnlQuote: DecimalString | null;
}

export type PnlSource = "calculated" | "broker" | "unavailable";

export interface TradeCalcResult {
  direction: Direction;
  status: TradeStatus;
  entryQuantity: DecimalString;
  exitQuantity: DecimalString;
  openQuantity: DecimalString;
  avgEntryPrice: DecimalString | null;
  avgExitPrice: DecimalString | null;
  openedAt: string;
  closedAt: string | null;
  holdingSeconds: number | null;
  pnlCurrency: string | null;
  grossPnlQuote: DecimalString | null;
  /** Account currency values. null = unavailable (see issues). */
  grossPnl: DecimalString | null;
  fees: DecimalString;
  swap: DecimalString;
  netPnl: DecimalString | null;
  pnlSource: PnlSource;
  initialRisk: DecimalString | null;
  rMultiple: DecimalString | null;
  plannedRewardRisk: DecimalString | null;
  outcome: Outcome | null;
  lots: MatchedLot[];
  issues: CalcIssue[];
}

/** Returns the FX rate to convert 1 unit of `from` into `to` on `date` (YYYY-MM-DD, UTC). */
export type FxRateLookup = (from: string, to: string, date: string) => DecimalString | null;
