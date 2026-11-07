import type { AssetClass, CalcIssue, Direction, Outcome, PnlSource } from "@/lib/engine";

/** Numeric columns are selected as ::text so decimals never pass through JS floats. */
export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  base_currency: string;
  matching_policy: "fifo" | "lifo";
  breakeven_tolerance: string;
  fx_max_stale_days: number;
  onboarded: boolean;
}

export interface Account {
  id: string;
  name: string;
  broker: string | null;
  account_type: "live" | "demo" | "prop" | "paper";
  currency: string;
  starting_balance: string | null;
  is_active: boolean;
  prop_firm: string | null;
  profit_target: string | null;
  max_daily_loss: string | null;
  max_total_drawdown: string | null;
  drawdown_type: "static" | "trailing";
  prop_phase: "challenge" | "verification" | "funded" | null;
  created_at: string;
}

export interface Instrument {
  id: string;
  symbol: string;
  asset_class: AssetClass;
  description: string | null;
  point_value: string | null;
  contract_size: string | null;
  contract_multiplier: string | null;
  tick_size: string | null;
  tick_value: string | null;
  quote_currency: string | null;
  base_currency: string | null;
  lot_step: string | null;
  min_lot: string | null;
  reviewed: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  timeframe: string | null;
  market_conditions: string | null;
  entry_criteria: string | null;
  exit_criteria: string | null;
  risk_rules: string | null;
  checklist: string[];
  color: string;
  is_active: boolean;
}

export interface Tag {
  id: string;
  name: string;
  kind: "tag" | "mistake" | "emotion";
}

export interface ExecutionRow {
  id: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  executed_at: string;
  fee: string;
  commission: string;
  external_id: string | null;
  sort_index: number;
}

export interface TradeRow {
  id: string;
  account_id: string;
  instrument_id: string | null;
  strategy_id: string | null;
  symbol: string;
  asset_class: AssetClass | null;
  direction: Direction;
  status: "open" | "closed";
  entry_mode: "executions" | "simple";
  tradingview_url: string | null;
  psychology_notes: string | null;
  is_draft: boolean;
  opened_at: string;
  closed_at: string | null;
  activity_at: string;
  stop_loss: string | null;
  take_profit: string | null;
  manual_initial_risk: string | null;
  swap: string;
  broker_net_pnl: string | null;
  entry_quantity: string;
  exit_quantity: string;
  open_quantity: string;
  avg_entry_price: string | null;
  avg_exit_price: string | null;
  pnl_currency: string | null;
  gross_pnl_quote: string | null;
  gross_pnl: string | null;
  fees: string;
  net_pnl: string | null;
  pnl_source: PnlSource | "manual";
  initial_risk: string | null;
  r_multiple: string | null;
  planned_rr: string | null;
  outcome: Outcome | null;
  holding_seconds: number | null;
  calc_issues: CalcIssue[];
  setup: string | null;
  session: string | null;
  timeframe: string | null;
  rating: number | null;
  confidence: number | null;
  discipline_rating: number | null;
  emotional_state: string | null;
  rule_compliant: boolean | null;
  checklist_state: Record<string, boolean>;
  note_entry_reason: string | null;
  note_expectation: string | null;
  note_exit_reason: string | null;
  note_did_well: string | null;
  note_did_wrong: string | null;
  note_lesson: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  trade_tags?: { tag_id: string; tags: { name: string; kind: Tag["kind"] } | null }[];
}

export interface TradeWithRelations extends TradeRow {
  executions: ExecutionRow[];
  screenshots: Screenshot[];
}

export interface Screenshot {
  id: string;
  trade_id: string | null;
  journal_id: string | null;
  storage_path: string;
  kind: "before" | "after" | "other";
  caption: string | null;
  created_at: string;
  url?: string;
}

export interface DailyJournal {
  id: string;
  journal_date: string;
  pre_market_plan: string | null;
  post_market_review: string | null;
  notes: string | null;
  emotions: string[];
  rule_violations: string[];
  mood: number | null;
  discipline_score: number | null;
  updated_at: string;
}

export interface TradingRule {
  id: string;
  text: string;
  category: string;
  is_active: boolean;
  sort_index: number;
}

export interface FxRate {
  id: string;
  base: string;
  quote: string;
  rate_date: string;
  rate: string;
  source: string;
}
