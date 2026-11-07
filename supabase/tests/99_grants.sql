-- Supabase grants these by default; mirrored for the local test harness.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;
