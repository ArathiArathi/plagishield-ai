
-- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_type text not null,
  size_bytes bigint not null default 0,
  latest_version int not null default 1,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

create policy "owner can view documents" on public.documents
  for select to authenticated using (auth.uid() = owner_id or public.has_role(auth.uid(),'institution_admin') or public.has_role(auth.uid(),'super_admin'));
create policy "owner can insert documents" on public.documents
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "owner can update documents" on public.documents
  for update to authenticated using (auth.uid() = owner_id);
create policy "owner can delete documents" on public.documents
  for delete to authenticated using (auth.uid() = owner_id);

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- document_versions
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);
grant select, insert, update, delete on public.document_versions to authenticated;
grant all on public.document_versions to service_role;
alter table public.document_versions enable row level security;

create policy "owner can view versions" on public.document_versions
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and (d.owner_id = auth.uid() or public.has_role(auth.uid(),'institution_admin') or public.has_role(auth.uid(),'super_admin')))
  );
create policy "owner can insert versions" on public.document_versions
  for insert to authenticated with check (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );
create policy "owner can delete versions" on public.document_versions
  for delete to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

-- analyses
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_id uuid not null references public.document_versions(id) on delete cascade,
  status text not null default 'pending',
  similarity_score numeric,
  ai_score numeric,
  grammar_score numeric,
  citation_score numeric,
  results jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.analyses to authenticated;
grant all on public.analyses to service_role;
alter table public.analyses enable row level security;

create policy "owner can view analyses" on public.analyses
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and (d.owner_id = auth.uid() or public.has_role(auth.uid(),'institution_admin') or public.has_role(auth.uid(),'super_admin')))
  );
create policy "owner can insert analyses" on public.analyses
  for insert to authenticated with check (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );
create policy "owner can update analyses" on public.analyses
  for update to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

create trigger analyses_touch before update on public.analyses
  for each row execute function public.touch_updated_at();
