-- ACCOUNTS
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  current_org_id uuid,
  created_at timestamptz default now()
);

do $$ begin
  create type user_role as enum ('owner','admin','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_tier as enum ('free','pro');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  billing_tier billing_tier not null default 'free',
  created_at timestamptz default now()
);

create table if not exists public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'owner',
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- BILLING
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  stripe_subscription_id text unique not null,
  price_id text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.stripe_webhook_events (
  id text primary key,      -- event.id from Stripe
  type text,
  received_at timestamptz default now(),
  payload jsonb not null
);

-- RLS
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table subscriptions enable row level security;
alter table stripe_webhook_events enable row level security;

create or replace function public.is_org_member(check_org uuid)
returns boolean language sql stable as $$
  select exists(select 1 from memberships m where m.org_id = check_org and m.user_id = auth.uid());
$$;

-- Profiles: self read/update
drop policy if exists "profiles select self" on profiles;
create policy "profiles select self" on profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles update self" on profiles;
create policy "profiles update self" on profiles
  for update using (auth.uid() = id);

-- Orgs: members can read; owner writes
drop policy if exists "orgs select by members" on organizations;
create policy "orgs select by members" on organizations
  for select using (is_org_member(id));
drop policy if exists "orgs owner update" on organizations;
create policy "orgs owner update" on organizations
  for update using (owner_id = auth.uid());
drop policy if exists "orgs owner delete" on organizations;
create policy "orgs owner delete" on organizations
  for delete using (owner_id = auth.uid());

-- Memberships: self-readable
drop policy if exists "memberships select self" on memberships;
create policy "memberships select self" on memberships
  for select using (user_id = auth.uid());

-- Billing tables: members read; writes via service role (no public writes)
drop policy if exists "subscriptions select by members" on subscriptions;
create policy "subscriptions select by members" on subscriptions
  for select using (is_org_member(org_id));

drop policy if exists "webhook events select none" on stripe_webhook_events;
create policy "webhook events select none" on stripe_webhook_events
  for select using (false);