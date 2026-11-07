# Database

Migrations: `supabase/migrations/*.sql`. Tests: `supabase/tests` (`pnpm test:db`).

## Conventions
- Money/prices/quantities: `numeric(28,10)` (FX rates `numeric(28,12)`); never float. Selected as `::text` by the app.
- Timestamps: `timestamptz` (UTC). Calendar dates: `date`.
- Every user table: `user_id uuid default auth.uid()`, RLS enabled + forced, select/insert/update/delete policies `user_id = auth.uid()`.
- Child tables reference parents via composite `(id, user_id)` FKs so cross-user references are impossible.

## Tables
| Table | Purpose / notable columns |
|---|---|
| `profiles` | 1:1 with `auth.users` (trigger). `timezone`, `base_currency`, `matching_policy` (fifo/lifo), `breakeven_tolerance`, `fx_max_stale_days` |
| `accounts` | `currency`, `starting_balance`, `account_type` (live/demo/prop/paper), prop rules: `profit_target`, `max_daily_loss`, `max_total_drawdown`, `drawdown_type` (static/trailing) |
| `instruments` | User-reviewed specs: `point_value`, `contract_size`, `contract_multiplier`, `tick_size`+`tick_value` (both or neither), `quote_currency`, `lot_step`, `min_lot`, `reviewed` |
| `strategies` | Playbook entries: criteria texts, `checklist jsonb[]`, `color`, `is_active` |
| `tags` | `kind` ∈ tag / mistake / emotion; unique per user+kind+name |
| `trades` | Inputs (`stop_loss`, `take_profit`, `manual_initial_risk`, `swap`, `broker_net_pnl`), engine-computed columns (`avg_*`, `gross_pnl`, `fees`, `net_pnl`, `pnl_source`, `initial_risk`, `r_multiple`, `planned_rr`, `outcome`, `holding_seconds`, `calc_issues`), journaling fields, `activity_at` (generated: close time or open time), `fingerprint` (import dedupe) |
| `executions` | `side`, `quantity`, `price`, `executed_at`, `fee`, `commission`, `fingerprint` (unique per user) |
| `trade_tags` | Trade ↔ tag link |
| `daily_journals` | One per user per date: plan, review, notes, emotions[], rule_violations[], mood, discipline_score |
| `screenshots` | Storage path + kind (before/after/other); belongs to exactly one of trade / journal |
| `trading_rules`, `rule_checks` | Global rules and daily followed/broken checks |
| `fx_rates` | Historical `base/quote` rate per date (unique per user+pair+date) |
| `import_batches`, `import_mappings` | Import audit trail (undo) and saved column mappings |

## Functions
- `save_trade(p_trade jsonb, p_executions jsonb, p_tag_ids uuid[])` — atomic insert/update of a trade, replacement of its
  executions and (optionally) tags. `SECURITY INVOKER`; refuses unknown/foreign trade ids (`P0002`).
- `handle_new_user()` — creates the profile on sign-up (`SECURITY DEFINER`, empty search_path).

## Hardening migration (`20261107000003_hardening.sql`)
- `private.rate_limit_events` (schema `private` is not exposed through the Data API; no grants to `anon`/`authenticated`).
- `public.check_rate_limit(action, max, window_seconds) → boolean` — `SECURITY DEFINER`, pinned `search_path`, uses `auth.uid()`,
  advisory lock per user/action, prunes events older than 24 h. Executable by `authenticated` only.
- `handle_new_user()` now stores the sign-up timezone if it is a valid `pg_timezone_names` entry (else `UTC`) and caps display names at 80 chars.

## Production verification
`supabase/verify_production.sql` — read-only checklist (tables, RLS, policies, bucket privacy/limits, storage policies, function
security, indexes, applied migrations). Run it in the SQL editor after every deployment of migrations.

## Storage
Bucket `screenshots` (private, 10 MB, png/jpeg/webp/gif). Path `<user_id>/<trade|journal>/<uuid>.<ext>`; RLS on `storage.objects`
checks the first folder equals `auth.uid()`. URLs are short-lived signed URLs.

## Indexes
`trades(user_id, activity_at desc)`, `trades(user_id, account_id, opened_at desc)`, `trades(user_id, symbol)`, `trades(strategy_id)`,
`executions(trade_id, executed_at)`, partial unique `executions(user_id, fingerprint)`, `rule_checks(user_id, check_date)`.
