create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro', 'plus', 'premium')),
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Enforce plan allowances at the database boundary as well as in the upload UI.
-- This prevents direct API calls from bypassing a workspace's document limit.
create or replace function public.enforce_document_allowance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := 'free';
  v_limit integer := 10;
  v_count integer := 0;
begin
  -- Do not let clients backdate created_at to bypass the monthly allowance.
  new.created_at := now();

  -- Serialize inserts for a user so concurrent uploads cannot exceed the limit.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));

  select
    case
      when s.status in ('active', 'trialing')
        and s.plan_id in ('pro', 'plus', 'premium')
      then s.plan_id
      else 'free'
    end
  into v_plan
  from public.subscriptions s
  where s.user_id = new.owner_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  v_limit := case v_plan
    when 'pro' then 15
    when 'plus' then 25
    when 'premium' then 35
    else 10
  end;

  select count(*) into v_count
  from public.documents d
  where d.owner_id = new.owner_id
    and d.created_at >= date_trunc('month', now());

  if v_count >= v_limit then
    raise exception using
      errcode = 'P0001',
      message = format('Your %s plan allows up to %s new documents per month. Upgrade your plan to add another document.', v_plan, v_limit);
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_document_allowance_before_insert on public.documents;
create trigger enforce_document_allowance_before_insert
  before insert on public.documents
  for each row execute function public.enforce_document_allowance();

-- The trigger invokes this function internally. It is not a public RPC endpoint.
revoke execute on function public.enforce_document_allowance() from public, anon, authenticated;

create index if not exists documents_owner_created_at_idx
  on public.documents (owner_id, created_at desc);
