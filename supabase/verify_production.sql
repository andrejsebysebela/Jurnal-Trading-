-- EDGELOG production verification — READ-ONLY. Safe to run in the Supabase SQL editor.
-- Every row in the final result should show ok = true.
with expected_tables(name) as (
  values ('profiles'),('accounts'),('instruments'),('strategies'),('tags'),('import_batches'),('import_mappings'),('trades'),
         ('executions'),('trade_tags'),('daily_journals'),('screenshots'),('trading_rules'),('rule_checks'),('fx_rates')
), tbl as (
  select e.name, c.oid, c.relrowsecurity as rls, c.relforcerowsecurity as forced
  from expected_tables e left join pg_class c on c.relname = e.name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
), checks as (
  select 'table exists: ' || name as item, oid is not null as ok from tbl
  union all select 'RLS enabled: ' || name, coalesce(rls, false) from tbl
  union all select 'RLS forced: ' || name, coalesce(forced, false) from tbl where name <> 'profiles'
  union all select 'policies (select/insert/update/delete): ' || t.name,
    (select count(distinct cmd) from pg_policies p where p.schemaname = 'public' and p.tablename = t.name) >= case when t.name = 'profiles' then 2 else 4 end
    from tbl t
  union all select 'no public table without RLS', not exists (
    select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity)
  union all select 'no policy grants access to everyone', not exists (
    select 1 from pg_policies where schemaname = 'public' and (qual = 'true' or with_check = 'true'))
  union all select 'screenshots bucket exists and is PRIVATE', exists (select 1 from storage.buckets where id = 'screenshots' and public = false)
  union all select 'screenshots bucket size limit <= 10MB', exists (select 1 from storage.buckets where id = 'screenshots' and file_size_limit <= 10485760)
  union all select 'screenshots bucket restricts mime types', exists (select 1 from storage.buckets where id = 'screenshots' and allowed_mime_types is not null and not ('image/svg+xml' = any(allowed_mime_types)))
  union all select 'storage policies for screenshots (select/insert/delete)',
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'screenshots_%') >= 3
  union all select 'save_trade is SECURITY INVOKER', exists (select 1 from pg_proc where proname = 'save_trade' and not prosecdef)
  union all select 'save_trade not executable by anon', not has_function_privilege('anon', 'public.save_trade(jsonb,jsonb,uuid[])', 'execute')
  union all select 'check_rate_limit not executable by anon', not has_function_privilege('anon', 'public.check_rate_limit(text,int,int)', 'execute')
  union all select 'private schema not usable by API roles', not has_schema_privilege('authenticated', 'private', 'usage') and not has_schema_privilege('anon', 'private', 'usage')
  union all select 'SECURITY DEFINER functions pin search_path', not exists (
    select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosecdef and (proconfig is null or not exists (select 1 from unnest(proconfig) x where x like 'search_path=%')))
  union all select 'index: ' || i, exists (select 1 from pg_indexes where schemaname = 'public' and indexname = i)
    from unnest(array['trades_user_activity_idx','trades_user_account_idx','trades_user_symbol_idx','trades_strategy_idx','executions_trade_idx','executions_fingerprint_uidx','rule_checks_user_date_idx']) i
  union all select 'signup trigger present', exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')
  union all select 'all 3 migrations applied', (select count(*) from supabase_migrations.schema_migrations where version in ('20261107000001','20261107000002','20261107000003')) = 3
)
select item as check_name, ok from checks order by ok, item;
