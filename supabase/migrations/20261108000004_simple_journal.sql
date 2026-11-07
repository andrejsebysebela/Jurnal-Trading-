-- Simplified journal (additive, non-destructive; existing rows are untouched).
-- Trades can now be entered directly (pair, risk, result, RR, times) without executions.

-- P&L entered by the user (not derived from executions/instrument specs)
alter type public.pnl_source add value if not exists 'manual';

alter table public.trades
  -- simple trades have no asset class
  alter column asset_class drop not null,
  add column if not exists entry_mode text not null default 'executions'
    check (entry_mode in ('executions', 'simple')),
  add column if not exists tradingview_url text
    check (tradingview_url is null or (char_length(tradingview_url) <= 500 and tradingview_url ~ '^https://([a-z0-9-]+\.)*tradingview\.com/')),
  add column if not exists psychology_notes text check (psychology_notes is null or char_length(psychology_notes) <= 5000);

-- Prop firm account phase (personal accounts use account_type live/demo)
alter table public.accounts
  add column if not exists prop_phase text check (prop_phase is null or prop_phase in ('challenge', 'verification', 'funded'));
