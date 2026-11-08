revoke execute on function public.enforce_document_allowance() from public, anon, authenticated;

create index if not exists documents_owner_created_at_idx
  on public.documents (owner_id, created_at desc);

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
