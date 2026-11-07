/** PostgREST select lists. Every numeric is cast to text to preserve decimal precision. */
const n = (cols: string[]) => cols.map((c) => `${c}:${c}::text`).join(",");

export const ACCOUNT_COLUMNS = [
  "id,name,broker,account_type,currency,is_active,prop_firm,drawdown_type,prop_phase,created_at",
  n(["starting_balance", "profit_target", "max_daily_loss", "max_total_drawdown"]),
].join(",");

export const INSTRUMENT_COLUMNS = [
  "id,symbol,asset_class,description,quote_currency,base_currency,reviewed",
  n(["point_value", "contract_size", "contract_multiplier", "tick_size", "tick_value", "lot_step", "min_lot"]),
].join(",");

export const TRADE_COLUMNS = [
  "id,account_id,instrument_id,strategy_id,symbol,asset_class,direction,status,is_draft,opened_at,closed_at,activity_at",
  "pnl_currency,pnl_source,outcome,holding_seconds,calc_issues,setup,session,timeframe,rating,confidence,discipline_rating",
  "emotional_state,rule_compliant,checklist_state,note_entry_reason,note_expectation,note_exit_reason,note_did_well",
  "note_did_wrong,note_lesson,notes,created_at,updated_at,entry_mode,tradingview_url,psychology_notes",
  n([
    "stop_loss", "take_profit", "manual_initial_risk", "swap", "broker_net_pnl", "entry_quantity", "exit_quantity",
    "open_quantity", "avg_entry_price", "avg_exit_price", "gross_pnl_quote", "gross_pnl", "fees", "net_pnl", "initial_risk",
    "r_multiple", "planned_rr",
  ]),
  "trade_tags(tag_id,tags(name,kind))",
].join(",");

export const EXECUTION_COLUMNS = ["id,side,executed_at,external_id,sort_index", n(["quantity", "price", "fee", "commission"])].join(",");

export const PROFILE_COLUMNS = ["id,display_name,timezone,base_currency,matching_policy,fx_max_stale_days,onboarded", n(["breakeven_tolerance"])].join(",");
