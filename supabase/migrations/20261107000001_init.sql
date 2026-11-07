-- EDGELOG initial schema
-- Conventions:
--   * every user-owned row has user_id = auth.uid() enforced by RLS
--   * children reference parents with composite (id, user_id) FKs so a row can
--     never point at another user's data even if an id is guessed
--   * money/prices/quantities are numeric (never float); timestamps are timestamptz (UTC)
--   * engine-computed columns on trades are written only by the server after
--     running the TypeScript calculation engine (see docs/CALCULATIONS.md)

create extension if not exists pgcrypto;

create type public.asset_class as enum ('forex', 'cfd', 'futures', 'stock', 'crypto');
create type public.trade_direction as enum ('long', 'short');
create type public.trade_status as enum ('open', 'closed');
create type public.trade_outcome as enum ('win', 'loss', 'breakeven');
create type public.exec_side as enum ('buy', 'sell');
create type public.account_type as enum ('live', 'demo', 'prop', 'paper');
create type public.tag_kind as enum ('tag', 'mistake', 'emotion');
create type public.screenshot_kind as enum ('before', 'after', 'other');
create type public.pnl_source as enum ('calculated', 'broker', 'unavailable');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  timezone text not null default 'UTC',
  base_currency char(3) not null default 'USD',
  matching_policy text not null default 'fifo' check (matching_policy in ('fifo', 'lifo')),
  breakeven_tolerance numeric(28, 10) not null default 0 check (breakeven_tolerance >= 0),
  fx_max_stale_days smallint not null default 0 check (fx_max_stale_days between 0 and 7),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  broker text check (char_length(broker) <= 80),
  account_type public.account_type not null default 'live',
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  starting_balance numeric(28, 10) check (starting_balance >= 0),
  is_active boolean not null default true,
  -- prop firm rules (optional)
  prop_firm text,
  profit_target numeric(28, 10) check (profit_target > 0),
  max_daily_loss numeric(28, 10) check (max_daily_loss > 0),
  max_total_drawdown numeric(28, 10) check (max_total_drawdown > 0),
  drawdown_type text not null default 'static' check (drawdown_type in ('static', 'trailing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

-- ───────────────────────── instruments (user-reviewed contract specs; never invented)
create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9._/:!-]{1,32}$'),
  asset_class public.asset_class not null,
  description text,
  point_value numeric(28, 10) check (point_value > 0),
  contract_size numeric(28, 10) check (contract_size > 0),
  contract_multiplier numeric(28, 10) check (contract_multiplier > 0),
  tick_size numeric(28, 10) check (tick_size > 0),
  tick_value numeric(28, 10) check (tick_value > 0),
  quote_currency char(3) check (quote_currency ~ '^[A-Z]{3}$'),
  base_currency char(3) check (base_currency ~ '^[A-Z]{3}$'),
  lot_step numeric(28, 10) check (lot_step > 0),
  min_lot numeric(28, 10) check (min_lot > 0),
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((tick_size is null) = (tick_value is null)),
  unique (id, user_id),
  unique (user_id, symbol)
);

-- ───────────────────────── strategies / playbook
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  timeframe text,
  market_conditions text,
  entry_criteria text,
  exit_criteria text,
  risk_rules text,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  color text not null default '#C6A15B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

-- ───────────────────────── tags, mistakes, emotions
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  kind public.tag_kind not null default 'tag',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind, name)
);

-- ───────────────────────── imports
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  file_name text not null,
  kind text not null check (kind in ('executions', 'trades')),
  mapping jsonb not null,
  row_count int not null default 0,
  imported_count int not null default 0,
  duplicate_count int not null default 0,
  error_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

create table public.import_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  mapping jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ───────────────────────── trades
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  instrument_id uuid,
  strategy_id uuid,
  import_batch_id uuid,
  symbol text not null,
  asset_class public.asset_class not null,
  direction public.trade_direction not null,
  status public.trade_status not null default 'closed',
  is_draft boolean not null default false,
  opened_at timestamptz not null,
  closed_at timestamptz,
  -- date used for range filters/calendar: close time for closed trades, open time otherwise
  activity_at timestamptz generated always as (coalesce(closed_at, opened_at)) stored,
  -- user inputs
  stop_loss numeric(28, 10) check (stop_loss >= 0),
  take_profit numeric(28, 10) check (take_profit >= 0),
  manual_initial_risk numeric(28, 10) check (manual_initial_risk > 0),
  swap numeric(28, 10) not null default 0,
  broker_net_pnl numeric(28, 10),
  -- engine-computed (account currency unless noted)
  entry_quantity numeric(28, 10) not null default 0,
  exit_quantity numeric(28, 10) not null default 0,
  open_quantity numeric(28, 10) not null default 0,
  avg_entry_price numeric(28, 10),
  avg_exit_price numeric(28, 10),
  pnl_currency char(3),
  gross_pnl_quote numeric(28, 10),
  gross_pnl numeric(28, 10),
  fees numeric(28, 10) not null default 0,
  net_pnl numeric(28, 10),
  pnl_source public.pnl_source not null default 'unavailable',
  initial_risk numeric(28, 10),
  r_multiple numeric(28, 10),
  planned_rr numeric(28, 10),
  outcome public.trade_outcome,
  holding_seconds bigint,
  calc_issues jsonb not null default '[]'::jsonb,
  calc_version smallint not null default 1,
  calculated_at timestamptz,
  -- setup & journaling
  setup text,
  session text,
  timeframe text,
  rating smallint check (rating between 1 and 5),
  confidence smallint check (confidence between 1 and 10),
  discipline_rating smallint check (discipline_rating between 1 and 10),
  emotional_state text,
  rule_compliant boolean,
  checklist_state jsonb not null default '{}'::jsonb,
  note_entry_reason text,
  note_expectation text,
  note_exit_reason text,
  note_did_well text,
  note_did_wrong text,
  note_lesson text,
  notes text,
  external_id text,
  fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, fingerprint),
  check (closed_at is null or closed_at >= opened_at),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (instrument_id, user_id) references public.instruments (id, user_id) on delete set null (instrument_id),
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete set null (strategy_id),
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete set null (import_batch_id)
);
create index trades_user_activity_idx on public.trades (user_id, activity_at desc);
create index trades_user_account_idx on public.trades (user_id, account_id, opened_at desc);
create index trades_user_symbol_idx on public.trades (user_id, symbol);
create index trades_strategy_idx on public.trades (strategy_id);

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_id uuid not null,
  side public.exec_side not null,
  quantity numeric(28, 10) not null check (quantity > 0),
  price numeric(28, 10) not null check (price >= 0),
  executed_at timestamptz not null,
  fee numeric(28, 10) not null default 0 check (fee >= 0),
  commission numeric(28, 10) not null default 0 check (commission >= 0),
  external_id text,
  fingerprint text,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);
create index executions_trade_idx on public.executions (trade_id, executed_at);
create unique index executions_fingerprint_uidx on public.executions (user_id, fingerprint) where fingerprint is not null;

create table public.trade_tags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_id uuid not null,
  tag_id uuid not null,
  primary key (trade_id, tag_id),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);
create index trade_tags_tag_idx on public.trade_tags (tag_id);

-- ───────────────────────── journal
create table public.daily_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  journal_date date not null,
  pre_market_plan text,
  post_market_review text,
  notes text,
  emotions text[] not null default '{}',
  rule_violations text[] not null default '{}',
  mood smallint check (mood between 1 and 5),
  discipline_score smallint check (discipline_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, journal_date)
);

create table public.screenshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_id uuid,
  journal_id uuid,
  storage_path text not null unique,
  kind public.screenshot_kind not null default 'other',
  caption text,
  created_at timestamptz not null default now(),
  check ((trade_id is not null) <> (journal_id is not null)),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  foreign key (journal_id, user_id) references public.daily_journals (id, user_id) on delete cascade
);
create index screenshots_trade_idx on public.screenshots (trade_id);

-- ───────────────────────── rules & progress tracker
create table public.trading_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  category text not null default 'general',
  is_active boolean not null default true,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.rule_checks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null,
  check_date date not null,
  followed boolean not null,
  primary key (rule_id, check_date),
  foreign key (rule_id, user_id) references public.trading_rules (id, user_id) on delete cascade
);
create index rule_checks_user_date_idx on public.rule_checks (user_id, check_date);

-- ───────────────────────── FX rates (historical; never substituted with latest)
create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  base char(3) not null check (base ~ '^[A-Z]{3}$'),
  quote char(3) not null check (quote ~ '^[A-Z]{3}$'),
  rate_date date not null,
  rate numeric(28, 12) not null check (rate > 0),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  check (base <> quote),
  unique (user_id, base, quote, rate_date)
);

-- ───────────────────────── updated_at triggers
create trigger t_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_accounts_updated before update on public.accounts for each row execute function public.set_updated_at();
create trigger t_instruments_updated before update on public.instruments for each row execute function public.set_updated_at();
create trigger t_strategies_updated before update on public.strategies for each row execute function public.set_updated_at();
create trigger t_trades_updated before update on public.trades for each row execute function public.set_updated_at();
create trigger t_journals_updated before update on public.daily_journals for each row execute function public.set_updated_at();

-- ───────────────────────── Row Level Security
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'instruments', 'strategies', 'tags', 'import_batches', 'import_mappings', 'trades',
    'executions', 'trade_tags', 'daily_journals', 'screenshots', 'trading_rules', 'rule_checks', 'fx_rates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (user_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;

-- ───────────────────────── atomic trade save (security invoker → RLS applies)
-- p_trade: column values for trades (engine-computed fields included)
-- p_executions: array of execution objects; replaces all executions of the trade
-- p_tag_ids: replaces trade tags when not null
create or replace function public.save_trade(p_trade jsonb, p_executions jsonb, p_tag_ids uuid[] default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p_trade ->> 'id', '')::uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if jsonb_typeof(p_executions) <> 'array' or jsonb_array_length(p_executions) = 0 then
    raise exception 'a trade needs at least one execution' using errcode = '22023';
  end if;

  if v_id is null then
    insert into trades (user_id, account_id, instrument_id, strategy_id, import_batch_id, symbol, asset_class, direction, status,
      is_draft, opened_at, closed_at, stop_loss, take_profit, manual_initial_risk, swap, broker_net_pnl, entry_quantity,
      exit_quantity, open_quantity, avg_entry_price, avg_exit_price, pnl_currency, gross_pnl_quote, gross_pnl, fees, net_pnl,
      pnl_source, initial_risk, r_multiple, planned_rr, outcome, holding_seconds, calc_issues, calculated_at, setup, session,
      timeframe, rating, confidence, discipline_rating, emotional_state, rule_compliant, checklist_state, note_entry_reason,
      note_expectation, note_exit_reason, note_did_well, note_did_wrong, note_lesson, notes, external_id, fingerprint)
    select v_uid, r.account_id, r.instrument_id, r.strategy_id, r.import_batch_id, r.symbol, r.asset_class, r.direction, r.status,
      coalesce(r.is_draft, false), r.opened_at, r.closed_at, r.stop_loss, r.take_profit, r.manual_initial_risk, coalesce(r.swap, 0),
      r.broker_net_pnl, r.entry_quantity, r.exit_quantity, r.open_quantity, r.avg_entry_price, r.avg_exit_price, r.pnl_currency,
      r.gross_pnl_quote, r.gross_pnl, coalesce(r.fees, 0), r.net_pnl, r.pnl_source, r.initial_risk, r.r_multiple, r.planned_rr,
      r.outcome, r.holding_seconds, coalesce(r.calc_issues, '[]'), now(), r.setup, r.session, r.timeframe, r.rating, r.confidence,
      r.discipline_rating, r.emotional_state, r.rule_compliant, coalesce(r.checklist_state, '{}'), r.note_entry_reason,
      r.note_expectation, r.note_exit_reason, r.note_did_well, r.note_did_wrong, r.note_lesson, r.notes, r.external_id, r.fingerprint
    from jsonb_populate_record(null::trades, p_trade) r
    returning id into v_id;
  else
    update trades t set
      account_id = r.account_id, instrument_id = r.instrument_id, strategy_id = r.strategy_id, symbol = r.symbol,
      asset_class = r.asset_class, direction = r.direction, status = r.status, is_draft = coalesce(r.is_draft, false),
      opened_at = r.opened_at, closed_at = r.closed_at, stop_loss = r.stop_loss, take_profit = r.take_profit,
      manual_initial_risk = r.manual_initial_risk, swap = coalesce(r.swap, 0), broker_net_pnl = r.broker_net_pnl,
      entry_quantity = r.entry_quantity, exit_quantity = r.exit_quantity, open_quantity = r.open_quantity,
      avg_entry_price = r.avg_entry_price, avg_exit_price = r.avg_exit_price, pnl_currency = r.pnl_currency,
      gross_pnl_quote = r.gross_pnl_quote, gross_pnl = r.gross_pnl, fees = coalesce(r.fees, 0), net_pnl = r.net_pnl,
      pnl_source = r.pnl_source, initial_risk = r.initial_risk, r_multiple = r.r_multiple, planned_rr = r.planned_rr,
      outcome = r.outcome, holding_seconds = r.holding_seconds, calc_issues = coalesce(r.calc_issues, '[]'), calculated_at = now(),
      setup = r.setup, session = r.session, timeframe = r.timeframe, rating = r.rating, confidence = r.confidence,
      discipline_rating = r.discipline_rating, emotional_state = r.emotional_state, rule_compliant = r.rule_compliant,
      checklist_state = coalesce(r.checklist_state, '{}'), note_entry_reason = r.note_entry_reason,
      note_expectation = r.note_expectation, note_exit_reason = r.note_exit_reason, note_did_well = r.note_did_well,
      note_did_wrong = r.note_did_wrong, note_lesson = r.note_lesson, notes = r.notes
    from jsonb_populate_record(null::trades, p_trade) r
    where t.id = v_id and t.user_id = v_uid;
    if not found then raise exception 'trade not found' using errcode = 'P0002'; end if;
    delete from executions where trade_id = v_id;
  end if;

  insert into executions (user_id, trade_id, side, quantity, price, executed_at, fee, commission, external_id, fingerprint, sort_index)
  select v_uid, v_id, e.side, e.quantity, e.price, e.executed_at, coalesce(e.fee, 0), coalesce(e.commission, 0),
         e.external_id, e.fingerprint, (ord - 1)::int
  from jsonb_array_elements(p_executions) with ordinality as x(j, ord),
       jsonb_populate_record(null::executions, x.j) e;

  if p_tag_ids is not null then
    delete from trade_tags where trade_id = v_id;
    insert into trade_tags (user_id, trade_id, tag_id) select v_uid, v_id, unnest(p_tag_ids);
  end if;
  return v_id;
end $$;

revoke all on function public.save_trade(jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.save_trade(jsonb, jsonb, uuid[]) to authenticated;
