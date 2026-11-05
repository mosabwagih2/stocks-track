-- Photos of signed papers and crossed-out waybills (Supabase Storage).
-- Run on Supabase only (the `storage` schema does not exist on plain Postgres).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Testing phase: anyone with the anon key can upload and read. Tighten before going live.
create policy "documents read"   on storage.objects for select to anon, authenticated using (bucket_id = 'documents');
create policy "documents upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'documents');
