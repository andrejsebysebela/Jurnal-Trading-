-- RLS & integrity tests. Run with: pnpm test:db
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"timezone":"Europe/Bratislava"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"timezone":"Not/AZone"}');
do $$ begin
  assert (select timezone from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Europe/Bratislava', 'signup timezone not stored';
  assert (select timezone from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'UTC', 'invalid timezone not rejected';
end $$;

-- profile trigger created rows
do $$ begin assert (select count(*) from public.profiles) = 2, 'profiles not created'; end $$;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into accounts (id, name, currency) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alice Main', 'USD');
insert into instruments (symbol, asset_class, point_value, quote_currency) values ('ES', 'futures', 50, 'USD');
select save_trade(
  jsonb_build_object('account_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'symbol', 'ES', 'asset_class', 'futures',
    'direction', 'long', 'status', 'closed', 'opened_at', '2024-03-05T14:30:00Z', 'closed_at', '2024-03-05T15:00:00Z',
    'net_pnl', '995.8', 'gross_pnl', '1000', 'fees', '4.2', 'pnl_source', 'calculated', 'outcome', 'win', 'entry_quantity', '2',
    'exit_quantity', '2', 'open_quantity', '0'),
  '[{"side":"buy","quantity":"2","price":"5000","executed_at":"2024-03-05T14:30:00Z","fee":"2.1"},
    {"side":"sell","quantity":"2","price":"5010","executed_at":"2024-03-05T15:00:00Z","fee":"2.1"}]'::jsonb);
do $$ begin
  assert (select count(*) from trades) = 1, 'alice trade missing';
  assert (select count(*) from executions) = 2, 'alice executions missing';
  assert (select net_pnl from trades) = 995.8, 'numeric precision lost';
end $$;

-- Bob sees nothing of Alice
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from accounts) = 0, 'RLS leak: accounts';
  assert (select count(*) from trades) = 0, 'RLS leak: trades';
  assert (select count(*) from executions) = 0, 'RLS leak: executions';
  assert (select count(*) from profiles) = 1, 'RLS leak: profiles';
end $$;

-- Bob cannot update/delete Alice rows (silently 0 rows)
update trades set net_pnl = 0;
delete from accounts;

-- Bob cannot attach a trade to Alice's account (composite FK)
insert into accounts (id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Bob Main');
do $$ begin
  begin
    insert into trades (account_id, symbol, asset_class, direction, opened_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'ES', 'futures', 'long', now());
    raise exception 'cross-user FK accepted';
  exception when foreign_key_violation then null;
  end;
  -- Bob cannot insert rows owned by Alice
  begin
    insert into tags (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'x');
    raise exception 'RLS insert check bypassed';
  exception when insufficient_privilege then null;
  end;
  -- save_trade refuses updating another user's trade
  begin
    perform save_trade(jsonb_build_object('id', (select '00000000-0000-0000-0000-000000000000'), 'account_id',
      'bbbbbbbb-0000-0000-0000-000000000001', 'symbol', 'ES', 'asset_class', 'futures', 'direction', 'long', 'status', 'closed',
      'opened_at', now(), 'pnl_source', 'unavailable'),
      '[{"side":"buy","quantity":"1","price":"1","executed_at":"2024-01-01T00:00:00Z"}]'::jsonb);
    raise exception 'save_trade updated foreign trade';
  exception when sqlstate 'P0002' then null;
  end;
  -- invalid data rejected by constraints
  begin
    insert into instruments (symbol, asset_class, tick_size) values ('NQ', 'futures', 0.25);
    raise exception 'tick_size without tick_value accepted';
  exception when check_violation then null;
  end;
end $$;

-- Storage policies: own folder only
insert into storage.objects (bucket_id, name) values ('screenshots', '22222222-2222-2222-2222-222222222222/trade/a.png');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('screenshots', '11111111-1111-1111-1111-111111111111/trade/b.png');
    raise exception 'storage policy bypassed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Alice data intact
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select net_pnl from trades) = 995.8, 'alice trade modified by bob';
  assert (select count(*) from accounts) = 1, 'alice account deleted by bob';
  assert (select count(*) from storage.objects) = 0, 'storage leak';
end $$;

-- rate limiting: 3rd call within the window is refused; private schema is not readable
do $$ begin
  assert public.check_rate_limit('export', 2, 3600) = true, 'rate limit call 1';
  assert public.check_rate_limit('export', 2, 3600) = true, 'rate limit call 2';
  assert public.check_rate_limit('export', 2, 3600) = false, 'rate limit not enforced';
  begin
    perform count(*) from private.rate_limit_events;
    raise exception 'private schema readable by authenticated';
  exception when insufficient_privilege then null;
  end;
end $$;

-- anon sees nothing
reset request.jwt.claim.sub;
set local role anon;
do $$ begin
  begin
    perform count(*) from trades;
    raise exception 'anon can read trades';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo 'RLS tests passed'
