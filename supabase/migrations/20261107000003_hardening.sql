-- Production hardening (additive, non-destructive).
-- 1) Per-user rate limiting for expensive actions (imports, exports, recalculation).
-- 2) Sign-up trigger stores the browser timezone when it is a valid IANA name.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.rate_limit_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup_idx on private.rate_limit_events (user_id, action, created_at desc);

-- Returns true when the call is allowed (and records it), false when the limit is exceeded.
create or replace function public.check_rate_limit(p_action text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]{1,40}$' or p_max < 1 or p_max > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;
  -- serialize concurrent calls of the same user/action
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_action, 0));
  delete from private.rate_limit_events
    where user_id = v_uid and action = p_action and created_at < now() - make_interval(secs => 86400);
  select count(*) into v_count from private.rate_limit_events
    where user_id = v_uid and action = p_action and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then return false; end if;
  insert into private.rate_limit_events (user_id, action) values (v_uid, p_action);
  return true;
end $$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := new.raw_user_meta_data ->> 'timezone';
begin
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 80),
    v_tz
  );
  return new;
end $$;
