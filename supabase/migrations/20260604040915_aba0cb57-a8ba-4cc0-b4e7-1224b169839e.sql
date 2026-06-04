
create policy "users read own docs" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users upload own docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users update own docs" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own docs" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
