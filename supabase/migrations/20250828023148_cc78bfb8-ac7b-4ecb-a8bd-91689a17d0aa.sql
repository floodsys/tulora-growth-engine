create table if not exists public.voice_agents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  description text,
  retell_agent_id text,
  from_number text,
  use_case_tags text[] default '{}',
  booking_provider text,
  booking_config jsonb,   -- { "eventTypeId": 123, "timezone": "America/Toronto" }
  prompt text,
  created_at timestamptz default now()
);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.voice_agents(id) on delete set null,
  call_id text,
  direction text,     -- 'outbound'|'inbound'|'web'
  to_e164 text,
  from_e164 text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  transcript_url text,
  raw jsonb,
  created_at timestamptz default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.voice_agents(id) on delete set null,
  cal_booking_id text,
  attendee_name text,
  attendee_phone text,
  attendee_email text,
  time_start timestamptz,
  time_end timestamptz,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.voice_agents enable row level security;
alter table public.call_logs enable row level security;
alter table public.bookings enable row level security;

drop policy if exists admin_access_voice_agents on public.voice_agents;
create policy admin_access_voice_agents on public.voice_agents for all using (true) with check (true);

drop policy if exists admin_access_call_logs on public.call_logs;
create policy admin_access_call_logs on public.call_logs for all using (true) with check (true);

drop policy if exists admin_access_bookings on public.bookings;
create policy admin_access_bookings on public.bookings for all using (true) with check (true);